import { useAuth } from "./useAuth";
import { useCallback } from "react";

export interface PlanLimits {
  funnel_limit: number | null;
  video_limit: number | null;
  video_max_size_mb: number | null;
  landing_page_limit: number | null;
  live_session_limit: number | null;
  multi_step_funnel_enabled: boolean;
}

export interface PlanInfo {
  isActive: boolean;
  isPaid: boolean;
  tier: string;
  planKey: string;
  status: string;
  expiresAt: string | null;
  startedAt: string | null;
  billingType: string | null;
  amountPaid: number | null;
  razorpayPaymentId: string | null;
  daysLeft: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  limits: PlanLimits;
}

// All features unlocked for everyone — no subscription system
const UNLIMITED_LIMITS: PlanLimits = {
  funnel_limit: null,
  video_limit: null,
  video_max_size_mb: 2048,
  landing_page_limit: null,
  live_session_limit: null,
  multi_step_funnel_enabled: true,
};

export const usePlan = () => {
  const { user } = useAuth();

  const plan: PlanInfo = {
    isActive: true,
    isPaid: true,
    tier: "pro",
    planKey: "pro",
    status: "active",
    expiresAt: null,
    startedAt: null,
    billingType: null,
    amountPaid: null,
    razorpayPaymentId: null,
    daysLeft: null,
    isExpired: false,
    isExpiringSoon: false,
    limits: UNLIMITED_LIMITS,
  };

  const canAccess = useCallback((_feature: string): boolean => {
    return true; // All features unlocked
  }, []);

  const canCreate = useCallback((_resource: "funnel" | "landing_page" | "live_session", _currentCount: number): boolean => {
    return true; // No limits
  }, []);

  const canUseMultiStep = true;

  const refreshPlan = useCallback(() => {}, []);

  return { plan, canAccess, canCreate, canUseMultiStep, isLoading: false, refreshPlan };
};
