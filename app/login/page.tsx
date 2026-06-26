"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Fuel, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
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
        user_agent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
      });
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Success — log it and redirect
    await supabase.from("login_audit_log").insert({
      email,
      action: "password_success",
      user_agent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
    });

    router.push("/dashboard");
    router.refresh();
  };

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

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Sign In</h2>
            <p className="text-gray-500 text-sm mb-7">
              Enter your credentials to access your station dashboard
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
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
                className="btn-primary w-full justify-center py-3 text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Dashboard"
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
              <ShieldCheck size={14} className="text-green-500" />
              Secure encrypted access
            </div>
          </div>
        </div>
        
        <p className="text-center text-blue-300/60 text-xs mt-8">
          © {new Date().getFullYear()} FuelTrack Uganda. All rights reserved.
        </p>
      </div>
    </div>
  );
}