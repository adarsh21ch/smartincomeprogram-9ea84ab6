import { supabase } from "@/integrations/supabase/client";

interface UploadVideoToR2Options {
  file: File;
  title?: string;
  timeoutMs?: number;
  stallTimeoutMs?: number;
  concurrency?: number;
  onProgress?: (progress: number, uploadedBytes?: number) => void;
}

interface UploadVideoToR2Result {
  publicUrl: string;
  videoId: string;
}

interface MultipartResumeState {
  videoId: string;
  r2Key: string;
  uploadId: string;
  partSize: number;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Upload failed";
};

const MULTIPART_THRESHOLD_BYTES = 256 * 1024 * 1024;
const DEFAULT_STALL_TIMEOUT_MS = 2 * 60 * 1000;

const getResumeStorageKey = (file: File) =>
  `r2-video-upload:${file.name}:${file.size}:${file.lastModified}`;

const readResumeState = (file: File): MultipartResumeState | null => {
  try {
    const raw = window.localStorage.getItem(getResumeStorageKey(file));
    if (!raw) return null;
    const state = JSON.parse(raw) as MultipartResumeState;
    if (!state.videoId || !state.r2Key || !state.uploadId || !state.partSize) return null;
    return state;
  } catch {
    return null;
  }
};

const writeResumeState = (file: File, state: MultipartResumeState) => {
  try {
    window.localStorage.setItem(getResumeStorageKey(file), JSON.stringify(state));
  } catch {
    // Resume is best-effort only.
  }
};

const clearResumeState = (file: File) => {
  try {
    window.localStorage.removeItem(getResumeStorageKey(file));
  } catch {
    // Resume is best-effort only.
  }
};

const uploadBlobWithProgress = ({
  url,
  body,
  contentType,
  timeoutMs,
  stallTimeoutMs,
  onProgress,
}: {
  url: string;
  body: Blob;
  contentType: string;
  timeoutMs: number;
  stallTimeoutMs: number;
  onProgress?: (loaded: number) => void;
}) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let stallTimer: number | undefined;

    const clearStallTimer = () => {
      if (stallTimer) window.clearTimeout(stallTimer);
      stallTimer = undefined;
    };

    const settle = (callback: (value?: unknown) => void, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearStallTimer();
      callback(value);
    };

    const resetStallTimer = () => {
      clearStallTimer();
      if (stallTimeoutMs <= 0) return;
      stallTimer = window.setTimeout(() => {
        settle(reject, new Error("Upload stalled because the network stopped sending data. Retrying this video chunk..."));
        xhr.abort();
      }, stallTimeoutMs);
    };

    xhr.open("PUT", url);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      resetStallTimer();
      onProgress?.(event.loaded);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(body.size);
        settle(resolve);
        return;
      }

      settle(reject, new Error(`Upload failed (HTTP ${xhr.status})`));
    };

    xhr.onerror = () => settle(reject, new Error("Network error while uploading video"));
    xhr.onabort = () => settle(reject, new Error("Upload was interrupted"));
    xhr.ontimeout = () => settle(reject, new Error("Upload timed out. Keep this page open and use a stronger connection for large videos."));
    resetStallTimer();
    xhr.send(body);
  });

const withRetry = async (task: () => Promise<void>, attempts = 5) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, Math.min(12000, attempt * attempt * 1000)));
    }
  }

  throw lastError;
};

