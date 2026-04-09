import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface Props {
  getText: (section: string, key: string, fallback?: string) => string;
}

export const SipCommunity = ({ getText }: Props) => {
  const heading = getText("community", "heading", "A Private Community Built for Growth");
  const body = getText("community", "body", "");
  const ctaText = getText("community", "cta_text", "Join the Community →");
  const ctaUrl = getText("community", "cta_url", "/auth?tab=signup");

  const features = [1, 2, 3].map((n) => ({
    icon: getText("community", `feature_${n}_icon`, ""),
    title: getText("community", `feature_${n}_title`, ""),
    desc: getText("community", `feature_${n}_desc`, ""),
  }));

  return (
    <section className="sip-community-bg py-20 md:py-28 relative">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,160,23,0.3), transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,160,23,0.3), transparent)" }}
      />

      <div className="container text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
            {heading}
          </h2>
          {body && (
            <p className="text-base leading-relaxed mb-12 max-w-2xl mx-auto" style={{ color: "#F5F0E8", opacity: 0.7 }}>
              {body}
            </p>
          )}
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          {features.filter(f => f.title).map((f, i) => (
            <motion.div
              key={i}
              className="sip-card p-6 text-center"
              style={{ borderRadius: "16px", background: "rgba(17,17,17,0.8)" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h4 className="text-sm font-semibold text-white mb-2">{f.title}</h4>
              <p className="text-xs" style={{ color: "#888" }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <a href="https://smartincomeprogram.in/l/smart-income-program">
          <button
            className="px-8 py-3.5 rounded-lg text-base font-semibold transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #D4A017, #A07810)", color: "#000" }}
          >
            {ctaText}
          </button>
        </a>
      </div>
    </section>
  );
};
