import { supabase } from "@/integrations/supabase/client";
import { ensureFaststart } from "./mp4Faststart";

interface UploadVideoToR2Options {
  file: File;
  title?: string;
  timeoutMs?: number;
  onProgress?: (progress: number) => void;
  onStage?: (stage: string) => void;
}

interface UploadVideoToR2Result {
  publicUrl: string;
  videoId: string;
  durationSeconds: number;
}

// ── Configuration ─────────────────────────────────────────────
const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB per part
const MAX_CONCURRENT = 4; // parallel upload workers
const MAX_RETRIES = 3; // retries per chunk
const SINGLE_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // <20MB = single PUT

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Upload failed";
};

// ── Single-part upload (small files) ─────────────────────────
async function uploadSinglePart(
  file: File,
  uploadUrl: string,
  timeoutMs: number,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading video"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.send(file);
  });
}

// ── Upload a single chunk with retry ─────────────────────────
async function uploadChunkWithRetry(
  url: string,
  chunk: Blob,
  partNumber: number,
  maxRetries: number
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "PUT",
        body: chunk,
      });

      if (!response.ok) {
        throw new Error(`Part ${partNumber} upload failed (HTTP ${response.status})`);
      }

      // R2 returns ETag in response headers
      const etag = response.headers.get("ETag") || response.headers.get("etag");
      if (!etag) throw new Error(`Part ${partNumber}: no ETag in response`);

      return etag;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error(`Part ${partNumber} failed after ${maxRetries} retries`);
}

// ── Chunked multipart upload ─────────────────────────────────
interface MultipartContext {
  videoId: string;
  r2Key: string;
  uploadId: string;
}

async function initiateMultipart(
  file: File,
  title: string,
  totalParts: number
): Promise<MultipartContext> {
  const { data, error } = await supabase.functions.invoke("r2-multipart-upload", {
    body: {
      action: "initiate",
      filename: file.name,
      contentType: file.type || "video/mp4",
      title,
      totalParts,
    },
  });

  if (error || !data?.uploadId) {
    throw new Error(data?.error || error?.message || "Failed to initiate multipart upload");
  }

  return { videoId: data.videoId, r2Key: data.r2Key, uploadId: data.uploadId };
}

async function getPartUrls(
  r2Key: string,
  uploadId: string,
  partNumbers: number[]
): Promise<Record<number, string>> {
  const { data, error } = await supabase.functions.invoke("r2-multipart-upload", {
    body: { action: "get-part-urls", r2Key, uploadId, partNumbers },
  });

  if (error || !data?.urls) {
    throw new Error(data?.error || error?.message || "Failed to get part URLs");
  }

  return data.urls;
}

async function completeMultipart(
  ctx: MultipartContext,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("r2-multipart-upload", {
    body: {
      action: "complete",
      r2Key: ctx.r2Key,
      uploadId: ctx.uploadId,
      videoId: ctx.videoId,
      parts,
    },
  });

  if (error || !data?.success) {
    throw new Error(data?.error || error?.message || "Failed to complete multipart upload");
  }
}

async function abortMultipart(ctx: Partial<MultipartContext>, errorMessage?: string) {
  try {
    await supabase.functions.invoke("r2-multipart-upload", {
      body: {
        action: "abort",
        r2Key: ctx.r2Key,
        uploadId: ctx.uploadId,
        videoId: ctx.videoId,
        errorMessage,
      },
    });
  } catch {
    // best effort
  }
}

