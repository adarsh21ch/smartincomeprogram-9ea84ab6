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

// supabase.functions.invoke hides the response body on non-2xx; unwrap it so users see the real reason.
const invokeFunction = async <T = any>(functionName: string, body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    let detail = "";
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = await ctx.json();
        detail = parsed?.error || parsed?.message || "";
      } else if (ctx && typeof ctx.text === "function") {
        detail = await ctx.text();
      }
    } catch {
      // ignore body parse errors
    }
    throw new Error(detail || (data as any)?.error || error.message || "Upload service error");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
};

const invokeUploadFn = async <T = any>(body: Record<string, unknown>): Promise<T> =>
  invokeFunction<T>("get-r2-upload-url", body);

const isRecoverableUploadError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return ["network", "stalled", "timed out", "interrupted", "failed to fetch", "load failed", "nosuchupload", "expired", "upload service error", "could not be verified"].some((term) => message.includes(term));
};

const MULTIPART_THRESHOLD_BYTES = 256 * 1024 * 1024;
const DEFAULT_STALL_TIMEOUT_MS = 2 * 60 * 1000;
const SIGNED_PART_BATCH_SIZE = 10;

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

const normalizeEtag = (etag: string | null) => etag?.trim() || "";

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
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let stallTimer: number | undefined;

    const clearStallTimer = () => {
      if (stallTimer) window.clearTimeout(stallTimer);
      stallTimer = undefined;
    };

    const settleSuccess = (etag: string) => {
      if (settled) return;
      settled = true;
      clearStallTimer();
      resolve(etag);
    };

    const settleFailure = (error: Error) => {
      if (settled) return;
      settled = true;
      clearStallTimer();
      reject(error);
    };

    const resetStallTimer = () => {
      clearStallTimer();
      if (stallTimeoutMs <= 0) return;
      stallTimer = window.setTimeout(() => {
        settleFailure(new Error("Upload stalled because the network stopped sending data. Retrying this video chunk..."));
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
        settleSuccess(normalizeEtag(xhr.getResponseHeader("ETag")));
        return;
      }

      settleFailure(new Error(`Upload failed (HTTP ${xhr.status})`));
    };

    xhr.onerror = () => settleFailure(new Error("Network error while uploading video"));
    xhr.onabort = () => settleFailure(new Error("Upload was interrupted"));
    xhr.ontimeout = () => settleFailure(new Error("Upload timed out. Keep this page open and use a stronger connection for large videos."));
    resetStallTimer();
    xhr.send(body);
  });

const withRetry = async <T>(task: () => Promise<T>, attempts = 5): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
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
    const data: any = resumeState
      ? { ...resumeState, multipart: true }
      : await invokeUploadFn({
          filename: file.name,
          contentType: file.type,
          title: title || file.name,
          fileSizeBytes: file.size,
          multipart: file.size >= MULTIPART_THRESHOLD_BYTES,
        });

    if (!data?.videoId || (!data?.uploadUrl && !data?.multipart)) {
      throw new Error(data?.error || "Failed to start upload");
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

      try {
        const listedParts: any = await invokeUploadFn({
          action: "list-parts", videoId, r2Key, uploadId: multipartUploadId,
        });
        const uploadedParts = Array.isArray(listedParts?.parts) ? listedParts.parts : [];
        for (const part of uploadedParts) {
          const partNumber = Number(part.partNumber);
          if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > totalParts) continue;
          partProgress[partNumber - 1] = Number(part.size) || partSize;
          completedParts.push({ partNumber });
        }
      } catch (listErr) {
        // Stale resume state (e.g. NoSuchUpload). Restart from scratch.
        clearResumeState(file);
        keepMultipartForResume = false;
        if (resumeState) {
          return uploadVideoToR2({ file, title, timeoutMs, stallTimeoutMs, concurrency, onProgress });
        }
        throw listErr;
      }
      publishProgress();

      const uploadPart = async (partIndex: number) => {
        const partNumber = partIndex + 1;
        if (completedParts.some((part) => part.partNumber === partNumber)) return;
        const start = partIndex * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);

        await withRetry(async () => {
          const partData: any = await invokeUploadFn({
            action: "sign-part", videoId, r2Key, uploadId: multipartUploadId, partNumber,
          });
          if (!partData?.uploadUrl) throw new Error(partData?.error || `Failed to prepare part ${partNumber}`);

          await uploadBlobWithProgress({
            url: partData.uploadUrl,
            body: blob,
            contentType: file.type,
            timeoutMs,
            stallTimeoutMs,
            onProgress: (loaded) => {
              partProgress[partIndex] = Math.max(partProgress[partIndex], loaded);
              publishProgress();
            },
          });
        });

        partProgress[partIndex] = blob.size;
        if (!completedParts.some((part) => part.partNumber === partNumber)) {
          completedParts.push({ partNumber });
        }
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

      // De-dupe partNumbers in case of races between resume + worker
      const uniqueCompletedParts = Array.from(
        new Map(completedParts.map((p) => [p.partNumber, p])).values(),
      ).sort((a, b) => a.partNumber - b.partNumber);

      let completeData: any;
      try {
        completeData = await invokeUploadFn({
          action: "complete", videoId, r2Key, uploadId: multipartUploadId, parts: uniqueCompletedParts,
        });
      } catch (completeErr) {
        // Stale or partially-aborted multipart upload — wipe resume state and restart cleanly.
        clearResumeState(file);
        keepMultipartForResume = false;
        if (resumeState) {
          return uploadVideoToR2({ file, title, timeoutMs, stallTimeoutMs, concurrency, onProgress });
        }
        throw completeErr;
      }
      if (!completeData?.success) throw new Error(completeData?.error || "Could not finish video upload");
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
    const canResumeAfterError = keepMultipartForResume && isRecoverableUploadError(error);
    if (!canResumeAfterError) clearResumeState(file);

    if (videoId && r2Key && multipartUploadId && !canResumeAfterError) {
      try {
        await invokeUploadFn({ action: "abort", videoId, r2Key, uploadId: multipartUploadId });
      } catch {
        // best effort cleanup
      }
    }

    if (videoId && !canResumeAfterError) {
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