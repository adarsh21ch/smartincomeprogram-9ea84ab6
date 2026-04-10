import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, Link, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";
import { Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle2, XCircle, Ticket } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type AuthStep = "login" | "register" | "otp" | "forgot" | "reset-otp" | "new-password";

const OtpInput = ({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error: boolean;
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return;
    const newDigits = [...digits];
    newDigits[index] = char;
    onChange(newDigits.join(""));
    if (char && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled]);

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 bg-background text-foreground transition-all outline-none focus:ring-2 focus:ring-primary/50 ${
            error ? "border-destructive animate-shake" : "border-muted-foreground/30 focus:border-primary"
          } ${disabled ? "opacity-50" : ""}`}
        />
      ))}
    </div>
  );
};

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const initialTab = searchParams.get("tab") === "signup" ? "register" : "login";
  const [step, setStep] = useState<AuthStep>(initialTab as AuthStep);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  // Login rate limiting
  const [failCount, setFailCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);

  // Invite code
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCodeVerified, setInviteCodeVerified] = useState(false);
  const [inviteCodeId, setInviteCodeId] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [inviteRequired, setInviteRequired] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpLockUntil, setOtpLockUntil] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check invite code requirement
  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "invite_code_required")
      .single()
      .then(({ data }) => {
        setInviteRequired(data?.value === "true");
      });
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/home"} replace />;
  }

  const handleVerifyInviteCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) { setCodeError("Please enter an invite code."); return; }
    setVerifyingCode(true);
    setCodeError("");
    try {
      const { data, error } = await supabase.functions.invoke("verify-invite-code", {
        body: { code },
      });
      if (error) throw error;
      if (data?.valid) {
        setInviteCodeVerified(true);
        setInviteCodeId(data.invite_code_id);
      } else {
        const reasons: Record<string, string> = {
          invalid: "Invalid invite code.",
          expired: "This code has expired.",
          limit_reached: "This code has reached its limit.",
        };
        setCodeError(reasons[data?.reason] || "Invalid invite code.");
      }
    } catch {
      setCodeError("Failed to verify. Please try again.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Please enter your name"); return; }
    if (!form.email.trim()) { toast.error("Please enter your email"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (inviteRequired && !inviteCodeVerified) { toast.error("Please verify your invite code first"); return; }

    setSubmitting(true);
    try {
      const { error } = await signUp(form.email, form.password, form.name, form.phone);
      if (error) {
        if (error.message?.includes("already")) {
          toast.error("An account with this email already exists. Login instead.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Auto-confirm is enabled, sign in directly
      const { error: signInError } = await signIn(form.email, form.password);
      if (signInError) {
        toast.error("Account created! Please sign in.");
        setStep("login");
        return;
      }

      // Mark invite code as used
      if (inviteCodeId) {
        try {
          const uid = (await supabase.auth.getUser()).data.user?.id;
          await supabase.functions.invoke("verify-invite-code", {
            body: { code: inviteCode.trim().toUpperCase(), action: "use", user_email: form.email, user_id: uid },
          });
        } catch {}
      }

      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        const { data: roleData } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        navigate(roleData ? "/admin/dashboard" : "/home");
      } else {
        navigate("/home");
      }
      toast.success("Welcome! Your account is ready.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (Date.now() < otpLockUntil) return;
    const code = otpCode.replace(/\s/g, "");
    if (code.length !== 6) { setOtpError("Enter all 6 digits"); return; }

    setSubmitting(true);
    setOtpError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: form.email,
        token: code,
        type: "email",
      });

      if (error) {
        const attempts = otpAttempts + 1;
        setOtpAttempts(attempts);
        if (attempts >= 3) {
          setOtpLockUntil(Date.now() + 60000);
          setOtpAttempts(0);
          setOtpError("Too many attempts. Try again in 60s.");
        } else if (error.message?.includes("expired")) {
          setOtpError("Code expired. Please resend.");
        } else {
          setOtpError("Incorrect code. Please try again.");
        }
        return;
      }

      if (data.user) {
        // Mark invite code as used
        if (inviteCodeId) {
          try {
            await supabase.functions.invoke("verify-invite-code", {
              body: { code: inviteCode.trim().toUpperCase(), action: "use", user_email: form.email, user_id: data.user.id },
            });
          } catch {}
        }

        // Check role for redirect
        const { data: roleData } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        navigate(roleData ? "/admin/dashboard" : "/home");
        toast.success("Welcome! Your account is verified.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setSubmitting(true);
    try {
      await supabase.auth.signInWithOtp({
        email: form.email,
        options: { shouldCreateUser: false },
      });
      setResendCooldown(30);
      setOtpCode("");
      setOtpError("");
      setOtpAttempts(0);
      toast.success("New code sent!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockUntil) { toast.error("Too many attempts. Please wait."); return; }
    if (!form.email.trim()) { toast.error("Please enter your email"); return; }

    setSubmitting(true);
    try {
      const { error } = await signIn(form.email, form.password);
      if (error) {
        const newCount = failCount + 1;
        setFailCount(newCount);
        if (newCount >= 3) {
          setLockUntil(Date.now() + 30000);
          setFailCount(0);
          toast.error("Too many failed attempts. Locked for 30 seconds.");
        } else {
          toast.error("Incorrect email or password");
        }
        return;
      }

      // Check if user is deactivated
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", (await supabase.auth.getUser()).data.user!.id)
        .single();

      if (profileData?.is_active === false) {
        await supabase.auth.signOut();
        toast.error("Your account has been deactivated. Contact support.");
        return;
      }

      // Role-based redirect
      const uid = (await supabase.auth.getUser()).data.user!.id;
      const { data: roleData } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      navigate(roleData ? "/admin/dashboard" : "/home");
      toast.success("Welcome back!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast.error("Enter your email"); return; }
    setSubmitting(true);
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      toast.success("Password reset email sent!");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSocialButtons = () => (
    <>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
      </div>
      <Button type="button" variant="outline" className="w-full" size="lg" disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          try {
            const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
            if (result.error) { toast.error("Google sign-in failed"); return; }
            if (result.redirected) return;
            navigate("/home");
          } finally { setSubmitting(false); }
        }}>
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Continue with Google
      </Button>
      <Button type="button" variant="outline" className="w-full" size="lg" disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          try {
            const result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
            if (result.error) { toast.error("Apple sign-in failed"); return; }
            if (result.redirected) return;
            navigate("/home");
          } finally { setSubmitting(false); }
        }}>
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        Continue with Apple
      </Button>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-bg-subtle">
      <div className="absolute inset-0 animate-grid opacity-30" />
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block"><Logo size="lg" /></Link>
          <p className="text-sm text-muted-foreground mt-3">
            {step === "login" && "Welcome back! Sign in to your account."}
            {step === "register" && "Create your account."}
            {step === "otp" && "Verify your email to continue."}
            {step === "forgot" && "Reset your password."}
          </p>
        </div>

        <div className="glass-card p-8">
          {/* Login / Register Toggle */}
          {(step === "login" || step === "register") && (
            <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
              <button
                onClick={() => setStep("login")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                  step === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => setStep("register")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                  step === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* LOGIN */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="you@example.com" className="pl-9 bg-muted border-border" required
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm">Password</Label>
                  <button type="button" onClick={() => { setForgotEmail(form.email); setStep("forgot"); }}
                    className="text-xs text-primary hover:underline">Forgot password?</button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                    className="pl-9 pr-10 bg-muted border-border" required
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button variant="hero" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign In →"}
              </Button>
              {renderSocialButtons()}
            </form>
          )}

          {/* REGISTER */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              {inviteRequired && !inviteCodeVerified && (
                <div className="space-y-3 pb-4 mb-4 border-b border-border">
                  <div className="space-y-2">
                    <Label className="text-sm">Invite Code <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Enter invite code" className="pl-9 bg-muted border-border uppercase"
                        value={inviteCode} onChange={(e) => { setInviteCode(e.target.value); setCodeError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyInviteCode(); } }} />
                    </div>
                    {codeError && (
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <XCircle size={14} /><span>{codeError}</span>
                      </div>
                    )}
                  </div>
                  <Button type="button" variant="hero" className="w-full" size="lg"
                    disabled={verifyingCode} onClick={handleVerifyInviteCode}>
                    {verifyingCode ? "Verifying..." : "Verify Code →"}
                  </Button>
                </div>
              )}

              {inviteCodeVerified && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2 mb-2">
                  <CheckCircle2 size={16} />
                  <span>Valid invite code!</span>
                </div>
              )}

              {(!inviteRequired || inviteCodeVerified) && (
                <>
                  {/* Optional invite code field when not required */}
                  {!inviteRequired && (
                    <div className="space-y-2">
                      <Label className="text-sm">Invite Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <div className="relative">
                        <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Enter invite code" className="pl-9 bg-muted border-border uppercase"
                          value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-sm">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Your full name" className="pl-9 bg-muted border-border"
                        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="+91 9876543210" className="pl-9 bg-muted border-border"
                        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Email <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="email" placeholder="you@example.com" className="pl-9 bg-muted border-border" required
                        value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type={showPassword ? "text" : "password"} placeholder="Min 6 characters"
                        className="pl-9 pr-10 bg-muted border-border" required
                        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <Button variant="hero" className="w-full" size="lg" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create Account →"}
                  </Button>
                  {renderSocialButtons()}
                </>
              )}
            </form>
          )}

          {/* OTP VERIFICATION */}
          {step === "otp" && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-heading font-bold">Verify your email</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <strong>{form.email}</strong>
                </p>
              </div>

              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={submitting || Date.now() < otpLockUntil}
                error={!!otpError}
              />

              {otpError && (
                <p className="text-sm text-destructive text-center">{otpError}</p>
              )}

              <Button variant="hero" className="w-full" size="lg"
                disabled={submitting || otpCode.length < 6 || Date.now() < otpLockUntil}
                onClick={handleVerifyOtp}>
                {submitting ? "Verifying..." : "Verify →"}
              </Button>

              <div className="text-center space-y-2 text-sm">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || submitting}
                  className={`text-primary hover:underline disabled:text-muted-foreground disabled:no-underline`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
                <br />
                <button onClick={() => setStep("register")} className="text-muted-foreground hover:text-foreground">
                  ← Change email
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Check your spam folder if you don't see the email.
              </p>
            </div>
          )}

          {/* FORGOT PASSWORD */}
          {step === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-lg font-heading font-bold">Forgot password?</h2>
                <p className="text-sm text-muted-foreground">We'll send a reset link to your email.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input type="email" placeholder="you@example.com" className="pl-9 bg-muted border-border" required
                    value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
              </div>
              <Button variant="hero" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Sending..." : "Send Reset Link →"}
              </Button>
              <button type="button" onClick={() => setStep("login")}
                className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
                ← Back to login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
