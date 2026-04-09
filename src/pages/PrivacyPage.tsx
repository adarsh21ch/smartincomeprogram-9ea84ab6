import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const sections = [
  {
    title: "Information We Collect",
    content: "We collect information you provide directly — such as your name, email address, phone number, and any content you upload. We also collect usage data automatically, including pages visited, videos played, and device information.",
  },
  {
    title: "How We Use Your Information",
    content: "We use your information to provide and improve Smart Income Program, communicate with you, process transactions, and personalize your experience. We do not sell your personal data to third parties.",
  },
  {
    title: "Cookies and Analytics",
    content: "We use cookies and similar technologies to understand how you interact with our platform, remember your preferences, and improve our services. You can manage cookie preferences through your browser settings.",
  },
  {
    title: "Data Security",
    content: "We implement industry-standard security measures to protect your data, including encryption in transit and at rest. However, no method of transmission over the internet is 100% secure.",
  },
  {
    title: "Third-Party Services",
    content: "We may use third-party services for analytics, payment processing, and communication. These services have their own privacy policies and we encourage you to review them.",
  },
  {
    title: "User Rights",
    content: "You have the right to access, correct, or delete your personal data at any time. You can also request a copy of your data or ask us to stop processing it by contacting our support team.",
  },
  {
    title: "Contact Us",
    content: "If you have questions about this Privacy Policy or your data, please contact us at support@smartincomeprogram.com.",
  },
];

const PrivacyPage = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Privacy Policy</h1>
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

export default PrivacyPage;
