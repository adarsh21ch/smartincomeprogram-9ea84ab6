import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2 } from "lucide-react";

interface AboutTabProps {
  settings: {
    about_title?: string;
    about_content?: string;
    about_overview_text?: string;
    mentor_name?: string;
    mentor_title?: string;
    mentor_bio?: string;
    mentor_photo_url?: string | null;
    benefits?: any;
    faq_items?: any;
  } | null;
}

export const AboutTab = ({ settings }: AboutTabProps) => {
  if (!settings) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">About content coming soon. Check back later.</p>
      </div>
    );
  }

  const aboutTitle = settings.about_title || "About the Program";
  const overviewText = settings.about_overview_text || settings.about_content || "";
  const mentorName = settings.mentor_name || "";
  const mentorTitle = settings.mentor_title || "";
  const mentorBio = settings.mentor_bio || "";
  const mentorPhoto = settings.mentor_photo_url;
  const benefits: string[] = Array.isArray(settings.benefits) ? settings.benefits : [];
  const faqItems: Array<{ question: string; answer: string }> = Array.isArray(settings.faq_items) ? settings.faq_items : [];

  const hasAnyContent = overviewText || mentorName || benefits.length > 0 || faqItems.length > 0;

  if (!hasAnyContent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-heading font-bold">{aboutTitle}</h1>
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">About content coming soon. Check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Overview */}
      {overviewText && (
        <section className="space-y-3">
          <h1 className="text-2xl font-heading font-bold">{aboutTitle}</h1>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {overviewText.split("\n").filter(Boolean).map((line: string, i: number) => (
              <p key={i} className="text-muted-foreground leading-relaxed">{line}</p>
            ))}
          </div>
        </section>
      )}

      {/* Mentor Card */}
      {mentorName && (
        <section className="glass-card p-6">
          <div className="flex items-start gap-4">
            {mentorPhoto ? (
              <img src={mentorPhoto} alt={mentorName} className="w-20 h-20 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                {mentorName[0]}
              </div>
            )}
            <div>
              <h3 className="font-heading font-semibold text-lg">{mentorName}</h3>
              {mentorTitle && <p className="text-sm text-primary">{mentorTitle}</p>}
              {mentorBio && <p className="text-sm text-muted-foreground mt-2">{mentorBio}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Benefits */}
      {benefits.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">What you'll get</h2>
          <div className="space-y-2">
            {benefits.map((benefit: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-heading font-semibold">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqItems.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="glass-card px-4 border-none">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-3">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-3">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}
    </div>
  );
};
