import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SipConfig {
  section: string;
  key: string;
  value_text: string;
  value_image_url: string;
  value_boolean: boolean;
  value_number: number;
  value_json: any;
}

export interface SipSpeaker {
  id: string;
  name: string;
  title: string;
  bio: string;
  photo_url: string;
  achievements: string[];
  instagram_url: string;
  youtube_url: string;
  display_order: number;
}

export interface SipTestimonial {
  id: string;
  name: string;
  location: string;
  role: string;
  quote: string;
  photo_url: string;
  rating: number;
  display_order: number;
}

export interface SipJourneyStep {
  id: string;
  step_number: number;
  icon: string;
  title: string;
  description: string;
  display_order: number;
}

export interface SipFaqItem {
  id: string;
  question: string;
  answer: string;
  display_order: number;
}

export const useSipLandingData = () => {
  const configQuery = useQuery({
    queryKey: ["sip-landing-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sip_landing_page_config")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as SipConfig[];
    },
    staleTime: 60000,
  });

  const speakersQuery = useQuery({
    queryKey: ["sip-speakers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sip_speakers")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SipSpeaker[];
    },
    staleTime: 60000,
  });

  const testimonialsQuery = useQuery({
    queryKey: ["sip-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sip_testimonials")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SipTestimonial[];
    },
    staleTime: 60000,
  });

  const journeyQuery = useQuery({
    queryKey: ["sip-journey-steps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sip_journey_steps")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SipJourneyStep[];
    },
    staleTime: 60000,
  });

  const faqQuery = useQuery({
    queryKey: ["sip-faq-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sip_faq_items")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as SipFaqItem[];
    },
    staleTime: 60000,
  });

  // Resolve the public Register landing page URL once so CTAs never
  // race-fall back to /auth.
  const registerPageQuery = useQuery({
    queryKey: ["sip-register-page-url"],
    queryFn: async () => {
      const { data: settings } = await supabase
        .from("program_settings")
        .select("active_register_landing_page_id")
        .limit(1)
        .maybeSingle();
      const pageId = settings?.active_register_landing_page_id;
      if (!pageId) return null;
      const { data: page } = await supabase
        .from("landing_pages")
        .select("slug")
        .eq("id", pageId)
        .eq("status", "published")
        .maybeSingle();
      return page?.slug || null;
    },
    staleTime: 60000,
  });

  // Default to known published slug so registration is never gated by auth.
  const registerUrl = registerPageQuery.data
    ? `/l/${registerPageQuery.data}`
    : "/l/smart-income-program";

  // Helper to get config value by section+key
  const getConfig = (section: string, key: string): SipConfig | undefined => {
    return configQuery.data?.find((c) => c.section === section && c.key === key);
  };

  const getText = (section: string, key: string, fallback = ""): string => {
    return getConfig(section, key)?.value_text || fallback;
  };

  const isLoading =
    configQuery.isLoading ||
    speakersQuery.isLoading ||
    testimonialsQuery.isLoading ||
    journeyQuery.isLoading ||
    faqQuery.isLoading;

  return {
    config: configQuery.data || [],
    speakers: speakersQuery.data || [],
    testimonials: testimonialsQuery.data || [],
    journeySteps: journeyQuery.data || [],
    faqItems: faqQuery.data || [],
    registerUrl,
    getConfig,
    getText,
    isLoading,
  };
};
