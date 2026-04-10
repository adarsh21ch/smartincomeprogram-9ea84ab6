import { supabase } from "@/integrations/supabase/client";

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
}

export const uploadVideoToR2 = async ({
  file, title, timeoutMs = 30 * 60 * 1000, onProgress, onStage,
}: UploadVideoToR2Options): Promise<UploadVideoToR2Result> => {
  let videoId: string | null = null;

  try {
    onStage?.("Preparing upload…");
    const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
      body: { filename: file.name, contentType: file.type || "video/mp4", title: title || file.name },
    });
    if (error || !data?.uploadUrl || !data?.videoId)
      throw new Error(data?.error || error?.message || "Failed to start upload");

    videoId = data.videoId;

    onStage?.("Uploading…");
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.uploadUrl);
      xhr.timeout = timeoutMs;
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
        else reject(new Error(`Upload failed (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error while uploading video"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.send(file);
    });

    onStage?.("Finalizing…");
    const { data: confirmData, error: confirmError } = await supabase.functions.invoke("confirm-r2-upload", {
      body: { videoId, fileSizeBytes: file.size },
    });
    if (confirmError || !confirmData?.publicUrl)
      throw new Error(confirmData?.error || confirmError?.message || "Confirmation failed");

    return { videoId, publicUrl: confirmData.publicUrl };
  } catch (error) {
    if (videoId) {
      try {
        await supabase.functions.invoke("confirm-r2-upload", {
          body: { videoId, failed: true, errorMessage: error instanceof Error ? error.message : "Upload failed" },
        });
      } catch { /* best effort */ }
    }
    throw error;
  }
};
