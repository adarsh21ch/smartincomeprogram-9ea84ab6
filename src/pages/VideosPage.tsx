import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";
import { Video, Search, Grid, List, Share2, Pencil, Rocket, Upload, Loader2, Trash2 } from "lucide-react";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const VideosPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes/sec
  const [uploadEta, setUploadEta] = useState(0); // seconds
  const [title, setTitle] = useState("");

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["videos", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").eq("owner_id", user!.id).not("status", "eq", "failed").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const filtered = videos.filter((v) => !search || v.title.toLowerCase().includes(search.toLowerCase()));

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
      const startTime = Date.now();
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return;
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0.5) {
          const speed = e.loaded / elapsed; // bytes/sec
          setUploadSpeed(speed);
          const remaining = (e.total - e.loaded) / speed;
          setUploadEta(remaining);
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", data.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.timeout = 60 * 60 * 1000; // 1 hour for big files on slow links
        xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.send(file);
      });

      const { error: confirmErr } = await supabase.functions.invoke("confirm-r2-upload", {
        body: { videoId: data.videoId, fileSizeBytes: file.size },
      });
      if (confirmErr) throw new Error("Upload succeeded but confirmation failed");

      toast.success("Video uploaded successfully!");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Upload failed");
      if (videoId) {
        try {
          await supabase.functions.invoke("confirm-r2-upload", { body: { videoId, failed: true, errorMessage: err.message } });
        } catch (_) {}
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
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Video deleted");
    },
  });

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const useInFunnel = (videoId: string) => navigate(`/funnels/create?videoId=${videoId}`);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-heading font-bold">Video Gallery</h1>
          <div>
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

        {/* Upload section */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">Video Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title before uploading" className="mt-1 bg-muted border-border" />
            </div>
          </div>
          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2 bg-muted [&>div]:bg-primary" />
              <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search videos..." className="pl-9 bg-muted border-border" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button onClick={() => setView("grid")} className={`p-2 rounded-md transition-colors ${view === "grid" ? "bg-card shadow-sm" : ""}`}><Grid size={16} /></button>
            <button onClick={() => setView("list")} className={`p-2 rounded-md transition-colors ${view === "list" ? "bg-card shadow-sm" : ""}`}><List size={16} /></button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Video size={40} className="text-muted-foreground mx-auto mb-3" />
            <h3 className="font-heading font-semibold mb-2">{search ? "No videos found" : "No videos yet"}</h3>
            <p className="text-sm text-muted-foreground mb-6">Upload videos directly to your gallery.</p>
            <Button variant="hero" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload size={16} /> Upload Video
            </Button>
          </div>
        ) : (
          <div className={view === "grid" ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
            {filtered.map((v) => (
              <div key={v.id} className="glass-card-hover p-4">
                <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover rounded-lg" /> :
                    v.public_url ? <video src={v.public_url} className="w-full h-full object-cover rounded-lg" /> :
                    <Video size={24} className="text-muted-foreground" />}
                </div>
                <h3 className="font-medium text-sm truncate">{v.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{formatSize(v.file_size_bytes)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                    {v.status}
                  </span>
                </div>
                <div className="flex gap-1 mt-3 border-t border-border pt-3">
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setRenameVideo({ id: v.id, title: v.title })}>
                    <Pencil size={12} className="mr-1" /> Rename
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => setShareVideo({ id: v.id, title: v.title })}>
                    <Share2 size={12} className="mr-1" /> Share
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-1" onClick={() => useInFunnel(v.id)}>
                    <Rocket size={12} className="mr-1" /> Funnel
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Delete this video?")) deleteMutation.mutate(v.id); }}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {shareVideo && (
          <VideoShareModal open={!!shareVideo} onClose={() => setShareVideo(null)} videoId={shareVideo.id} videoTitle={shareVideo.title} />
        )}
        {renameVideo && (
          <VideoRenameModal open={!!renameVideo} onClose={() => setRenameVideo(null)} videoId={renameVideo.id} currentTitle={renameVideo.title}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["videos"] })} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default VideosPage;
