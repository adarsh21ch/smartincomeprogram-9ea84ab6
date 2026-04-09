import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What is Smart Income Program?",
    a: "Smart Income Program is a smart video funnel platform for digital entrepreneurs, creators, and coaches. Upload a video, share a link, and automatically capture leads, track engagement, and guide your audience.",
  },
  {
    q: "Do I need any technical skills?",
    a: "Not at all! Smart Income Program is designed for non-technical users. Just upload your video, configure your funnel in a few clicks, and share the link. It's that simple.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! You can start with our free plan — 2 funnels, 5 videos, and basic lead capture. Upgrade anytime when you're ready for more.",
  },
  {
    q: "Who is Smart Income Program for?",
    a: "Smart Income Program is built for digital entrepreneurs, creators, coaches, educators, and anyone who uses video to grow their audience and business.",
  },
  {
    q: "Can I track how much of a video someone watched?",
    a: "Yes! You get viewer progress tracking — see who watched, how far they got, and where they dropped off. This helps you follow up with the right people.",
  },
  {
    q: "Can I create step-by-step funnels?",
    a: "Absolutely! Turn a single video into a multi-step guided journey with unlock rules, progression, and structured viewer flow.",
  },
  {
    q: "Can my team use this too?",
    a: "Yes! Each team member creates their own account and funnels. On Pro plan, you can even share videos with your team members.",
  },
  {
    q: "What if I need help?",
    a: "We offer priority WhatsApp support for all paid plans. Free users can reach us via email. We're here to help you succeed.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-24">
      <div className="container max-w-3xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="glass-card px-6 border-white/[0.06]"
              >
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
