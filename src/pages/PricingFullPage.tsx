import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Shield, Loader2, Users, User, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

declare global {
  interface Window { Razorpay: any; }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface FeatureItem {
  text: string;
  enabled: boolean;
  locked?: boolean;
}

const buildFeatureList = (config: any): FeatureItem[] => {
  const items: FeatureItem[] = [];

  // Funnels
  if (config.max_funnels === -1) items.push({ text: "Unlimited Funnels", enabled: true });
  else if (config.max_funnels > 0) items.push({ text: `Up to ${config.max_funnels} Funnels`, enabled: true });
  else items.push({ text: "Funnels", enabled: false });

  // Landing Pages
  if (config.feature_landing_pages && config.max_landing_pages === -1) items.push({ text: "Unlimited Landing Pages", enabled: true });
  else if (config.feature_landing_pages && config.max_landing_pages > 0) items.push({ text: `Up to ${config.max_landing_pages} Landing Pages`, enabled: true });
  else items.push({ text: "Landing Pages", enabled: false });

  // Live Sessions
  if (config.feature_go_live && config.max_live_sessions === -1) items.push({ text: "Unlimited Live Sessions", enabled: true });
  else if (config.feature_go_live && config.max_live_sessions > 0) items.push({ text: `Up to ${config.max_live_sessions} Live Sessions`, enabled: true });
  else items.push({ text: "Live Sessions", enabled: false });

  // Feature flags
  items.push({ text: "Lead Capture", enabled: !!config.feature_lead_capture });
  items.push({ text: "Analytics", enabled: !!config.feature_analytics });
  items.push({ text: "WhatsApp Automation", enabled: !!config.feature_whatsapp_automation });

  if (config.multilevel_funnel_enabled) items.push({ text: "Multi-level Funnels", enabled: true });
  else items.push({ text: "Multi-level Funnels", enabled: false, locked: true });

  if (config.feature_team_members !== false && config.max_team_members !== 0) {
    if (config.max_team_members === -1) items.push({ text: "Unlimited Team Members", enabled: true });
    else if (config.max_team_members > 0) items.push({ text: `Team Members (up to ${config.max_team_members})`, enabled: true });
    else items.push({ text: "Team Members", enabled: false, locked: true });
  } else {
    items.push({ text: "Team Members", enabled: false, locked: true });
  }

  if (config.feature_team_analytics) items.push({ text: "Team Analytics Dashboard", enabled: true });
  else items.push({ text: "Team Analytics", enabled: false, locked: true });

  if (config.feature_video_sharing) items.push({ text: "Video Sharing", enabled: true });
  if (config.feature_advanced_analytics) items.push({ text: "Advanced Analytics", enabled: true });
  if (config.feature_priority_support) items.push({ text: "Priority Support", enabled: true });

  return items;
};

const FeatureRow = ({ item }: { item: FeatureItem }) => {
  if (item.enabled) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <Check size={14} className="text-primary shrink-0" /> {item.text}
      </li>
    );
  }
  if (item.locked) {
    return (
      <li className="flex items-center gap-2 text-sm text-muted-foreground/60">
        <Lock size={14} className="shrink-0" /> {item.text}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground/60">
      <X size={14} className="shrink-0" /> {item.text}
    </li>
  );
};

const ComparisonCell = ({ value }: { value: boolean | string }) => {
  if (typeof value === "string") {
    return <span className="text-muted-foreground">{value}</span>;
  }
  return value
    ? <Check size={16} className="text-primary mx-auto" />
    : <X size={16} className="text-muted-foreground/40 mx-auto" />;
};

