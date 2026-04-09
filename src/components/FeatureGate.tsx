import { ReactNode } from "react";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

// All features unlocked — no gating
export const FeatureGate = ({ children }: FeatureGateProps) => {
  return <>{children}</>;
};

export const FeatureLockBadge = ({ feature }: { feature: string }) => {
  return null; // No lock badges
};
