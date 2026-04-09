import { useAuth } from "./useAuth";
import { useResourceCount } from "./useResourceCount";

export interface PlanConfig {
  plan_name: string;
  monthly_price: number;
  yearly_price: number;
  yearly_validity_days: number;
  max_funnels: number;
  max_landing_pages: number;
  max_live_sessions: number;
  max_team_members: number;
  multilevel_funnel_enabled: boolean;
  is_enabled?: boolean;
  feature_lead_capture?: boolean;
  feature_analytics?: boolean;
  feature_whatsapp_automation?: boolean;
  feature_video_sharing?: boolean;
  feature_priority_support?: boolean;
  feature_advanced_analytics?: boolean;
  feature_go_live?: boolean;
  feature_landing_pages?: boolean;
  feature_team_analytics?: boolean;
  plan_badge_text?: string | null;
}

export const usePlanLimits = () => {
  const { user } = useAuth();
  const counts = useResourceCount();

  // All features unlocked — no plan restrictions
  return {
    tier: "pro",
    isFree: false,
    config: {
      plan_name: "pro",
      monthly_price: 0,
      yearly_price: 0,
      yearly_validity_days: 365,
      max_funnels: -1,
      max_landing_pages: -1,
      max_live_sessions: -1,
      max_team_members: -1,
      multilevel_funnel_enabled: true,
      feature_lead_capture: true,
      feature_analytics: true,
      feature_whatsapp_automation: true,
      feature_video_sharing: true,
      feature_priority_support: true,
      feature_advanced_analytics: true,
      feature_go_live: true,
      feature_landing_pages: true,
      feature_team_analytics: true,
    } as PlanConfig,
    counts,
    teamCount: 0,
    canCreateFunnel: true,
    canCreateLandingPage: true,
    canCreateLive: true,
    canUseMultilevel: true,
    canAddTeamMember: true,
    isFunnelLimitReached: false,
    isLandingPageLimitReached: false,
    isLiveLimitReached: false,
    isTeamLimitReached: false,
    planConfigs: [],
    features: {
      leadCapture: true,
      analytics: true,
      whatsappAutomation: true,
      videoSharing: true,
      prioritySupport: true,
      advancedAnalytics: true,
      multilevelFunnels: true,
      teamMembers: true,
      teamAnalytics: true,
      goLive: true,
      landingPages: true,
    },
  };
};
