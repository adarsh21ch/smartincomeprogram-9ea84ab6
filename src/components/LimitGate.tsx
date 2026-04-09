import { ReactNode } from "react";

interface LimitGateProps {
  resource: "funnel" | "landing_page" | "live_session";
  children: ReactNode;
}

// All limits removed — always render children
export const LimitGate = ({ children }: LimitGateProps) => {
  return <>{children}</>;
};

export const LimitBadge = ({ resource }: { resource: "funnel" | "landing_page" | "live_session" }) => {
  return null;
};
