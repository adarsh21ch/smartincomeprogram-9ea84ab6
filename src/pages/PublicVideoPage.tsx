import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { Video } from "lucide-react";

const PublicVideoPage = () => {
  const { id } = useParams();

  const { data: video, isLoading, error } = useQuery({
    queryKey: ["public-video", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_assets")
        .select("id, title, description, public_url, thumbnail_url, duration_seconds, is_shared")
        .eq("id", id!)
        .eq("is_shared", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Video size={48} className="text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-heading font-bold mb-2">Video Not Found</h1>
          <p className="text-sm text-muted-foreground">This video doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-8">
          <Logo size="sm" />
        </div>

        <div className="aspect-video bg-card rounded-xl overflow-hidden mb-6 relative">
          {video.public_url ? (
            <video
              src={video.public_url}
              controls
              className="w-full h-full"
              poster={video.thumbnail_url || undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-heading font-bold mb-2">{video.title}</h1>
        {video.description && <p className="text-sm text-muted-foreground mb-4">{video.description}</p>}
        {video.duration_seconds && (
          <p className="text-xs text-muted-foreground">
            Duration: {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, "0")}
          </p>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">Powered by <span className="gradient-text font-heading font-semibold">Smart Income Program</span></p>
        </div>
      </div>
    </div>
  );
};

export default PublicVideoPage;
