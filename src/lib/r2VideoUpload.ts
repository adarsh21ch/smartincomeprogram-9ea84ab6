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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Upload failed";
};

export const uploadVideoToR2 = async ({
  file,
  title,
  timeoutMs = 30 * 60 * 1000,
  onProgress,
  onStage,
}: UploadVideoToR2Options): Promise<UploadVideoToR2Result> => {
  let videoId: string | null = null;

  try {
    // Step 1: Faststart optimization — move moov atom to front for instant streaming
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
          onStage?.("Video optimized ✓");
        }
      } catch (err) {
        console.warn("Faststart optimization skipped:", err);
        processedFile = file;
      }
    }

    // Step 2: Get presigned upload URL
    onStage?.("Preparing upload…");
    const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
      body: {
        filename: processedFile.name,
        contentType: processedFile.type || "video/mp4",
        title: title || file.name,
      },
    });

    if (error || !data?.uploadUrl || !data?.videoId) {
      throw new Error(data?.error || error?.message || "Failed to start upload");
    }

    videoId = data.videoId;

    // Step 3: Upload to R2 via presigned URL with progress tracking
    onStage?.("Uploading…");
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", data.uploadUrl);
      xhr.timeout = timeoutMs;
      xhr.setRequestHeader("Content-Type", processedFile.type || "application/octet-stream");

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
          return;
        }

        reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      };

      xhr.onerror = () => reject(new Error("Network error while uploading video"));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or a faster connection."));
      xhr.send(processedFile);
    });

    // Step 4: Confirm upload and get CDN URL
    onStage?.("Finalizing…");
    const { data: confirmData, error: confirmError } = await supabase.functions.invoke("confirm-r2-upload", {
      body: {
        videoId,
        fileSizeBytes: processedFile.size,
        durationSeconds: durationSeconds || undefined,
      },
    });

    if (confirmError || !confirmData?.publicUrl) {
      throw new Error(confirmData?.error || confirmError?.message || "Upload finished but confirmation failed");
    }

    return {
      videoId,
      publicUrl: confirmData.publicUrl,
      durationSeconds,
    };
  } catch (error) {
    if (videoId) {
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