async function uploadMultipart(
  file: File,
  ctx: MultipartContext,
  onProgress?: (progress: number) => void
): Promise<{ PartNumber: number; ETag: string }[]> {
  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const completedParts: { PartNumber: number; ETag: string }[] = [];
  const partBytesUploaded = new Array(totalParts).fill(0);

  const reportProgress = () => {
    const totalUploaded = partBytesUploaded.reduce((a, b) => a + b, 0);
    onProgress?.(Math.min(99, Math.round((totalUploaded / file.size) * 100)));
  };

  // Fetch presigned URLs in batches to avoid huge single requests
  const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
  const urlBatchSize = 20;
  const allUrls: Record<number, string> = {};

  for (let i = 0; i < allPartNumbers.length; i += urlBatchSize) {
    const batch = allPartNumbers.slice(i, i + urlBatchSize);
    const urls = await getPartUrls(ctx.r2Key, ctx.uploadId, batch);
    Object.assign(allUrls, urls);
  }

  // Upload parts with concurrency pool
  let nextPartIndex = 0;

  const uploadWorker = async () => {
    while (nextPartIndex < totalParts) {
      const partIndex = nextPartIndex++;
      const partNumber = partIndex + 1;
      const start = partIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const url = allUrls[partNumber];

      if (!url) throw new Error(`No presigned URL for part ${partNumber}`);

      const etag = await uploadChunkWithRetry(url, chunk, partNumber, MAX_RETRIES);

      partBytesUploaded[partIndex] = end - start;
      reportProgress();

      completedParts.push({ PartNumber: partNumber, ETag: etag });
    }
  };

  // Launch concurrent workers
  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT, totalParts) },
    () => uploadWorker()
  );

  await Promise.all(workers);

  return completedParts;
}

// ── Main export ──────────────────────────────────────────────
export const uploadVideoToR2 = async ({
  file,
  title,
  timeoutMs = 30 * 60 * 1000,
  onProgress,
  onStage,
}: UploadVideoToR2Options): Promise<UploadVideoToR2Result> => {
  let ctx: Partial<MultipartContext> = {};

  try {
    // Step 1: Optimize video for streaming (moov atom relocation + duration extraction)
    let processedFile = file;
    let durationSeconds = 0;

    if (file.type.startsWith("video/")) {
      onStage?.("Optimizing video for streaming…");
      onProgress?.(0);

      try {
        const result = await ensureFaststart(file, (stage) => onStage?.(stage));
        processedFile = result.file;
        durationSeconds = result.durationSeconds;
        
        if (!result.alreadyFaststart) {
          console.log("Video optimized: moov atom relocated to start");
        }
      } catch (err) {
        console.warn("Video optimization skipped:", err);
        processedFile = file;
      }
    }

    const uploadTitle = title || file.name;
    const useMultipart = processedFile.size > SINGLE_UPLOAD_THRESHOLD;

    if (useMultipart) {
      // ── Multipart chunked upload ──
      const totalParts = Math.ceil(processedFile.size / CHUNK_SIZE);
      onStage?.(`Preparing upload (${totalParts} parts)…`);

      const multiCtx = await initiateMultipart(processedFile, uploadTitle, totalParts);
      ctx = multiCtx;

      onStage?.("Uploading…");
      const parts = await uploadMultipart(processedFile, multiCtx, onProgress);

      onStage?.("Assembling video…");
      await completeMultipart(multiCtx, parts);

      onProgress?.(100);
    } else {
      // ── Single PUT upload for small files ──
      onStage?.("Preparing upload…");
      const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
        body: {
          filename: processedFile.name,
          contentType: processedFile.type || "video/mp4",
          title: uploadTitle,
        },
      });

      if (error || !data?.uploadUrl || !data?.videoId) {
        throw new Error(data?.error || error?.message || "Failed to start upload");
      }

      ctx = { videoId: data.videoId, r2Key: data.r2Key };

      onStage?.("Uploading…");
      await uploadSinglePart(processedFile, data.uploadUrl, timeoutMs, onProgress);
    }

    // Confirm upload
    onStage?.("Finalizing…");
    const { data: confirmData, error: confirmError } = await supabase.functions.invoke("confirm-r2-upload", {
      body: {
        videoId: ctx.videoId,
        fileSizeBytes: processedFile.size,
        durationSeconds: durationSeconds || undefined,
      },
    });

    if (confirmError || !confirmData?.publicUrl) {
      throw new Error(confirmData?.error || confirmError?.message || "Upload finished but confirmation failed");
    }

    return {
      videoId: ctx.videoId!,
      publicUrl: confirmData.publicUrl,
      durationSeconds,
    };
  } catch (error) {
    // Cleanup: abort multipart or mark as failed
    if (ctx.videoId) {
      if (ctx.uploadId && ctx.r2Key) {
        await abortMultipart(ctx, getErrorMessage(error));
      } else {
        try {
          await supabase.functions.invoke("confirm-r2-upload", {
            body: { videoId: ctx.videoId, failed: true, errorMessage: getErrorMessage(error) },
          });
        } catch { /* best effort */ }
      }
    }

    throw error;
  }
};