const PricingFullPage = () => {
  const { user, profile } = useAuth();
  const { plan, refreshPlan } = usePlan();
  const { openSupport } = useWhatsAppSupport();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const { data: planConfigs = [] } = useQuery({
    queryKey: ["plan-configs"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_config").select("*");
      return (data || []) as any[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const basicConfig = planConfigs.find((c: any) => c.plan_name === "basic");
  const proConfig = planConfigs.find((c: any) => c.plan_name === "pro");
  const basicEnabled = basicConfig?.is_enabled !== false;
  const proEnabled = proConfig?.is_enabled !== false;

  const getPrice = (config: any) => {
    if (!config) return 0;
    return billing === "monthly" ? config.monthly_price : config.yearly_price;
  };

  const getSavings = (config: any) => {
    if (!config) return 0;
    return config.monthly_price * 12 - config.yearly_price;
  };

  const handlePayment = useCallback(async (planName: string) => {
    if (!user) {
      navigate("/auth?tab=signup&redirect=/pricing");
      return;
    }
    const config = planConfigs.find((c: any) => c.plan_name === planName);
    if (!config) return;

    const amount = billing === "monthly" ? config.monthly_price : config.yearly_price;
    const planKey = `${planName}_${billing}`;

    setLoading(planKey);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error("Failed to load payment gateway");

      const { data, error } = await supabase.functions.invoke("razorpay-portal", {
        body: { action: "create_order", amount, plan_key: planKey },
      });
      if (error || !data?.order_id) throw new Error(error?.message || "Failed to create order");

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Smart Income Program",
        description: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan — ${billing}`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke("razorpay-portal", {
              body: {
                action: "verify_payment",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_key: planKey,
              },
            });
            if (verifyError) throw verifyError;
            toast.success(`Payment successful! Welcome to ${planName.charAt(0).toUpperCase() + planName.slice(1)} 🎉`);
            refreshPlan();
            setTimeout(() => navigate("/dashboard"), 1500);
          } catch {
            toast.error("Payment received but verification pending. Contact support.");
            openSupport("Hi, my payment was successful but access not unlocked. Payment ID: " + response.razorpay_payment_id);
          }
        },
        prefill: {
          name: profile?.full_name || "",
          email: user.email,
          contact: profile?.phone || "",
        },
        theme: { color: "#2563EB" },
        modal: { ondismiss: () => setLoading(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again or use a different payment method.");
        setLoading(null);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(null);
    }
  }, [user, profile, navigate, openSupport, refreshPlan, billing, planConfigs]);

  const isCurrentTier = (t: string) => plan.isPaid && plan.tier === t && !plan.isExpired;

  // Dynamic comparison table
  const buildComparisonRows = () => {
    const limitDisplay = (val: number | undefined) => {
      if (val === undefined || val === null) return "—";
      if (val === -1) return "Unlimited";
      if (val === 0) return "—";
      return String(val);
    };

    const rows: { name: string; free: boolean | string; basic: boolean | string; pro: boolean | string }[] = [
      { name: "Funnels", free: "0 (view only)", basic: limitDisplay(basicConfig?.max_funnels), pro: limitDisplay(proConfig?.max_funnels) },
      { name: "Landing Pages", free: "—", basic: basicConfig?.feature_landing_pages ? limitDisplay(basicConfig?.max_landing_pages) : "—", pro: proConfig?.feature_landing_pages ? limitDisplay(proConfig?.max_landing_pages) : "—" },
      { name: "Live Sessions", free: "—", basic: basicConfig?.feature_go_live ? limitDisplay(basicConfig?.max_live_sessions) : "—", pro: proConfig?.feature_go_live ? limitDisplay(proConfig?.max_live_sessions) : "—" },
      { name: "Lead Capture", free: false, basic: !!basicConfig?.feature_lead_capture, pro: !!proConfig?.feature_lead_capture },
      { name: "Analytics", free: false, basic: !!basicConfig?.feature_analytics, pro: !!proConfig?.feature_analytics },
      { name: "WhatsApp Automation", free: false, basic: !!basicConfig?.feature_whatsapp_automation, pro: !!proConfig?.feature_whatsapp_automation },
      { name: "Multi-level Funnels", free: false, basic: !!basicConfig?.multilevel_funnel_enabled, pro: !!proConfig?.multilevel_funnel_enabled },
      { name: "Team Members", free: false, basic: false, pro: proConfig?.max_team_members === -1 ? true : (proConfig?.max_team_members > 0 ? `Up to ${proConfig?.max_team_members}` : false) },
      { name: "Video Sharing", free: false, basic: !!basicConfig?.feature_video_sharing, pro: !!proConfig?.feature_video_sharing },
      { name: "Advanced Analytics", free: false, basic: !!basicConfig?.feature_advanced_analytics, pro: !!proConfig?.feature_advanced_analytics },
      { name: "Priority Support", free: false, basic: !!basicConfig?.feature_priority_support, pro: !!proConfig?.feature_priority_support },
      { name: "Team Analytics", free: false, basic: !!basicConfig?.feature_team_analytics, pro: !!proConfig?.feature_team_analytics },
    ];
    return rows;
  };

  const enabledPlans = [basicEnabled, proEnabled].filter(Boolean).length;
  const gridCols = enabledPlans === 0 ? "max-w-md mx-auto" : enabledPlans === 1 ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3 max-w-5xl mx-auto";

  const basicFeatures = basicConfig ? buildFeatureList(basicConfig) : [];
  const proFeatures = proConfig ? buildFeatureList(proConfig) : [];

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Choose Your <span className="gradient-text">Growth Plan</span>
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Start free, scale as you grow.{basicEnabled && " Basic for individuals."}{proEnabled && " Pro for your whole team."}
            </p>
            {plan.isExpired && (
              <p className="text-sm text-destructive font-medium">Your plan has expired. Renew to restore access.</p>
            )}
          </motion.div>

          {/* Billing toggle */}
          {(basicEnabled || proEnabled) && (
            <div className="flex items-center justify-center gap-3 mb-10">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${billing === "yearly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                Yearly
                {(() => {
                  const refConfig = basicEnabled ? basicConfig : proConfig;
                  if (refConfig && refConfig.monthly_price > 0) {
                    const pct = Math.round((1 - refConfig.yearly_price / (refConfig.monthly_price * 12)) * 100);
                    if (pct > 0) return (
                      <span className="absolute -top-2 -right-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        Save {pct}%
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            </div>
          )}

          <div className={`grid gap-6 mb-16 ${gridCols}`}>
            {/* Free */}
            <motion.div className="glass-card p-6 flex flex-col" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Free</span>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className="text-3xl font-heading font-bold">₹0</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">View-only, forever free</p>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {["View shared funnels", "Access public content", "Browse marketplace"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm"><Check size={14} className="text-primary shrink-0" /> {f}</li>
                ))}
                {["Create funnels", "Create landing pages", "Go live", "Lead capture"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground/60"><X size={14} className="shrink-0" /> {f}</li>
                ))}
              </ul>
              {!plan.isPaid && !plan.isExpired ? (
                <Button variant="outline" disabled className="w-full">Current Plan</Button>
              ) : (
                <Button variant="outline" onClick={() => navigate(user ? "/dashboard" : "/auth?tab=signup")} className="w-full">
                  {user ? "Stay Free" : "Get Started"}
                </Button>
              )}
            </motion.div>

            {/* Basic */}
            {basicEnabled && basicConfig && (
              <motion.div className="glass-card p-6 flex flex-col relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                {basicConfig.plan_badge_text && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-card border border-border text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                    <User size={12} /> {basicConfig.plan_badge_text}
                  </div>
                )}
                <div className="mb-6">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium">Basic</span>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-heading font-bold">₹{getPrice(basicConfig).toLocaleString("en-IN")}</span>
                    <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  {billing === "monthly" && getSavings(basicConfig) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      or ₹{basicConfig.yearly_price.toLocaleString("en-IN")}/year — save ₹{getSavings(basicConfig).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {basicFeatures.map((item, i) => <FeatureRow key={i} item={item} />)}
                </ul>
                {isCurrentTier("basic") ? (
                  <Button disabled className="w-full">Current Plan</Button>
                ) : (
                  <Button className="w-full gap-2" onClick={() => handlePayment("basic")} disabled={loading === `basic_${billing}`}>
                    {loading === `basic_${billing}` ? <Loader2 size={16} className="animate-spin" /> : null}
                    Subscribe — ₹{getPrice(basicConfig).toLocaleString("en-IN")}/{billing === "monthly" ? "mo" : "yr"}
                  </Button>
                )}
              </motion.div>
            )}

            {/* Pro */}
            {proEnabled && proConfig && (
              <motion.div className="glass-card p-6 flex flex-col relative border-primary/40 glow-primary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                {proConfig.plan_badge_text && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground flex items-center gap-1 whitespace-nowrap">
                    <Users size={12} /> {proConfig.plan_badge_text}
                  </div>
                )}
                <div className="mb-6">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium">Pro</span>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-heading font-bold">₹{getPrice(proConfig).toLocaleString("en-IN")}</span>
                    <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  {billing === "monthly" && getSavings(proConfig) > 0 && (
                    <p className="text-xs text-primary mt-1">
                      or ₹{proConfig.yearly_price.toLocaleString("en-IN")}/year — save ₹{getSavings(proConfig).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {proFeatures.map((item, i) => <FeatureRow key={i} item={item} />)}
                </ul>
                {isCurrentTier("pro") ? (
                  <Button disabled className="w-full">Current Plan</Button>
                ) : (
                  <Button className="w-full gap-2" onClick={() => handlePayment("pro")} disabled={loading === `pro_${billing}`}>
                    {loading === `pro_${billing}` ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
                    Subscribe — ₹{getPrice(proConfig).toLocaleString("en-IN")}/{billing === "monthly" ? "mo" : "yr"}
                  </Button>
                )}
              </motion.div>
            )}
          </div>

          {/* Dynamic comparison table */}
          <div className="glass-card overflow-hidden max-w-5xl mx-auto mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium">Feature</th>
                    <th className="text-center p-4 font-medium">Free</th>
                    {basicEnabled && <th className="text-center p-4 font-medium">Basic</th>}
                    {proEnabled && <th className="text-center p-4 font-medium text-primary">Pro</th>}
                  </tr>
                </thead>
                <tbody>
                  {buildComparisonRows().map((row) => (
                    <tr key={row.name} className="border-b border-border/50">
                      <td className="p-4">{row.name}</td>
                      <td className="p-4 text-center"><ComparisonCell value={row.free} /></td>
                      {basicEnabled && <td className="p-4 text-center"><ComparisonCell value={row.basic} /></td>}
                      {proEnabled && <td className="p-4 text-center"><ComparisonCell value={row.pro} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="max-w-lg mx-auto text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield size={16} /> Secure payments via Razorpay
            </div>
            <p className="text-sm text-muted-foreground">
              Need help choosing a plan?{" "}
              <button className="text-primary underline" onClick={() => openSupport("Hi, I need help choosing a Smart Income Program plan.")}>
                Chat with us on WhatsApp
              </button>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PricingFullPage;
