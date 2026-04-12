import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, LogOut, Video, CheckCircle2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { brand } from "@/config/brand";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileTabProps {
  stats?: {
    videosWatched: number;
    stepsCompleted: number;
    daysActive: number;
  };
}

export const ProfileTab = ({ stats }: ProfileTabProps) => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });

  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPwSection, setShowPwSection] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({ full_name: profile.full_name || "", phone: profile.phone || "" });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setLoading(false);
    if (error) { toast.error("Failed to save"); return; }
    await refreshProfile();
    setEditing(false);
    toast.success("Profile updated!");
  };

  const handlePasswordChange = async () => {
    if (pwForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
    setPwLoading(false);
    if (error) { toast.error(error.message); return; }
    setPwForm({ newPassword: "", confirmPassword: "" });
    setShowPwSection(false);
    toast.success("Password updated!");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const firstName = profile?.full_name?.split(" ")[0] || "U";
  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  const memberSince = user?.created_at
    ? format(new Date(user.created_at), "d MMM yyyy")
    : "—";

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-heading font-bold">Profile</h1>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-semibold text-foreground truncate">{profile?.full_name || "Member"}</h2>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
            {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
            <p className="text-[10px] text-muted-foreground mt-1">Member since {memberSince}</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary font-medium hover:underline shrink-0"
            >
              Edit
            </button>
          )}
        </div>

        {/* Edit form */}
        {editing && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1 bg-muted border-border h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 bg-muted border-border h-9 text-sm"
                placeholder="+91 9876543210"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="hero" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Row */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <Video size={16} className="mx-auto text-blue-400 mb-1" />
            <p className="text-lg font-bold text-foreground">{stats.videosWatched}</p>
            <p className="text-[10px] text-muted-foreground">Videos</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <CheckCircle2 size={16} className="mx-auto text-green-400 mb-1" />
            <p className="text-lg font-bold text-foreground">{stats.stepsCompleted}</p>
            <p className="text-[10px] text-muted-foreground">Completed</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <Calendar size={16} className="mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">{stats.daysActive}</p>
            <p className="text-[10px] text-muted-foreground">Days Active</p>
          </div>
        </motion.div>
      )}

      {/* Password */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <button
          onClick={() => setShowPwSection(!showPwSection)}
          className="flex items-center gap-2 text-sm font-medium text-foreground w-full"
        >
          <Lock size={16} className="text-muted-foreground" />
          Change Password
        </button>

        {showPwSection && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div>
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="mt-1 bg-muted border-border h-9 text-sm"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <Label className="text-xs">Confirm Password</Label>
              <Input
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                className="mt-1 bg-muted border-border h-9 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handlePasswordChange} disabled={pwLoading}>
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </div>
        )}
      </motion.div>

      {/* Logout */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 font-medium w-full rounded-2xl border border-border bg-card p-5 transition-colors">
            <LogOut size={16} />
            Logout
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again to access your program.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer branding */}
      <div className="pt-2 pb-4 text-center">
        <p className="text-[10px] text-muted-foreground/50">
          {brand.footer.copyright} · Powered by Nevorai
        </p>
      </div>
    </div>
  );
};
