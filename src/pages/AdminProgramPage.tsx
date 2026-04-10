import { AdminLayout } from "@/components/layout/AdminLayout";
import { useProgramSettings } from "@/hooks/useProgramSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Loader2, ExternalLink, AlertTriangle, CheckCircle2, Plus, Trash2, Eye, Monitor, Tablet, Smartphone } from "lucide-react";
import { toast } from "sonner";

const AdminProgramPage = () => {
  const { settings, isLoading, updateSettings } = useProgramSettings();
  const queryClient = useQueryClient();

  // Branding state
  const [programName, setProgramName] = useState("");
  const [programTagline, setProgramTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#D4AF37");

  // Content state
  const [heroLine1, setHeroLine1] = useState("");
  const [heroLine2, setHeroLine2] = useState("");
  const [heroSubtext, setHeroSubtext] = useState("");
  const [heroPill, setHeroPill] = useState("");
  const [showIntroVideo, setShowIntroVideo] = useState(true);
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [aboutSectionTitle, setAboutSectionTitle] = useState("");

  // About Tab state
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutContent, setAboutContent] = useState("");

  // Member Experience state
  const [welcomeMessage, setWelcomeMessage] = useState("Welcome back, [name]! 👋");
  const [welcomeTagline, setWelcomeTagline] = useState("Your success journey continues today.");
  const [programTabTitle, setProgramTabTitle] = useState("Your Program");
  const [coursesTabTitle, setCoursesTabTitle] = useState("Your Courses");
  const [completionMessage, setCompletionMessage] = useState("Congratulations! You have completed the program.");
  const [certificateSignatory, setCertificateSignatory] = useState("");

  // About Tab Builder state
  const [aboutOverview, setAboutOverview] = useState("");
  const [mentorName, setMentorName] = useState("");
  const [mentorTitle, setMentorTitle] = useState("");
  const [mentorBio, setMentorBio] = useState("");
  const [benefits, setBenefits] = useState<string[]>([]);
  const [faqItems, setFaqItems] = useState<Array<{ question: string; answer: string }>>([]);

  // Preview state
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "tablet" | "desktop">("mobile");

  // Program flow state
  const [registerPageId, setRegisterPageId] = useState<string>("__none__");
  const [memberFunnelId, setMemberFunnelId] = useState<string>("__none__");
  const [coursesFunnelId, setCoursesFunnelId] = useState<string>("__none__");

  // Invite code required
  const [inviteCodeRequired, setInviteCodeRequired] = useState(false);

  // Fetch invite_code_required from platform_settings
  const { data: platformSettings } = useQuery({
    queryKey: ["platform-settings-invite"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "invite_code_required")
        .maybeSingle();
      return data;
    },
  });

  const inviteCodeMutation = useMutation({
    mutationFn: async (required: boolean) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          { key: "invite_code_required", value: required ? "true" : "false" },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings-invite"] });
      toast.success("Invite code setting saved!");
    },
    onError: () => toast.error("Failed to save invite code setting"),
  });

  // Load settings into state
  useEffect(() => {
    if (!settings) return;
    setProgramName(settings.program_name || "");
    setProgramTagline(settings.program_tagline || "");
    setPrimaryColor(settings.primary_color || "#D4AF37");
    setHeroLine1(settings.hero_headline_line1 || "");
    setHeroLine2(settings.hero_headline_line2 || "");
    setHeroSubtext(settings.hero_subtext || "");
    setHeroPill(settings.hero_pill_text || "");
    setShowIntroVideo(settings.show_intro_video_button ?? true);
    setIntroVideoUrl(settings.intro_video_url || "");
    setAboutSectionTitle(settings.about_section_title || "");
    setAboutTitle(settings.about_title || "About the Program");
    setAboutContent(settings.about_content || "");
    setRegisterPageId(settings.active_register_landing_page_id || "__none__");
    setMemberFunnelId(settings.active_member_funnel_id || "__none__");
    setCoursesFunnelId(settings.active_courses_funnel_id || "__none__");
    // New fields
    setWelcomeMessage((settings as any).welcome_message || "Welcome back, [name]! 👋");
    setWelcomeTagline((settings as any).welcome_tagline || "Your success journey continues today.");
    setProgramTabTitle((settings as any).program_tab_title || "Your Program");
    setCoursesTabTitle((settings as any).courses_tab_title || "Your Courses");
    setCompletionMessage((settings as any).completion_message || "Congratulations! You have completed the program.");
    setCertificateSignatory((settings as any).certificate_signatory || "");
    setAboutOverview((settings as any).about_overview_text || "");
    setMentorName((settings as any).mentor_name || "");
    setMentorTitle((settings as any).mentor_title || "");
    setMentorBio((settings as any).mentor_bio || "");
    setBenefits(Array.isArray((settings as any).benefits) ? (settings as any).benefits : []);
    setFaqItems(Array.isArray((settings as any).faq_items) ? (settings as any).faq_items : []);
  }, [settings]);

  useEffect(() => {
    if (platformSettings) {
      setInviteCodeRequired(platformSettings.value === "true");
    }
  }, [platformSettings]);

  // Fetch landing pages and funnels for dropdowns
  const { data: landingPages = [] } = useQuery({
    queryKey: ["admin-landing-pages-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("landing_pages")
        .select("id, title, slug, status")
        .order("title");
      return data || [];
    },
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["admin-funnels-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("funnels")
        .select("id, title, slug, is_published")
        .order("title");
      return data || [];
    },
  });

  const publishedPages = landingPages.filter((p) => p.status === "published");
  const publishedFunnels = funnels.filter((f) => f.is_published);

  const saveBranding = () => {
    updateSettings.mutate({
      program_name: programName,
      program_tagline: programTagline,
      primary_color: primaryColor,
    });
  };

  const saveContent = () => {
    updateSettings.mutate({
      hero_headline_line1: heroLine1,
      hero_headline_line2: heroLine2,
      hero_subtext: heroSubtext,
      hero_pill_text: heroPill,
      show_intro_video_button: showIntroVideo,
      intro_video_url: introVideoUrl || null,
      about_section_title: aboutSectionTitle,
    });
  };

  const saveAboutTab = () => {
    updateSettings.mutate({
      about_title: aboutTitle,
      about_content: aboutContent,
    });
  };

  const saveMemberExperience = () => {
    updateSettings.mutate({
      welcome_message: welcomeMessage,
      welcome_tagline: welcomeTagline,
      program_tab_title: programTabTitle,
      courses_tab_title: coursesTabTitle,
      completion_message: completionMessage,
      certificate_signatory: certificateSignatory,
    } as any);
  };

  const saveAboutTabBuilder = () => {
    updateSettings.mutate({
      about_overview_text: aboutOverview,
      mentor_name: mentorName,
      mentor_title: mentorTitle,
      mentor_bio: mentorBio,
      benefits: benefits,
      faq_items: faqItems,
    } as any);
  };

  const saveRegisterPage = () => {
    updateSettings.mutate({
      active_register_landing_page_id: registerPageId === "__none__" ? null : registerPageId,
    });
  };

  const saveMemberFunnel = () => {
    updateSettings.mutate({
      active_member_funnel_id: memberFunnelId === "__none__" ? null : memberFunnelId,
    });
  };

  const saveCoursesFunnel = () => {
    updateSettings.mutate({
      active_courses_funnel_id: coursesFunnelId === "__none__" ? null : coursesFunnelId,
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      </AdminLayout>
    );
  }

  const selectedPage = landingPages.find((p) => p.id === registerPageId);
  const selectedFunnel = funnels.find((f) => f.id === memberFunnelId);
  const selectedCoursesFunnel = funnels.find((f) => f.id === coursesFunnelId);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-heading font-bold">Program Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your program's branding, landing page content, and member experience.
          </p>
        </div>

        {/* Branding */}
        <section className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold">Branding</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Program Name</Label>
              <Input value={programName} onChange={(e) => setProgramName(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs">Program Tagline</Label>
              <Input value={programTagline} onChange={(e) => setProgramTagline(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Primary Color</Label>
            <div className="flex items-center gap-3 mt-1">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32 bg-muted border-border font-mono text-xs" />
            </div>
          </div>
          <Button variant="hero" size="sm" onClick={saveBranding} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Branding
          </Button>
        </section>

        {/* Landing Page Content */}
        <section className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold">Landing Page Content</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Hero Headline Line 1 (white)</Label>
              <Input value={heroLine1} onChange={(e) => setHeroLine1(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs">Hero Headline Line 2 (gold/accent)</Label>
              <Input value={heroLine2} onChange={(e) => setHeroLine2(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Hero Pill Text</Label>
            <Input value={heroPill} onChange={(e) => setHeroPill(e.target.value)} className="mt-1 bg-muted border-border" placeholder="e.g. PRIVATE MEMBERS COMMUNITY" />
          </div>
          <div>
            <Label className="text-xs">Hero Subtext</Label>
            <Textarea value={heroSubtext} onChange={(e) => setHeroSubtext(e.target.value)} className="mt-1 bg-muted border-border" rows={3} />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={showIntroVideo} onCheckedChange={setShowIntroVideo} />
            <Label className="text-xs">Show "Watch Introduction" button</Label>
          </div>
          {showIntroVideo && (
            <div>
              <Label className="text-xs">Introduction Video URL</Label>
              <Input value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} className="mt-1 bg-muted border-border" placeholder="https://youtube.com/..." />
            </div>
          )}
          <div>
            <Label className="text-xs">About Section Title (Landing Page)</Label>
            <Input value={aboutSectionTitle} onChange={(e) => setAboutSectionTitle(e.target.value)} className="mt-1 bg-muted border-border" />
          </div>
          <Button variant="hero" size="sm" onClick={saveContent} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Content
          </Button>
        </section>

        {/* About Tab Content (for Members) */}
        <section className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-semibold">About Tab</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Content shown to members in the "About" tab of their dashboard.
            </p>
          </div>
          <div>
            <Label className="text-xs">About Tab Title</Label>
            <Input value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} className="mt-1 bg-muted border-border" placeholder="About the Program" />
          </div>
          <div>
            <Label className="text-xs">About Tab Content</Label>
            <Textarea
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              className="mt-1 bg-muted border-border"
              rows={6}
              placeholder="Write about your program here. Supports multiple paragraphs."
            />
          </div>
          <Button variant="hero" size="sm" onClick={saveAboutTab} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save About Content
          </Button>
        </section>

        {/* Program Flow */}
        <section className="glass-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-heading font-semibold">Program Flow</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select which landing page visitors see when they click Register, and which funnels members see.
            </p>
          </div>

          {/* Register Landing Page */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Registration Landing Page</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When a visitor clicks "Register for the Program", they'll be taken to this landing page.</p>
            </div>
            <Select value={registerPageId} onValueChange={setRegisterPageId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select a landing page..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None selected —</SelectItem>
                {publishedPages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title} ({p.slug})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {registerPageId === "__none__" ? (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle size={14} />
                No registration page selected. The Register button will show a "coming soon" message.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle2 size={14} />
                Active: {selectedPage?.title}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="hero" size="sm" onClick={saveRegisterPage} disabled={updateSettings.isPending}>
                Save
              </Button>
              {selectedPage && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/l/${selectedPage.slug}`} target="_blank" rel="noopener">
                    <ExternalLink size={12} className="mr-1" /> Preview
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Member Funnel */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Member Program Funnel</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Content shown in the member's "Program" tab.</p>
            </div>
            <Select value={memberFunnelId} onValueChange={setMemberFunnelId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select a funnel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None selected —</SelectItem>
                {publishedFunnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {memberFunnelId === "__none__" ? (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle size={14} />
                No funnel selected. Members will see an empty Program tab.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle2 size={14} />
                Active: {selectedFunnel?.title}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="hero" size="sm" onClick={saveMemberFunnel} disabled={updateSettings.isPending}>
                Save
              </Button>
              {selectedFunnel && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/f/${selectedFunnel.slug}`} target="_blank" rel="noopener">
                    <ExternalLink size={12} className="mr-1" /> Preview
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Courses Funnel */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Courses Funnel</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Content shown in the member's "Courses" tab.</p>
            </div>
            <Select value={coursesFunnelId} onValueChange={setCoursesFunnelId}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Select a funnel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None selected —</SelectItem>
                {publishedFunnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {coursesFunnelId === "__none__" ? (
              <div className="flex items-center gap-2 text-xs text-warning">
                <AlertTriangle size={14} />
                No funnel selected. Members will see "Courses coming soon."
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-success">
                <CheckCircle2 size={14} />
                Active: {selectedCoursesFunnel?.title}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="hero" size="sm" onClick={saveCoursesFunnel} disabled={updateSettings.isPending}>
                Save
              </Button>
              {selectedCoursesFunnel && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/f/${selectedCoursesFunnel.slug}`} target="_blank" rel="noopener">
                    <ExternalLink size={12} className="mr-1" /> Preview
                  </a>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Registration Settings */}
        <section className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-semibold">Registration Settings</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Control how new members can register for the program.
            </p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Require invite code to register</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When ON, users must enter a valid invite code during signup.
              </p>
            </div>
            <Switch
              checked={inviteCodeRequired}
              onCheckedChange={(checked) => {
                setInviteCodeRequired(checked);
                inviteCodeMutation.mutate(checked);
              }}
            />
          </div>
        </section>

        {/* Member Experience Editor */}
        <section className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-semibold">Member Experience</h2>
            <p className="text-xs text-muted-foreground mt-1">Customise messages and labels members see.</p>
          </div>
          <div>
            <Label className="text-xs">Welcome Message (use [name] for member's first name)</Label>
            <Input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="mt-1 bg-muted border-border" />
            <p className="text-xs text-muted-foreground mt-1">Preview: {welcomeMessage.replace("[name]", "Adarsh")}</p>
          </div>
          <div>
            <Label className="text-xs">Motivational Tagline</Label>
            <Input value={welcomeTagline} onChange={(e) => setWelcomeTagline(e.target.value)} className="mt-1 bg-muted border-border" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Program Tab Title</Label>
              <Input value={programTabTitle} onChange={(e) => setProgramTabTitle(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs">Courses Tab Title</Label>
              <Input value={coursesTabTitle} onChange={(e) => setCoursesTabTitle(e.target.value)} className="mt-1 bg-muted border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Completion Message</Label>
            <Textarea value={completionMessage} onChange={(e) => setCompletionMessage(e.target.value)} className="mt-1 bg-muted border-border" rows={2} />
          </div>
          <div>
            <Label className="text-xs">Certificate Signatory Name</Label>
            <Input value={certificateSignatory} onChange={(e) => setCertificateSignatory(e.target.value)} className="mt-1 bg-muted border-border" placeholder="e.g. Adarsh Jain, Founder" />
          </div>
          <Button variant="hero" size="sm" onClick={saveMemberExperience} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save Member Experience
          </Button>
        </section>

        {/* About Tab Builder */}
        <section className="glass-card p-6 space-y-5">
          <div>
            <h2 className="text-lg font-heading font-semibold">About Tab Builder</h2>
            <p className="text-xs text-muted-foreground mt-1">Structured content for the member About tab.</p>
          </div>

          {/* Overview */}
          <div>
            <Label className="text-xs">Program Overview</Label>
            <Textarea value={aboutOverview} onChange={(e) => setAboutOverview(e.target.value)} className="mt-1 bg-muted border-border" rows={4} placeholder="Write about your program..." />
          </div>

          {/* Mentor */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <Label className="text-sm font-medium">Mentor / Leader</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mentor Name</Label>
                <Input value={mentorName} onChange={(e) => setMentorName(e.target.value)} className="mt-1 bg-muted border-border" />
              </div>
              <div>
                <Label className="text-xs">Mentor Title</Label>
                <Input value={mentorTitle} onChange={(e) => setMentorTitle(e.target.value)} className="mt-1 bg-muted border-border" placeholder="e.g. Founder & Coach" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mentor Bio (max 300 chars)</Label>
              <Textarea value={mentorBio} onChange={(e) => setMentorBio(e.target.value.slice(0, 300))} className="mt-1 bg-muted border-border" rows={2} />
              <span className="text-xs text-muted-foreground">{mentorBio.length}/300</span>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Benefits List</Label>
              {benefits.length < 10 && (
                <Button size="sm" variant="outline" onClick={() => setBenefits([...benefits, ""])} className="gap-1">
                  <Plus size={12} /> Add
                </Button>
              )}
            </div>
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={b}
                  onChange={(e) => {
                    const updated = [...benefits];
                    updated[i] = e.target.value;
                    setBenefits(updated);
                  }}
                  className="bg-muted border-border"
                  placeholder="Benefit text..."
                />
                <Button size="icon" variant="ghost" onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">FAQ Items</Label>
              {faqItems.length < 10 && (
                <Button size="sm" variant="outline" onClick={() => setFaqItems([...faqItems, { question: "", answer: "" }])} className="gap-1">
                  <Plus size={12} /> Add
                </Button>
              )}
            </div>
            {faqItems.map((faq, i) => (
              <div key={i} className="space-y-2 p-3 rounded border border-border bg-background">
                <div className="flex gap-2">
                  <Input
                    value={faq.question}
                    onChange={(e) => {
                      const updated = [...faqItems];
                      updated[i] = { ...faq, question: e.target.value };
                      setFaqItems(updated);
                    }}
                    className="bg-muted border-border"
                    placeholder="Question..."
                  />
                  <Button size="icon" variant="ghost" onClick={() => setFaqItems(faqItems.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <Textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const updated = [...faqItems];
                    updated[i] = { ...faq, answer: e.target.value };
                    setFaqItems(updated);
                  }}
                  className="bg-muted border-border"
                  rows={2}
                  placeholder="Answer..."
                />
              </div>
            ))}
          </div>

          <Button variant="hero" size="sm" onClick={saveAboutTabBuilder} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Save About Tab
          </Button>
        </section>

        {/* Preview */}
        <section className="glass-card p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
              <Eye size={18} /> Member View Preview
            </h2>
            <p className="text-xs text-muted-foreground mt-1">This is exactly what your members see when they log in.</p>
          </div>
          <div className="flex gap-2">
            {[
              { key: "mobile" as const, icon: Smartphone, label: "Mobile", w: 375 },
              { key: "tablet" as const, icon: Tablet, label: "Tablet", w: 768 },
              { key: "desktop" as const, icon: Monitor, label: "Desktop", w: 0 },
            ].map((d) => (
              <Button
                key={d.key}
                size="sm"
                variant={previewDevice === d.key ? "hero" : "outline"}
                onClick={() => setPreviewDevice(d.key)}
                className="gap-1"
              >
                <d.icon size={14} /> {d.label}
              </Button>
            ))}
          </div>
          <div className="flex justify-center">
            <div
              className="rounded-2xl overflow-hidden border border-border shadow-lg"
              style={{
                width: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? 768 : 375,
                maxWidth: "100%",
              }}
            >
              <iframe
                src="/home?preview=true"
                width="100%"
                height={previewDevice === "desktop" ? 700 : previewDevice === "tablet" ? 800 : 700}
                style={{ border: "none" }}
                title="Member Preview"
              />
            </div>
          </div>
          <div className="text-center">
            <a href="/home" target="_blank" rel="noopener" className="text-xs text-primary hover:underline">
              Open in new tab ↗
            </a>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminProgramPage;
