// Subscription system removed — no upgrade modals
interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  type: "upgrade" | "limit";
  resource?: string;
  currentCount?: number;
  limit?: number;
  tier?: string;
}

export const UpgradeModal = ({ open, onClose }: UpgradeModalProps) => {
  return null;
};
