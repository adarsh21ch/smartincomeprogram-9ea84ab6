import { AdminLayout } from "@/components/layout/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, Star, Mail, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";

const AdminSettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*");
      return data || [];
    },
  });

  const getVal = (key: string) => settings.find((s) => s.key === key)?.value || "";

  const [announcementText, setAnnouncementText] = useState("");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Testimonial settings
  const [maxVideoSeconds, setMaxVideoSeconds] = useState("60");
  const [maxPerPage, setMaxPerPage] = useState("8");
  const [videoFeatureEnabled, setVideoFeatureEnabled] = useState(true);

  useEffect(() => {
    if (settings.length) {
      setAnnouncementText(getVal("announcement_text"));
      setAnnouncementActive(getVal("announcement_active") === "true");
      setMaintenanceMode(getVal("maintenance_mode") === "true");
      setMaxVideoSeconds(getVal("testimonial_max_video_seconds") || "60");
      setMaxPerPage(getVal("testimonial_max_per_page") || "8");
      setVideoFeatureEnabled(getVal("testimonial_video_feature_enabled") !== "false");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "announcement_text", value: announcementText },
        { key: "announcement_active", value: String(announcementActive) },
        { key: "maintenance_mode", value: String(maintenanceMode) },
        { key: "testimonial_max_video_seconds", value: maxVideoSeconds },
        { key: "testimonial_max_per_page", value: maxPerPage },
        { key: "testimonial_video_feature_enabled", value: String(videoFeatureEnabled) },
      ];
      for (const u of updates) {
        await supabase.from("platform_settings").update({ value: u.value }).eq("key", u.key);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
      toast.success("Settings saved");
    },
  });

  return (
    <AdminLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-heading font-bold">Platform Settings</h1>

        <div className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-base font-heading font-semibold mb-4">Announcement Banner</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Show Announcement</Label>
                <Switch checked={announcementActive} onCheckedChange={setAnnouncementActive} />
              </div>
              <div>
                <Label>Announcement Text</Label>
                <Textarea value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} className="mt-1 bg-muted border-border" placeholder="Write your announcement..." rows={3} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-base font-heading font-semibold mb-4">Maintenance Mode</h2>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground mt-1">When enabled, users will see a maintenance page.</p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
          </div>

          {/* Gmail Integration */}
          <GmailConnectionSection />

          {/* Testimonials Settings */}
          <div className="border-t border-border pt-6">
            <h2 className="text-base font-heading font-semibold mb-4 flex items-center gap-2">
              <Star size={16} className="text-primary" /> Testimonials
            </h2>
            <div className="space-y-4">
              <div>
                <Label>Maximum video testimonial duration</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Maximum length allowed for each testimonial video</p>
                <Select value={maxVideoSeconds} onValueChange={setMaxVideoSeconds}>
                  <SelectTrigger className="mt-1.5 bg-muted border-border w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="45">45 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                    <SelectItem value="90">90 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Maximum testimonials per landing page</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Maximum testimonials a creator can add per landing page</p>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={maxPerPage}
                  onChange={(e) => setMaxPerPage(e.target.value)}
                  className="mt-1.5 bg-muted border-border w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow video testimonials on landing pages</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">If disabled, only text testimonials will be available</p>
                </div>
                <Switch checked={videoFeatureEnabled} onCheckedChange={setVideoFeatureEnabled} />
              </div>
            </div>
          </div>
        </div>

        <Button variant="hero" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save size={16} /> {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </AdminLayout>
  );
};

const GmailConnectionSection = () => {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { data: gmailToken, isLoading, refetch } = useQuery({
    queryKey: ["gmail-oauth-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_oauth_tokens")
        .select("gmail_email, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get("gmail");
    if (gmailStatus === "connected") {
      refetch();
      toast.success("Gmail connected successfully!");
      setConnecting(false);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gmailStatus === "error") {
      toast.error("Google authorization failed. If the message says the app is still being tested, add this Gmail address as a Test User in Google Cloud first.");
      setConnecting(false);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth-init");
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
        return;
      }
      throw new Error("Could not create Google authorization URL");
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Gmail connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: rows, error: fetchError } = await supabase
        .from("gmail_oauth_tokens")
        .select("id");
      if (fetchError) throw fetchError;

      if (rows?.length) {
        const { error } = await supabase
          .from("gmail_oauth_tokens")
          .delete()
          .in("id", rows.map((row) => row.id));
        if (error) throw error;
      }

      refetch();
      toast.success("Gmail disconnected");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="border-t border-border pt-6">
      <h2 className="text-base font-heading font-semibold mb-4 flex items-center gap-2">
        <Mail size={16} className="text-primary" /> Gmail Email Integration
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Connect your Gmail account to send confirmation emails from your own address.
      </p>

      {!gmailToken && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">Important:</span> the popup blocker issue is removed. If Google still blocks access, it means your Google OAuth app is still in <span className="font-medium text-foreground">Testing</span> and this Gmail is not added as a <span className="font-medium text-foreground">Test User</span>.</p>
          <p>Authorized redirect URI:</p>
          <code className="block text-[10px] bg-muted px-1.5 py-1 rounded select-all break-all">
            {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`}
          </code>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mb-4">
        In Google Cloud: add the URI above in <span className="text-foreground font-medium">Authorized redirect URIs</span>, enable <span className="text-foreground font-medium">Gmail API</span>, and add your Gmail account in <span className="text-foreground font-medium">Audience → Test users</span> while the app is in Testing mode.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Checking connection...
        </div>
      ) : gmailToken ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle size={16} className="text-primary" />
            <span className="text-foreground font-medium">Connected:</span>
            <span className="text-muted-foreground">{gmailToken.gmail_email}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            {disconnecting ? <><Loader2 size={14} className="animate-spin mr-1" /> Disconnecting...</> : <><XCircle size={14} className="mr-1" /> Disconnect Gmail</>}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle size={14} className="text-muted-foreground" /> Not connected
          </div>
          <Button
            variant="hero"
            size="sm"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? <><Loader2 size={14} className="animate-spin mr-1" /> Opening Google…</> : <><ExternalLink size={14} className="mr-1" /> Connect Gmail Account</>}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
