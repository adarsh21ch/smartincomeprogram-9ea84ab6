import { useSipLandingData } from "@/hooks/useSipLandingData";
import { SipNavbar } from "@/components/sip-landing/SipNavbar";
import { SipHero } from "@/components/sip-landing/SipHero";
import { SipAbout } from "@/components/sip-landing/SipAbout";
import { SipSpeakers } from "@/components/sip-landing/SipSpeakers";
import { SipJourney } from "@/components/sip-landing/SipJourney";
import { SipCommunity } from "@/components/sip-landing/SipCommunity";
import { SipTestimonials } from "@/components/sip-landing/SipTestimonials";
import { SipFaq } from "@/components/sip-landing/SipFaq";
import { SipCta } from "@/components/sip-landing/SipCta";
import { SipDisclaimer } from "@/components/sip-landing/SipDisclaimer";
import { SipFooter } from "@/components/sip-landing/SipFooter";
import { InstallAppBanner } from "@/components/InstallAppBanner";

const Index = () => {
  const { getText, speakers, testimonials, journeySteps, faqItems, isLoading } = useSipLandingData();

  return (
    <div className="sip-landing min-h-screen">
      <SipNavbar />
      {isLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <SipHero getText={getText} />
          <SipAbout getText={getText} />
          <SipSpeakers getText={getText} speakers={speakers} />
          <SipJourney getText={getText} steps={journeySteps} />
          <SipCommunity getText={getText} />
          <SipTestimonials getText={getText} testimonials={testimonials} />
          <SipFaq getText={getText} faqItems={faqItems} />
          <SipCta getText={getText} />
          <SipDisclaimer getText={getText} />
          <SipFooter getText={getText} />
        </>
      )}
      <InstallAppBanner />
    </div>
  );
};

export default Index;
