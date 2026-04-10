import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Upload, Video, Trash2, Loader2, Link2, Share2, Pencil, Rocket, Play, X } from "lucide-react";
import { StreamingVideo } from "@/components/StreamingVideo";
import { Progress } from "@/components/ui/progress";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "react-router-dom";

const AdminVideosPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ id: string; title: string; url: string } | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["admin-all-videos"],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress(0);

    let videoId: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke("get-r2-upload-url", {
        body: { filename: file.name, contentType: file.type, title: title || file.name },
      });

      if (error || !data?.uploadUrl) throw new Error(data?.error || "Failed to get upload URL");
      videoId = data.videoId;

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.onload = () => {
          if (xhr.status < 300) resolve();
          else reject(new Error(`R2 rejected upload (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 200) || "unknown error"}`));
        };
        xhr.onerror = () => reject(new Error("Network error — check CORS config on R2 bucket"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.send(file);
      });

      const { error: confirmErr } = await supabase.functions.invoke("confirm-r2-upload", {
        body: { videoId: data.videoId, fileSizeBytes: file.size },
      });

      if (confirmErr) throw new Error("Upload succeeded but confirmation failed");

      toast.success("Video uploaded successfully!");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Upload failed");

      if (videoId) {
        try {
          await supabase.functions.invoke("confirm-r2-upload", {
            body: { videoId, failed: true, errorMessage: err.message },
          });
        } catch (_) { /* best effort */ }
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("video_assets").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
      toast.success("Video deleted");
    },
  });

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/video/${id}`);
    toast.success("Video link copied!");
  };

  const useInFunnel = (videoId: string) => {
    navigate(`/funnels/create?videoId=${videoId}`);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold">Video Management</h1>

        {/* Upload section */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-heading font-semibold">Upload New Video</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="mt-1 bg-muted border-border" />
            </div>
            <div className="flex items-end">
              <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }} />
              <Button variant="hero" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "Uploading..." : "Upload Video"}
              </Button>
            </div>
          </div>
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2 bg-muted [&>div]:bg-white" />
              <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Video list */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-4 text-xs text-muted-foreground font-medium">Video</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Size</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Views</th>
                  <th className="p-4 text-xs text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-4"><div className="h-4 bg-muted rounded w-40 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-16 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-12 animate-pulse" /></td>
                      <td className="p-4"><div className="h-4 bg-muted rounded w-20 animate-pulse" /></td>
                    </tr>
                  ))
                ) : videos.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No videos uploaded yet</td></tr>
                ) : (
                  videos.map((v) => (
                    <tr key={v.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <button
                            className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0 relative group cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all"
                            onClick={() => v.public_url && setPreviewVideo({ id: v.id, title: v.title, url: v.public_url })}
                            title={v.public_url ? "Preview video" : "No URL available"}
                            disabled={!v.public_url}
                          >
                            {v.thumbnail_url ? <img src={v.thumbnail_url} className="w-full h-full object-cover rounded" /> : <Video size={14} className="text-muted-foreground" />}
                            {v.public_url && (
                              <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play size={12} fill="white" className="text-white" />
                              </div>
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{v.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{v.original_filename}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{formatSize(v.file_size_bytes)}</td>
                      <td className="p-4 text-xs text-muted-foreground">{v.view_count || 0}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {v.public_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewVideo({ id: v.id, title: v.title, url: v.public_url })} title="Preview">
                              <Play size={14} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRenameVideo({ id: v.id, title: v.title })} title="Rename">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareVideo({ id: v.id, title: v.title })} title="Share">
                            <Share2 size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(v.id)} title="Copy Link">
                            <Link2 size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => useInFunnel(v.id)} title="Use in Funnel">
                            <Rocket size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this video?")) deleteMutation.mutate(v.id); }}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {shareVideo && (
        <VideoShareModal
          open={!!shareVideo}
          onClose={() => setShareVideo(null)}
          videoId={shareVideo.id}
          videoTitle={shareVideo.title}
        />
      )}

      {renameVideo && (
        <VideoRenameModal
          open={!!renameVideo}
          onClose={() => setRenameVideo(null)}
          videoId={renameVideo.id}
          currentTitle={renameVideo.title}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] })}
        />
      )}

      {/* Video Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white truncate pr-4">{previewVideo.title}</h3>
              <button onClick={() => setPreviewVideo(null)} className="text-white/70 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <StreamingVideo
                src={previewVideo.url}
                title={previewVideo.title}
                className="w-full h-full"
                controls
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminVideosPage;
