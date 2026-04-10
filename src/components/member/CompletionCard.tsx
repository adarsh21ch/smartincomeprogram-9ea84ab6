import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CompletionCardProps {
  funnelId: string;
  programName: string;
  completionMessage: string;
  signatory: string;
  totalSteps: number;
}

export const CompletionCard = ({
  funnelId,
  programName,
  completionMessage,
  signatory,
  totalSteps,
}: CompletionCardProps) => {
  const { profile } = useAuth();
  const memberName = profile?.full_name || "Member";
  const [certificateIssued, setCertificateIssued] = useState(false);
  const [issueDate, setIssueDate] = useState<string | null>(null);

  useEffect(() => {
    const issueCertificate = async () => {
      if (!profile?.id) return;
      try {
        // Check if already issued
        const { data: existing } = await supabase
          .from("member_certificates" as any)
          .select("id, issued_at")
          .eq("member_id", profile.id)
          .eq("funnel_id", funnelId)
          .maybeSingle();

        if (existing) {
          setCertificateIssued(true);
          setIssueDate((existing as any).issued_at);
          return;
        }

        // Issue new certificate
        const { error } = await supabase.from("member_certificates" as any).insert({
          member_id: profile.id,
          funnel_id: funnelId,
          member_name: memberName,
          program_name: programName,
          signatory: signatory || null,
        });

        if (!error) {
          setCertificateIssued(true);
          setIssueDate(new Date().toISOString());
        }
      } catch (e) {
        // silent
      }
    };
    issueCertificate();
  }, [profile?.id, funnelId, memberName, programName, signatory]);

  const handleDownload = () => {
    const el = document.getElementById("certificate-card");
    if (!el) { toast.error("Download failed. Try again."); return; }
    // Use browser print as fallback — simple and reliable
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Download failed. Try again."); return; }
    printWindow.document.write(`
      <html><head><title>Certificate</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#faf8f0;font-family:Georgia,serif;}</style></head>
      <body>${el.outerHTML}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const displayDate = issueDate
    ? new Date(issueDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Confetti animation */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card p-6 text-center">
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 40}%`,
                backgroundColor: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"][i % 5],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground relative">🎉 You've completed the program!</h2>
        <p className="text-muted-foreground mt-2 relative">
          {completionMessage.replace("[name]", memberName).replace("[X]", String(totalSteps))}
        </p>
      </div>

      {/* Certificate */}
      <div
        id="certificate-card"
        className="mx-auto max-w-lg bg-[#faf8f0] text-[#1a1a1a] rounded-xl border-4 border-[#D4AF37] p-8 text-center space-y-4"
        style={{ fontFamily: "Georgia, serif" }}
      >
        <div className="text-xs uppercase tracking-[0.3em] text-[#888]">Certificate of Completion</div>
        <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto" />
        <p className="text-sm text-[#666]">This certifies that</p>
        <h3 className="text-2xl font-bold text-[#1a1a1a]">{memberName}</h3>
        <p className="text-sm text-[#666]">has successfully completed</p>
        <h4 className="text-lg font-semibold text-[#D4AF37]">{programName}</h4>
        <p className="text-xs text-[#888] pt-4">Date: {displayDate}</p>
        {signatory && (
          <div className="pt-4 border-t border-[#ddd]">
            <p className="text-sm italic text-[#555]">{signatory}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="hero" onClick={handleDownload}>Download Certificate</Button>
        <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          Rewatch from beginning
        </Button>
      </div>
    </div>
  );
};
