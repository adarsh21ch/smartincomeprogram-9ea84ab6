import { BookOpen, Sparkles, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppSupport } from "@/hooks/useWhatsAppSupport";
import { toast } from "sonner";

interface CourseCard {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  badge_text: string;
  display_order: number;
  is_active: boolean;
}

export const CoursesTab = () => {
  const { supportPhone } = useWhatsAppSupport();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["course-cards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_cards" as any)
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return (data as any as CourseCard[]) || [];
    },
  });

  const handleAskMentor = (title: string) => {
    const phone = supportPhone?.replace(/[^0-9]/g, "") || "";
    const message = `Hi, I'd like to get access to ${title} on Smart Income Program.`;
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      toast.info("Contact your mentor directly for access to this training.");
    }
  };

  // Fallback: no active cards
  if (!isLoading && cards.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-heading font-bold">Courses</h1>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border bg-card p-8 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <BookOpen size={28} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-heading font-semibold text-foreground">
              More Learning Content Coming Soon!
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              We're preparing exclusive courses to help you grow even faster. Stay tuned for updates.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs text-primary font-medium">Coming soon</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-heading font-bold text-foreground">Courses & Trainings</h1>
        <p className="text-sm text-muted-foreground mt-1">Unlock exclusive training programs as you grow.</p>
      </div>

      {/* Unlock info banner */}
      <div className="rounded-xl border p-4 flex gap-3" style={{ background: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.2)" }}>
        <Lock size={18} className="text-primary shrink-0 mt-0.5" />
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          These trainings are unlocked by your mentor based on your rank and progress. Contact your mentor or upline to get access to the courses you qualify for.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="rounded-2xl p-5 border transition-all duration-200 hover:-translate-y-0.5 group"
            style={{
              background: "hsl(var(--card))",
              borderColor: "rgba(255,255,255,0.07)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
          >
            {/* Top row: icon + badge */}
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: "rgba(212,175,55,0.1)" }}>
                {card.icon}
              </div>
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full border" style={{ color: "rgb(212,175,55)", borderColor: "rgba(212,175,55,0.3)" }}>
                <Lock size={10} className="inline mr-1 -mt-px" />
                {card.badge_text}
              </span>
            </div>

            {/* Title + description */}
            <h3 className="text-base font-semibold text-foreground mb-1">{card.title}</h3>
            {card.description && (
              <p className="text-[13px] text-muted-foreground line-clamp-2 mb-4">{card.description}</p>
            )}

            {/* Lock footer */}
            <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => handleAskMentor(card.title)}
                className="flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer hover:opacity-80"
                style={{ color: "rgba(212,175,55,0.8)" }}
              >
                <Lock size={12} />
                Ask your mentor for access
                <ArrowRight size={12} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom note */}
      <p className="text-center text-xs text-muted-foreground pt-2">
        Your mentor will verify your eligibility and grant access.
      </p>
    </div>
  );
};
