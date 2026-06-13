import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, Link, useNavigate, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";
import { Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle2, XCircle, Ticket, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PublicFooterBranding from "@/components/PublicFooterBranding";

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
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Auto-submit OTP when 6 digits are entered
  useEffect(() => {
    if (step === "otp" && otpCode.replace(/\s/g, "").length === 6 && !submitting && Date.now() >= otpLockUntil) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode, step]);

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
          toast.error("An account with this email already exists. Please log in.");
          setStep("login");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // With auto-confirm on, signUp returns an active session immediately —
      // the AuthProvider listener picks it up and the <Navigate /> at the top
      // of this page redirects automatically. We just need to make sure the
      // session is established before doing role-based navigation.
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Fallback: explicit sign in (rare path if auto-confirm is temporarily off)
        const { error: signInError } = await signIn(form.email, form.password);
        if (signInError) {
          toast.success("Account created! Please log in.");
          setStep("login");
          return;
        }
        ({ data: { session } } = await supabase.auth.getSession());
      }

      const uid = session?.user?.id;

      // Mark invite code as used (non-blocking — don't slow the user down)
      if (inviteCodeId && uid) {
        supabase.functions.invoke("verify-invite-code", {
          body: { code: inviteCode.trim().toUpperCase(), action: "use", user_email: form.email, user_id: uid },
        }).catch(() => {});
      }

      toast.success(`Welcome, ${form.name.split(" ")[0]}! 🎉`);

      if (uid) {
        const { data: roleData } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        navigate(roleData ? "/admin/dashboard" : "/home", { replace: true });
      } else {
        navigate("/home", { replace: true });
      }
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
        <div className="text-center mb-5 sm:mb-8">
          <Link to="/" className="inline-block"><Logo size="lg" /></Link>
          <p className="text-sm text-muted-foreground mt-3">
            {step === "login" && "Welcome back! Sign in to your account."}
            {step === "register" && "Create your account."}
            {step === "otp" && "Verify your email to continue."}
            {step === "forgot" && "Reset your password."}
          </p>
        </div>

        <div className="glass-card p-5 sm:p-8">
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
                    autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
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
                    autoComplete="current-password"
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState && e.getModifierState("CapsLock"))}
                    onKeyDown={(e) => setCapsLockOn(e.getModifierState && e.getModifierState("CapsLock"))}
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="text-[11px] text-amber-500 flex items-center gap-1">⚠ Caps Lock is on</p>
                )}
              </div>
              <Button variant="hero" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign In →"}
              </Button>
              {renderSocialButtons()}
            </form>
          )}

          {/* REGISTER (one-question-at-a-time wizard) */}
          {step === "register" && (
            <RegisterWizard
              form={form}
              setForm={setForm}
              inviteRequired={inviteRequired}
              inviteCode={inviteCode}
              setInviteCode={setInviteCode}
              inviteCodeVerified={inviteCodeVerified}
              verifyingCode={verifyingCode}
              codeError={codeError}
              handleVerifyInviteCode={handleVerifyInviteCode}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              submitting={submitting}
              onSubmit={handleRegister}
              renderSocialButtons={renderSocialButtons}
            />
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

        <PublicFooterBranding variant="dark" />
      </div>
    </div>
  );
};

// ---------- One-question-at-a-time register wizard ----------
type RegisterWizardProps = {
  form: { name: string; email: string; phone: string; password: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; phone: string; password: string }>>;
  inviteRequired: boolean;
  inviteCode: string;
  setInviteCode: (v: string) => void;
  inviteCodeVerified: boolean;
  verifyingCode: boolean;
  codeError: string;
  handleVerifyInviteCode: () => Promise<void> | void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  renderSocialButtons: () => JSX.Element;
};

