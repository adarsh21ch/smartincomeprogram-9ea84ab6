import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BadgeCheck, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  landingPageId: string;
  basePrice: number;
  paidEnabled: boolean;
  /** Tells parent the current price the user will be charged (₹). 0 = free. */
  onPriceChange: (price: number, couponCode: string | null) => void;
}

/**
 * Coupon + price preview box. Server is the source of truth — we call
 * the RPC `get_registration_price` and display whatever it returns.
 */
export function PriceCouponBox({ landingPageId, basePrice, paidEnabled, onPriceChange }: Props) {
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(paidEnabled ? basePrice : 0);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  if (!paidEnabled) return null;

  const apply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc("get_registration_price", {
        p_landing_page_id: landingPageId,
        p_code: code.trim(),
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) {
        setMessage({ kind: "error", text: res.error });
        setAppliedCode(null);
        setCurrentPrice(basePrice);
        onPriceChange(basePrice, null);
      } else if (res?.coupon_applied) {
        const newPrice = Number(res.price ?? basePrice);
        setCurrentPrice(newPrice);
        const norm = code.trim().toUpperCase();
        setAppliedCode(norm);
        setCode(norm);
        onPriceChange(newPrice, norm);
        setMessage({
          kind: "success",
          text: newPrice === 0 ? "Coupon applied — FREE!" : `Coupon applied — New price ₹${newPrice}`,
        });
      } else {
        setMessage({ kind: "error", text: "Invalid coupon" });
      }
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Could not apply coupon" });
    } finally {
      setApplying(false);
    }
  };

  const remove = () => {
    setCode("");
    setAppliedCode(null);
    setMessage(null);
    setCurrentPrice(basePrice);
    onPriceChange(basePrice, null);
  };

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: "rgba(232,184,48,0.06)", border: "1px solid rgba(232,184,48,0.25)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#F5F0E8" }}>
          Registration fee
        </span>
        <div className="flex items-baseline gap-2">
          {appliedCode && currentPrice < basePrice && (
            <span className="text-sm line-through" style={{ color: "#888" }}>
              ₹{basePrice}
            </span>
          )}
          <span className="text-lg font-bold" style={{ color: currentPrice === 0 ? "#22c55e" : "#E8B830" }}>
            {currentPrice === 0 ? "FREE" : `₹${currentPrice}`}
          </span>
        </div>
      </div>

      {!appliedCode ? (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide" style={{ color: "#888" }}>
            <Tag size={11} className="inline mr-1" /> Have a coupon code?
          </Label>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="bg-[#181818] border-[rgba(197,147,14,0.2)] text-white placeholder:text-[#555] h-10 uppercase tracking-wider font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
            />
            <button
              type="button"
              onClick={apply}
              disabled={!code.trim() || applying}
              className="px-4 rounded-md text-sm font-semibold disabled:opacity-50"
              style={{ background: "rgba(232,184,48,0.18)", color: "#E8B830", border: "1px solid rgba(232,184,48,0.4)" }}
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
          <span className="text-xs flex items-center gap-1.5 font-medium" style={{ color: "#22c55e" }}>
            <BadgeCheck size={14} /> {appliedCode} applied
          </span>
          <button type="button" onClick={remove} className="text-xs underline" style={{ color: "#888" }}>
            Remove
          </button>
        </div>
      )}

      {message && (
        <p className="text-xs" style={{ color: message.kind === "error" ? "#f87171" : "#22c55e" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
