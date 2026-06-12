import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import sipLogo from "@/assets/sip-logo.png";

interface Props {
  getText: (section: string, key: string, fallback?: string) => string;
  registerUrl: string;
}

export const SipHero = ({ getText, registerUrl }: Props) => {
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
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 lg:gap-16">
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
              style={{ filter: "drop-shadow(0 0 30px rgba(197,147,14,0.2))" }}
            />
          </motion.div>

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
              <span style={{ color: "#E8B830" }}>{line2}</span>
            </h1>

            <p
              className="text-sm md:text-base leading-relaxed mb-6 md:mb-8 max-w-xl md:max-w-none"
              style={{ color: "#F5F0E8", opacity: 0.8 }}
            >
              {subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-6 md:mb-8">
              <Link to={registerUrl}>
                <button
                  className="px-8 py-3.5 rounded-lg text-base font-semibold transition-all hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #E8B830, #C99A18)", color: "#000" }}
                >
                  Register for Program →
                </button>
              </Link>
              <Link to="/auth">
                <button
                  className="px-8 py-3.5 rounded-lg text-base font-medium transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(197,147,14,0.4)", color: "#E8B830" }}
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

