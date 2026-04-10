import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useProgramSettings } from "@/hooks/useProgramSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import sipLogo from "@/assets/sip-logo.png";

interface Props {
  getText: (section: string, key: string, fallback?: string) => string;
}

export const SipHero = ({ getText }: Props) => {
  const { settings } = useProgramSettings();
  const badge = getText("hero", "badge_text", "SMART INCOME PROGRAM");
  const line1 = getText("hero", "headline_line1", "Build Your Income.");
  const line2 = getText("hero", "headline_line2", "Build Your Future.");
  const subtitle = getText("hero", "subtitle", "A structured learning and growth platform for driven individuals.");
  const trust1 = getText("hero", "trust_1", "🔒 Private Community");
  const trust2 = getText("hero", "trust_2", "📚 Structured Learning");
  const trust3 = getText("hero", "trust_3", "🏆 Proven System");

  return (
    <section className="sip-hero-bg min-h-[calc(100vh-4rem)] flex items-center justify-center pt-16">
      <div className="container py-10 md:py-16 lg:py-20">
        {/* Desktop: two-column | Mobile: single column centered */}
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 lg:gap-16">
          {/* Left — Large Logo (desktop only visible large, mobile smaller) */}
          <motion.div
            className="flex-shrink-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }}
          >
            <img
              src={sipLogo}
              alt="Smart Income Program"
              width={512}
              height={512}
              className="w-20 h-20 md:w-48 md:h-48 lg:w-64 lg:h-64 xl:w-72 xl:h-72 object-contain drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 0 30px rgba(212,160,23,0.2))" }}
            />
          </motion.div>

          {/* Right — Content */}
          <motion.div
            className="flex-1 text-center md:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <span className="sip-gold-badge mb-4 md:mb-6 inline-block">{badge}</span>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {line1}
              <br />
              <span style={{ color: "#D4A017" }}>{line2}</span>
            </h1>

            <p
              className="text-sm md:text-base leading-relaxed mb-6 md:mb-8 max-w-xl md:max-w-none"
              style={{ color: "#F5F0E8", opacity: 0.8 }}
            >
              {subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-6 md:mb-8">
              <RegisterButton settings={settings} />
              <Link to="/auth">
                <button
                  className="px-8 py-3.5 rounded-lg text-base font-medium transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(212,160,23,0.4)", color: "#F0C040" }}
                >
                  Login / Sign Up
                </button>
              </Link>
            </div>

            <div className="sip-gold-divider max-w-xs mx-auto md:mx-0 mb-4" />

            <div className="flex flex-wrap justify-center md:justify-start gap-6 md:gap-10">
              {[trust1, trust2, trust3].map((t, i) => (
                <span key={i} className="text-sm" style={{ color: "#888" }}>
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const RegisterButton = ({ settings }: { settings: any }) => {
  const { data: page } = useRegisterPage(settings?.active_register_landing_page_id);

  const url = page?.slug ? `/l/${page.slug}` : "/auth?tab=signup";

  return (
    <Link to={url}>
      <button
        className="px-8 py-3.5 rounded-lg text-base font-semibold transition-all hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #D4A017, #A07810)", color: "#000" }}
      >
        Register for Program →
      </button>
    </Link>
  );
};

const useRegisterPage = (pageId: string | null | undefined) => {
  return useQuery({
    queryKey: ["register-page-slug", pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const { data } = await supabase
        .from("landing_pages")
        .select("slug")
        .eq("id", pageId)
        .single();
      return data;
    },
    enabled: !!pageId,
  });
};
