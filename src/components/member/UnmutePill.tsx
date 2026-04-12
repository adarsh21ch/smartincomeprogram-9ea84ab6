import { VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UnmutePillProps {
  visible: boolean;
  onUnmute: () => void;
}

export const UnmutePill = ({ visible, onUnmute }: UnmutePillProps) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => {
            e.stopPropagation();
            onUnmute();
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-xs font-medium"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
        >
          <VolumeX size={14} />
          Tap to unmute
        </motion.button>
      )}
    </AnimatePresence>
  );
};
