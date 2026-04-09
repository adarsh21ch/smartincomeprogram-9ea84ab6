// Subscription system removed — all features unlocked
export const useSubscription = () => {
  return {
    subscription: null,
    tier: "pro",
    isLoading: false,
    useFeatureAccess: (_feature: string) => true,
    planLimits: null,
  };
};
