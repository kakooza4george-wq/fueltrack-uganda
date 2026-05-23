"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Fuel, Loader2, Eye, EyeOff, Mail,
  ShieldCheck, ArrowLeft, RefreshCw, Send
} from "lucide-react";

type Step = "credentials" | "send_code" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // ── STEP 1: Verify password ────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      await supabase.from("login_audit_log").insert({
        email,
        action: "password_failed",
        user_agent: navigator.userAgent,
      });
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Password correct — log it and sign out immediately
    // User must verify OTP before getting full access
    await supabase.from("login_audit_log").insert({
      email,
      action: "password_success",
      user_agent: navigator.userAgent,
    });

    await supabase.auth.signOut();
    setLoading(false);
    // Move to next step — nothing sent yet
    setStep("send_code");
  };

  // ── STEP 2: User manually clicks to send OTP ──────
  const handleSendCode = async () => {
    setSending(true);
    setError("");

    const supabase = createClient();

    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (otpErr) {
      if (
        otpErr.message.toLowerCase().includes("rate") ||
        otpErr.message.toLowerCase().includes("limit")
      ) {
        setError(
          "Supabase has a limit of 2 emails per hour. Please wait a few minutes and try again."
        );
      } else {
        setError(`Could not send code: ${otpErr.message}`);
      }
      setSending(false);
      return;
    }

    await supabase.from("login_audit_log").insert({
      email,
      action: "otp_sent",
      user_agent: navigator.userAgent,
    });

    setSending(false);
    setStep("otp");
    startResendCooldown();
  };

  // ── STEP 3: Verify OTP entered by user ────────────
  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = otp.join("");

    if (enteredCode.length !== 8) {
      setOtpError("Please enter all 8 digits.");
      return;
    }

    setLoading(true);
    setOtpError("");

    const supabase = createClient();

    // Verify the code using Supabase's built-in OTP verification
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: enteredCode,
      type: "email",
    });

    if (verifyError || !data.user) {
      await supabase.from("login_audit_log").insert({
        email,
        action: "otp_failed",
        user_agent: navigator.userAgent,
      });
      setOtpError(
        "Incorrect or expired code. Please try again or request a new code."
      );
      setLoading(false);
      return;
    }

    // OTP verified — user is now signed in via Supabase
    await supabase.from("login_audit_log").insert({
      email,
      action: "otp_success",
      user_agent: navigator.userAgent,
    });

    router.push("/dashboard");
    router.refresh();
  };

  // ── OTP box handlers ───────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");
    if (value && index < 7) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 8);
    if (pasted.length === 8) setOtp(pasted.split(""));
  };

  const startResendCooldown = () => {
    setResendCooldown(120);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", "", "", ""]);
    setOtpError("");
    await handleSendCode();
  };

  const maskEmail = (e: string) => {
    const [user, domain] = e.split("@");
    return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
  };

  const STEPS = ["credentials", "send_code", "otp"];
  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Fuel size={32} className="text-blue-900" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            FuelTrack Uganda
          </h1>
          <p className="text-blue-300 mt-1 text-sm">Station Management System</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {["Password", "Send Code", "Verify"].map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${currentStepIndex === idx
                  ? "bg-amber-400 text-blue-900"
                  : currentStepIndex > idx
                  ? "bg-blue-700 text-blue-200"
                  : "bg-blue-900/60 text-blue-500 border border-blue-700"}`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {currentStepIndex > idx ? "✓" : idx + 1}
                </span>
                {label}
              </div>
              {idx < 2 && <div className="w-4 h-px bg-blue-700" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* STEP 1 — Email + Password */}
          {step === "credentials" && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Sign In</h2>
              <p className="text-gray-500 text-sm mb-7">
                Enter your credentials to continue
              </p>

              <form onSubmit={handleCredentials} className="space-y-5">
                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="form-label">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-input pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                    <span className="mt-0.5">⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-3 text-base"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Checking credentials...
                    </>
                  ) : (
                    "Continue →"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                <ShieldCheck size={14} className="text-green-500" />
                Protected by two-step verification
              </div>
            </div>
          )}

          {/* STEP 2 — Send Code manually */}
          {step === "send_code" && (
            <div className="p-8">
              <button
                onClick={() => {
                  setStep("credentials");
                  setError("");
                }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={30} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">
                  Credentials Verified
                </h2>
                <p className="text-gray-500 text-sm mt-2">
                  Click the button below when you are ready to receive your
                  verification code
                </p>
                <p className="font-semibold text-blue-700 mt-2 text-sm">
                  {maskEmail(email)}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2 mb-4">
                  <span className="mt-0.5">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={sending}
                className="btn-primary w-full justify-center py-4 text-base"
              >
                {sending ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Sending code to your email...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Verification Code to Email
                  </>
                )}
              </button>

              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-blue-700 text-xs text-center">
                  The code will be sent to your registered email address.
                  Check your inbox and spam folder.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3 — Enter OTP */}
          {step === "otp" && (
            <div className="p-8">
              <button
                onClick={() => {
                  setStep("send_code");
                  setOtp(["", "", "", "", "", "", "", ""]);
                  setOtpError("");
                }}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <div className="flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mx-auto mb-5">
                <Mail size={30} className="text-blue-700" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  Check Your Email
                </h2>
                <p className="text-gray-500 text-sm mt-2">
                  Verification code sent to:
                </p>
                <p className="font-bold text-blue-700 mt-1">
                  {maskEmail(email)}
                </p>
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 inline-block">
                  <p className="text-amber-700 text-xs">
                    Check your inbox and spam folder
                  </p>
                </div>
              </div>

              <form onSubmit={handleOtp} className="space-y-5">
                <div>
                  <label className="form-label text-center block mb-4">
                    Enter 8-Digit Verification Code
                  </label>
                  <div
                    className="flex gap-1.5 justify-center"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`otp-${idx}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        style={{ height: "3.5rem", width: "3rem" }}
                        className={`text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                          ${digit
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-gray-50"}
                          focus:border-blue-500 focus:bg-blue-50`}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-2">
                    You can paste the code directly into the boxes
                  </p>
                </div>

                {otpError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg text-center">
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full justify-center py-3 text-base"
                  disabled={loading || otp.join("").length !== 8}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Verify and Sign In
                    </>
                  )}
                </button>

                <div className="text-center space-y-2">
                  <p className="text-gray-500 text-sm">
                    Did not receive the code?
                  </p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || sending}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw size={13} />
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-blue-500 text-xs mt-5">
          Unauthorized access is prohibited and all attempts are logged
        </p>
      </div>
    </div>
  );
}