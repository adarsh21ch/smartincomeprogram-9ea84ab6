import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Video, Search, Grid, List, Link2, Share2, Pencil, Rocket } from "lucide-react";
import { VideoLinkModal } from "@/components/VideoLinkModal";
import { VideoShareModal } from "@/components/VideoShareModal";
import { VideoRenameModal } from "@/components/VideoRenameModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const VideosPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<{ id: string; title: string } | null>(null);
  const [renameVideo, setRenameVideo] = useState<{ id: string; title: string } | null>(null);

  const { data: ownVideos = [], isLoading } = useQuery({
    queryKey: ["videos", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("video_assets").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sharedVideos = [] } = useQuery({
    queryKey: ["shared-videos", user?.id],
    queryFn: async () => {
      const { data: access } = await supabase.from("video_asset_access").select("video_id").eq("granted_to", user!.id);
      if (!access?.length) return [];
      const videoIds = access.map((a) => a.video_id);
      const { data } = await supabase.from("video_assets").select("*").in("id", videoIds);
      return data || [];
    },
    enabled: !!user,
  });

  const allVideos = [
    ...ownVideos.map((v) => ({ ...v, _source: "own" as const })),
    ...sharedVideos.filter((sv) => !ownVideos.find((ov) => ov.id === sv.id)).map((v) => ({ ...v, _source: "linked" as const })),
  ];

  const filtered = allVideos.filter((v) => !search || v.title.toLowerCase().includes(search.toLowerCase()));

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const useInFunnel = (videoId: string) => {
    navigate(`/funnels/create?videoId=${videoId}`);
  };

  const copyLink = (videoId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/video/${videoId}`);
    toast.success("Video link copied!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-heading font-bold">Video Gallery</h1>
          <Button variant="hero" onClick={() => setLinkModalOpen(true)}>
            <Link2 size={16} /> Add Video by Link
          </Button>
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
            <p className="text-sm text-muted-foreground mb-6">Add videos to your gallery using a Smart Income Program video link.</p>
            <Button variant="hero" onClick={() => setLinkModalOpen(true)}>
              <Link2 size={16} /> Add Video by Link
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
                  {v._source === "linked" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">Linked</span>
                  )}
                </div>
                {/* Action buttons */}
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
                </div>
              </div>
            ))}
          </div>
        )}

        <VideoLinkModal
          open={linkModalOpen}
          onClose={() => setLinkModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["shared-videos"] });
          }}
        />

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
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["videos"] });
              queryClient.invalidateQueries({ queryKey: ["shared-videos"] });
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default VideosPage;