const RegisterWizard = ({
  form, setForm, inviteRequired, inviteCode, setInviteCode, inviteCodeVerified,
  verifyingCode, codeError, handleVerifyInviteCode, showPassword, setShowPassword,
  submitting, onSubmit, renderSocialButtons,
}: RegisterWizardProps) => {
  type Field = "invite" | "name" | "phone" | "email" | "password";
  const fields: Field[] = useMemo(() => {
    const f: Field[] = [];
    if (inviteRequired && !inviteCodeVerified) f.push("invite");
    f.push("name", "phone", "email", "password");
    return f;
  }, [inviteRequired, inviteCodeVerified]);

  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset when fields list changes (e.g. invite verified)
  useEffect(() => { setIdx(0); }, [fields.length]);

  // Autofocus current field
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [idx, fields]);

  const current = fields[idx];
  const isLast = idx === fields.length - 1;

  const validateCurrent = (): string | null => {
    if (current === "invite") {
      if (!inviteCode.trim()) return "Please enter your invite code";
      return null;
    }
    if (current === "name") {
      if (!form.name.trim()) return "Please enter your name";
      return null;
    }
    if (current === "phone") return null; // optional
    if (current === "email") {
      if (!form.email.trim()) return "Please enter your email";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Please enter a valid email";
      return null;
    }
    if (current === "password") {
      if (form.password.length < 6) return "Password must be at least 6 characters";
      return null;
    }
    return null;
  };

  const goNext = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const err = validateCurrent();
    if (err) { toast.error(err); return; }

    if (current === "invite") {
      await handleVerifyInviteCode();
      return; // fields list will rebuild and idx resets to 0 (name)
    }

    if (isLast) {
      await onSubmit(e as React.FormEvent);
      return;
    }
    setDirection(1);
    setIdx((i) => i + 1);
  };

  const goBack = () => {
    if (idx === 0) return;
    setDirection(-1);
    setIdx((i) => i - 1);
  };

  const labelMap: Record<Field, { label: string; hint: string }> = {
    invite: { label: "Enter your invite code", hint: "We sent this to you over WhatsApp or email." },
    name: { label: "What's your full name?", hint: "This is how we'll address you." },
    phone: { label: "Your phone number", hint: "Optional — for important updates only." },
    email: { label: "Your email address", hint: "You'll sign in with this." },
    password: { label: "Create a password", hint: "Just 6 characters minimum. Anything you'll remember." },
  };
  const { label, hint } = labelMap[current];

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
  };

  const totalDots = fields.length;

  return (
    <form onSubmit={goNext} className="space-y-5">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: totalDots }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? "w-6 bg-primary" : i < idx ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-heading font-bold text-foreground">{label}</h2>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>

            {current === "invite" && (
              <>
                <div className="relative">
                  <Ticket size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="ENTER CODE"
                    className="pl-9 bg-muted border-border uppercase h-12 text-base"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
                {codeError && (
                  <div className="flex items-center gap-2 text-destructive text-xs">
                    <XCircle size={14} /><span>{codeError}</span>
                  </div>
                )}
              </>
            )}

            {current === "name" && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="e.g. Rahul Sharma"
                  autoComplete="name"
                  autoCapitalize="words"
                  className="pl-9 bg-muted border-border h-12 text-base"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            )}

            {current === "phone" && (
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="+91 9876543210"
                  className="pl-9 bg-muted border-border h-12 text-base"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            )}

            {current === "email" && (
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  className="pl-9 bg-muted border-border h-12 text-base"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            )}

            {current === "password" && (
              <>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    className="pl-9 pr-10 bg-muted border-border h-12 text-base"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Any 6+ characters work — e.g. <span className="font-mono">888888</span>
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        {idx > 0 && (
          <Button type="button" variant="outline" size="lg" className="px-3" onClick={goBack} disabled={submitting || verifyingCode}>
            <ArrowLeft size={18} />
          </Button>
        )}
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="flex-1"
          disabled={submitting || verifyingCode}
        >
          {current === "invite"
            ? (verifyingCode ? "Verifying..." : "Verify Code")
            : isLast
              ? (submitting ? "Creating account..." : "Create Account")
              : "Continue"}
          <ArrowRight size={18} className="ml-1" />
        </Button>
      </div>

      {/* Social options only on the first non-invite step to keep things clean */}
      {current === "name" && (
        <div className="pt-1">{renderSocialButtons()}</div>
      )}
    </form>
  );
};

export default AuthPage;