export const uploadVideoToR2 = async ({
  file,
  title,
  timeoutMs = 30 * 60 * 1000,
  stallTimeoutMs = DEFAULT_STALL_TIMEOUT_MS,
  concurrency = 2,
  onProgress,
}: UploadVideoToR2Options): Promise<UploadVideoToR2Result> => {
  let videoId: string | null = null;
  let multipartUploadId: string | null = null;
  let r2Key: string | null = null;
  let keepMultipartForResume = false;

  try {
    const resumeState = file.size >= MULTIPART_THRESHOLD_BYTES ? readResumeState(file) : null;
    const { data, error } = resumeState
      ? { data: { ...resumeState, multipart: true }, error: null }
      : await supabase.functions.invoke("get-r2-upload-url", {
          body: {
            filename: file.name,
            contentType: file.type,
            title: title || file.name,
            fileSizeBytes: file.size,
            multipart: file.size >= MULTIPART_THRESHOLD_BYTES,
          },
        });

    if (error || !data?.videoId || (!data?.uploadUrl && !data?.multipart)) {
      throw new Error(data?.error || error?.message || "Failed to start upload");
    }

    videoId = data.videoId;
    r2Key = data.r2Key;

    if (data.multipart) {
      multipartUploadId = data.uploadId;
      const partSize = Number(data.partSize || 16 * 1024 * 1024);
      const totalParts = Math.ceil(file.size / partSize);
      const partProgress = new Array(totalParts).fill(0);
      const completedParts: Array<{ partNumber: number }> = [];
      let nextPartIndex = 0;
      keepMultipartForResume = true;

      if (videoId && r2Key && multipartUploadId) {
        writeResumeState(file, { videoId, r2Key, uploadId: multipartUploadId, partSize });
      }

      const publishProgress = () => {
        const loaded = partProgress.reduce((sum, value) => sum + value, 0);
        onProgress?.(Math.min(99, Math.floor((loaded / file.size) * 100)), loaded);
      };

      const { data: listedParts } = await supabase.functions.invoke("get-r2-upload-url", {
        body: { action: "list-parts", videoId, r2Key, uploadId: multipartUploadId },
      });

      const uploadedParts = Array.isArray(listedParts?.parts) ? listedParts.parts : [];
      for (const part of uploadedParts) {
        const partNumber = Number(part.partNumber);
        if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > totalParts) continue;
        partProgress[partNumber - 1] = Number(part.size) || partSize;
        completedParts.push({ partNumber });
      }
      publishProgress();

      const uploadPart = async (partIndex: number) => {
        const partNumber = partIndex + 1;
        if (completedParts.some((part) => part.partNumber === partNumber)) return;
        const start = partIndex * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);

        await withRetry(async () => {
          const { data: partData, error: partError } = await supabase.functions.invoke("get-r2-upload-url", {
            body: { action: "sign-part", videoId, r2Key, uploadId: multipartUploadId, partNumber },
          });

          if (partError || !partData?.uploadUrl) throw new Error(partData?.error || partError?.message || `Failed to prepare part ${partNumber}`);

          await uploadBlobWithProgress({
            url: partData.uploadUrl,
            body: blob,
            contentType: file.type,
            timeoutMs,
            stallTimeoutMs,
            onProgress: (loaded) => {
              partProgress[partIndex] = loaded;
              publishProgress();
            },
          });
        });

        partProgress[partIndex] = blob.size;
        completedParts.push({ partNumber });
        publishProgress();
      };

      const worker = async () => {
        while (nextPartIndex < totalParts) {
          const partIndex = nextPartIndex;
          nextPartIndex += 1;
          await uploadPart(partIndex);
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, totalParts) }, worker));

      const { data: completeData, error: completeError } = await supabase.functions.invoke("get-r2-upload-url", {
        body: { action: "complete", videoId, r2Key, uploadId: multipartUploadId, parts: completedParts },
      });

      if (completeError || !completeData?.success) throw new Error(completeData?.error || completeError?.message || "Could not finish video upload");
      keepMultipartForResume = false;
      clearResumeState(file);
      onProgress?.(100, file.size);
    } else {
      await uploadBlobWithProgress({
        url: data.uploadUrl,
        body: file,
        contentType: file.type,
        timeoutMs,
        stallTimeoutMs,
        onProgress: (loaded) => onProgress?.(Math.round((loaded / file.size) * 100), loaded),
      });
      onProgress?.(100, file.size);
    }

    const { data: confirmData, error: confirmError } = await supabase.functions.invoke("confirm-r2-upload", {
      body: {
        videoId,
        fileSizeBytes: file.size,
      },
    });

    if (confirmError || !confirmData?.publicUrl) {
      throw new Error(confirmData?.error || confirmError?.message || "Upload finished but confirmation failed");
    }

    return {
      videoId,
      publicUrl: confirmData.publicUrl,
    };
  } catch (error) {
    if (videoId && r2Key && multipartUploadId && !keepMultipartForResume) {
      try {
        await supabase.functions.invoke("get-r2-upload-url", {
          body: { action: "abort", videoId, r2Key, uploadId: multipartUploadId },
        });
      } catch {
        // best effort cleanup
      }
    }

    if (videoId && !keepMultipartForResume) {
      try {
        await supabase.functions.invoke("confirm-r2-upload", {
          body: {
            videoId,
            failed: true,
            errorMessage: getErrorMessage(error),
          },
        });
      } catch {
        // best effort cleanup
      }
    }

    throw error;
  }
};