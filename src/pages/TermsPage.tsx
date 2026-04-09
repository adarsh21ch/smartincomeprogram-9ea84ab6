import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { motion } from "framer-motion";

const sections = [
  {
    title: "Acceptance of Terms",
    content: "By accessing or using Smart Income Program, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.",
  },
  {
    title: "Use of the Platform",
    content: "Smart Income Program provides video funnel creation, lead capture, and viewer tracking tools. You may use the platform for lawful business purposes in accordance with these terms.",
  },
  {
    title: "User Responsibilities",
    content: "You are responsible for maintaining the security of your account and for all activities under your account. You agree not to upload harmful, illegal, or infringing content.",
  },
  {
    title: "Account Access",
    content: "You must provide accurate information when creating an account. We reserve the right to suspend or terminate accounts that violate these terms.",
  },
  {
    title: "Content and Ownership",
    content: "You retain ownership of all content you upload to Smart Income Program. By uploading content, you grant us a limited license to host and display it as part of the service.",
  },
  {
    title: "Payments and Billing",
    content: "Paid plans are billed on a recurring basis. You agree to pay all fees associated with your chosen plan. Prices may change with prior notice.",
  },
  {
    title: "Limitation of Liability",
    content: "Smart Income Program is provided \"as is\" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.",
  },
  {
    title: "Changes to Terms",
    content: "We may update these Terms of Service from time to time. Continued use of the platform after changes constitutes acceptance of the revised terms.",
  },
  {
    title: "Contact Information",
    content: "For questions about these terms, please contact us at support@smartincomeprogram.com.",
  },
];

const TermsPage = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Terms of Service</h1>
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

export default TermsPage;
