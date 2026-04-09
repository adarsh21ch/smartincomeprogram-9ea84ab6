import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const sections = [
  {
    title: "Subscription Fees",
    content: "Subscription fees are generally non-refundable once a billing cycle has begun. We encourage users to try the free plan before upgrading to a paid plan.",
  },
  {
    title: "Accidental or Duplicate Charges",
    content: "If you believe you were charged by mistake or received a duplicate charge, please contact our support team within 7 days. We will review the case and process a refund if applicable.",
  },
  {
    title: "Refund Process",
    content: "Refunds, if approved, are handled on a case-by-case basis. Approved refunds are typically processed within 7–10 business days to the original payment method.",
  },
  {
    title: "Cancellation",
    content: "You can cancel your subscription at any time from your account settings. After cancellation, you will continue to have access until the end of your current billing period.",
  },
  {
    title: "Contact Support",
    content: "For any billing or refund inquiries, please reach out to us at support@smartincomeprogram.com. We're happy to help resolve any issues.",
  },
];

const RefundPolicyPage = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Refund Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: April 2026</p>
          </motion.div>
          <div className="space-y-8">
            {sections.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <h2 className="text-lg font-heading font-semibold mb-2">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default RefundPolicyPage;
