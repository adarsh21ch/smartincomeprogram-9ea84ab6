import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, UserMinus, Shield } from "lucide-react";
import { toast } from "sonner";

export const SubAdminManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch sub-admins
  const { data: subAdmins = [], isLoading } = useQuery({
    queryKey: ["sub-admins"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles" as any)
        .select("*, profiles:user_id(id, full_name, email)")
        .eq("role", "sub_admin");
      return (data as any[]) || [];
    },
  });

  // Search profiles
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-profiles-subadmin", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const subAdminUserIds = new Set(subAdmins.map((sa: any) => sa.user_id));

  const promoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles" as any).insert({
        user_id: userId,
        role: "sub_admin",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-admin added!");
      queryClient.invalidateQueries({ queryKey: ["sub-admins"] });
      setSearchQuery("");
    },
    onError: () => toast.error("Failed to add sub-admin"),
  });

  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles" as any)
        .delete()
        .eq("user_id", userId)
        .eq("role", "sub_admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-admin removed");
      queryClient.invalidateQueries({ queryKey: ["sub-admins"] });
    },
    onError: () => toast.error("Failed to remove sub-admin"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-heading font-semibold flex items-center gap-2">
          <Shield size={16} className="text-primary" /> Sub-Admins
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Sub-admins can manage training access for members but cannot access the admin panel.
        </p>
      </div>

      {/* Search to add */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search member by name or email to promote..."
            className="pl-9 bg-muted border-border h-9 text-sm"
          />
        </div>

        {searching && <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-muted-foreground" /></div>}

        {searchQuery.length >= 2 && searchResults.filter((p) => !subAdminUserIds.has(p.id)).length > 0 && (
          <div className="space-y-1 border border-border rounded-lg p-2 bg-muted/30">
            {searchResults
              .filter((p) => !subAdminUserIds.has(p.id))
              .map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{profile.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    onClick={() => promoteMutation.mutate(profile.id)}
                    disabled={promoteMutation.isPending}
                  >
                    <Plus size={12} /> Add
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Current sub-admins */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      ) : subAdmins.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No sub-admins yet.</p>
      ) : (
        <div className="space-y-1">
          {subAdmins.map((sa: any) => (
            <div key={sa.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sa.profiles?.full_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground truncate">{sa.profiles?.email}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive gap-1 shrink-0"
                onClick={() => {
                  if (confirm(`Remove ${sa.profiles?.full_name} as sub-admin?`)) {
                    demoteMutation.mutate(sa.user_id);
                  }
                }}
                disabled={demoteMutation.isPending}
              >
                <UserMinus size={12} /> Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
