import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2, GripVertical, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

interface CourseCard {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  badge_text: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const emptyCard = { title: "", description: "", icon: "🎓", badge_text: "Members Only", is_active: true };

export const CourseCardsManager = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState(emptyCard);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["admin-course-cards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_cards" as any)
        .select("*")
        .order("display_order");
      return (data as any as CourseCard[]) || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-course-cards"] });

  const addMutation = useMutation({
    mutationFn: async (card: typeof emptyCard) => {
      const maxOrder = cards.length > 0 ? Math.max(...cards.map((c) => c.display_order)) : 0;
      const { error } = await supabase.from("course_cards" as any).insert({
        title: card.title,
        description: card.description || null,
        icon: card.icon || "🎓",
        badge_text: card.badge_text || "Members Only",
        display_order: maxOrder + 1,
        is_active: card.is_active,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setAddingNew(false); setForm(emptyCard); toast.success("Card added!"); },
    onError: () => toast.error("Failed to add card"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CourseCard> }) => {
      const { error } = await supabase.from("course_cards" as any).update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Card updated!"); },
    onError: () => toast.error("Failed to update card"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_cards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Card deleted!"); },
    onError: () => toast.error("Failed to delete card"),
  });

  const moveCard = (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= cards.length) return;
    const a = cards[index];
    const b = cards[swapIndex];
    Promise.all([
      supabase.from("course_cards" as any).update({ display_order: b.display_order } as any).eq("id", a.id),
      supabase.from("course_cards" as any).update({ display_order: a.display_order } as any).eq("id", b.id),
    ]).then(() => invalidate());
  };

  const startEdit = (card: CourseCard) => {
    setEditingId(card.id);
    setForm({ title: card.title, description: card.description || "", icon: card.icon, badge_text: card.badge_text, is_active: card.is_active });
  };

  const saveEdit = () => {
    if (!editingId || !form.title.trim()) return;
    updateMutation.mutate({ id: editingId, updates: { title: form.title, description: form.description || null, icon: form.icon, badge_text: form.badge_text, is_active: form.is_active } as any });
  };

  return (
    <section className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">Courses Tab Cards</h2>
          <p className="text-xs text-muted-foreground mt-1">Manage the locked course cards shown to members on the Courses tab.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAddingNew(true); setForm(emptyCard); setEditingId(null); }} className="gap-1">
          <Plus size={14} /> Add Card
        </Button>
      </div>

      {/* Add new card form */}
      {addingNew && (
        <div className="p-4 rounded-lg border border-primary/30 bg-muted/30 space-y-3">
          <h3 className="text-sm font-semibold">New Course Card</h3>
          <CardForm form={form} setForm={setForm} />
          <div className="flex gap-2">
            <Button size="sm" variant="hero" onClick={() => { if (!form.title.trim()) return; addMutation.mutate(form); }} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingNew(false)}><X size={14} /> Cancel</Button>
          </div>
        </div>
      )}

      {/* Card list */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={20} /></div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No course cards yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {cards.map((card, i) => (
            <div key={card.id} className="p-3 rounded-lg border border-border bg-muted/20">
              {editingId === card.id ? (
                <div className="space-y-3">
                  <CardForm form={form} setForm={setForm} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="hero" onClick={saveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X size={14} /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveCard(i, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <GripVertical size={14} />
                    </button>
                  </div>
                  <span className="text-xl">{card.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.title}</p>
                    <p className="text-xs text-muted-foreground">{card.badge_text}</p>
                  </div>
                  <Switch
                    checked={card.is_active}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: card.id, updates: { is_active: checked } as any })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => startEdit(card)} className="h-8 w-8">
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { if (confirm("Delete this course card?")) deleteMutation.mutate(card.id); }}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

function CardForm({ form, setForm }: { form: typeof emptyCard; setForm: (f: typeof emptyCard) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <Label className="text-xs">Icon (emoji)</Label>
        <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="mt-1 bg-muted border-border" maxLength={4} />
      </div>
      <div>
        <Label className="text-xs">Badge Text (max 30)</Label>
        <Input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value.slice(0, 30) })} className="mt-1 bg-muted border-border" />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Title (required, max 60)</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 60) })} className="mt-1 bg-muted border-border" />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Description (max 200)</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 200) })} className="mt-1 bg-muted border-border" rows={2} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
        <Label className="text-xs">Visible to members</Label>
      </div>
    </div>
  );
}
