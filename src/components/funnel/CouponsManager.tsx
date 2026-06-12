import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Users } from "lucide-react";
import { toast } from "sonner";

interface Coupon {
  id: string;
  landing_page_id: string;
  code: string;
  final_price_inr: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  landingPageId: string;
  basePrice: number;
}

export function CouponsManager({ landingPageId, basePrice }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [code, setCode] = useState("");
  const [finalPrice, setFinalPrice] = useState<string>("0");
  const [maxUses, setMaxUses] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [viewUsers, setViewUsers] = useState<Coupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["registration_coupons", landingPageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_coupons" as any)
        .select("*")
        .eq("landing_page_id", landingPageId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Coupon[];
    },
    enabled: !!landingPageId,
  });

  const reset = () => {
    setEditing(null);
    setCode("");
    setFinalPrice("0");
    setMaxUses("");
    setIsActive(true);
  };

  const openNew = () => {
    reset();
    setOpen(true);
  };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setCode(c.code);
    setFinalPrice(String(c.final_price_inr));
    setMaxUses(c.max_uses == null ? "" : String(c.max_uses));
    setIsActive(c.is_active);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        landing_page_id: landingPageId,
        code: code.trim().toUpperCase(),
        final_price_inr: Math.max(0, parseInt(finalPrice || "0", 10)),
        max_uses: maxUses.trim() === "" ? null : Math.max(1, parseInt(maxUses, 10)),
        is_active: isActive,
      };
      if (!payload.code) throw new Error("Code is required");
      if (editing) {
        const { error } = await supabase
          .from("registration_coupons" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("registration_coupons" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Coupon updated" : "Coupon created");
      qc.invalidateQueries({ queryKey: ["registration_coupons", landingPageId] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Failed to save coupon"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registration_coupons" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon deleted");
      qc.invalidateQueries({ queryKey: ["registration_coupons", landingPageId] });
    },
  });

  const toggle = useMutation({
    mutationFn: async (c: Coupon) => {
      const { error } = await supabase
        .from("registration_coupons" as any)
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registration_coupons", landingPageId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Coupon codes</h3>
          <p className="text-xs text-muted-foreground">
            Discount the price (down to ₹0 = free). Base price: ₹{basePrice}.
          </p>
        </div>
        <Button size="sm" variant="default" onClick={openNew}>
          <Plus size={14} className="mr-1" /> Add coupon
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : coupons.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No coupons yet. Add one to give discounts.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {coupons.map((c) => {
            const limitReached = c.max_uses != null && c.used_count >= c.max_uses;
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold tracking-wider">{c.code}</span>
                    <Badge variant={c.final_price_inr === 0 ? "default" : "secondary"}>
                      {c.final_price_inr === 0 ? "FREE" : `₹${c.final_price_inr}`}
                    </Badge>
                    {!c.is_active && <Badge variant="outline">Inactive</Badge>}
                    {limitReached && <Badge variant="destructive">Sold out</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Used <strong>{c.used_count}</strong>
                    {c.max_uses != null ? ` / ${c.max_uses}` : ""} times
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={c.is_active} onCheckedChange={() => toggle.mutate(c)} />
                  <Button size="icon" variant="ghost" onClick={() => setViewUsers(c)} title="View users">
                    <Users size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete coupon ${c.code}?`)) del.mutate(c.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SMART10"
                className="font-mono tracking-wider uppercase"
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground mt-1">Case-insensitive; stored uppercase.</p>
            </div>
            <div>
              <Label>Final price after coupon (₹)</Label>
              <Input
                type="number"
                min={0}
                max={basePrice}
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                What the visitor will pay if they use this code. 0 = free.
              </p>
            </div>
            <div>
              <Label>Max uses</Label>
              <Input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Blank = unlimited"
              />
              <p className="text-xs text-muted-foreground mt-1">
                e.g. 10 = only first 10 people can use this code.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label className="cursor-pointer">Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users who used this coupon */}
      <UsersOfCouponDialog coupon={viewUsers} onClose={() => setViewUsers(null)} />
    </div>
  );
}

function UsersOfCouponDialog({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["coupon-uses", coupon?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_payments" as any)
        .select("registrant_name, registrant_email, registrant_phone, amount_inr, status, created_at")
        .eq("coupon_id", coupon!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!coupon,
  });

  return (
    <Dialog open={!!coupon} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Users who used {coupon?.code}</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No one has used this coupon yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Phone</th>
                  <th className="text-right p-2">Paid</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.registrant_name || "—"}</td>
                    <td className="p-2">{r.registrant_email || "—"}</td>
                    <td className="p-2">{r.registrant_phone || "—"}</td>
                    <td className="p-2 text-right">
                      {r.status === "free" || r.amount_inr === 0 ? "FREE" : `₹${r.amount_inr}`}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
