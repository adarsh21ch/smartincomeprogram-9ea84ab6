import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Upload, Video, Trash2, Loader2, Link2, Share2, Pencil, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "react-router-dom";
import { uploadVideoToR2 } from "@/lib/r2VideoUpload";

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

    try {
      await uploadVideoToR2({
        file,
        title: title || file.name,
        timeoutMs: 60 * 60 * 1000,
        onProgress: (progress) => setUploadProgress(progress),
      });

      toast.success("Video uploaded successfully");
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-videos"] });
    } catch (err: unknown) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
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
            <div className="flex-1 min-w-0">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="mt-1 bg-muted border-border w-full" />
            </div>
            <div className="flex items-end w-full sm:w-auto">
              <input type="file" ref={fileInputRef} accept="video/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }} />
              <Button variant="hero" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full sm:w-auto h-11">
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

        {/* Video list - Desktop table */}
        <div className="glass-card overflow-hidden hidden md:block">
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
                          <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            {v.thumbnail_url ? <img src={v.thumbnail_url} className="w-full h-full object-cover rounded" /> : <Video size={14} className="text-muted-foreground" />}
                          </div>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRenameVideo({ id: v.id, title: v.title })} title="Rename">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareVideo({ id: v.id, title: v.title })} title="Share">
                            <Share2 size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(v.id)} title="Copy Link">
                            <Link2 size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/funnels/create?videoId=${v.id}`)} title="Use in Funnel">
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

        {/* Video list - Mobile cards */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card p-4">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            ))
          ) : videos.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">No videos uploaded yet</div>
          ) : (
            videos.map((v) => (
              <div key={v.id} className="glass-card p-4 space-y-3 max-w-full overflow-hidden">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    {v.thumbnail_url ? <img src={v.thumbnail_url} className="w-full h-full object-cover rounded" /> : <Video size={14} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.original_filename}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className={`px-2 py-0.5 rounded-full ${v.status === "ready" ? "bg-success/10 text-success" : v.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                    {v.status}
                  </span>
                  <span>•</span>
                  <span>{formatSize(v.file_size_bytes)}</span>
                  <span>•</span>
                  <span>{v.view_count || 0} views</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" className="flex-1 h-9" onClick={() => setRenameVideo({ id: v.id, title: v.title })} title="Rename">
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-9" onClick={() => setShareVideo({ id: v.id, title: v.title })} title="Share">
                    <Share2 size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-9" onClick={() => copyLink(v.id)} title="Copy Link">
                    <Link2 size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-9" onClick={() => navigate(`/funnels/create?videoId=${v.id}`)} title="Use in Funnel">
                    <Rocket size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 h-9 text-destructive bg-destructive/10 hover:bg-destructive/20" onClick={() => { if (confirm("Delete this video?")) deleteMutation.mutate(v.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
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
    </AdminLayout>
  );
};

export default AdminVideosPage;
