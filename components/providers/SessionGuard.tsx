"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, LogOut } from "lucide-react";

const INACTIVITY_LIMIT = 30 * 60 * 1000;
const WARNING_AT       = 25 * 60 * 1000;

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const lastActivity = useRef<number>(Date.now());
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      setCountdown(300);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    }
  }, [showWarning]);

  const signOut = useCallback(async (reason: "timeout" | "manual") => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("login_audit_log").insert({
        email: user.email ?? "unknown",
        action: reason === "timeout" ? "session_timeout" : "manual_logout",
        user_agent: navigator.userAgent,
      });
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!showWarning) return;
    setCountdown(300);
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownTimer.current!); signOut("timeout"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownTimer.current) clearInterval(countdownTimer.current); };
  }, [showWarning, signOut]);

  useEffect(() => {
    const check = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= INACTIVITY_LIMIT) { signOut("timeout"); }
      else if (idle >= WARNING_AT && !showWarning) { setShowWarning(true); }
    }, 30000);
    return () => clearInterval(check);
  }, [showWarning, signOut]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    const handler = () => resetActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [resetActivity]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={32} className="text-amber-600" />
            </div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Session Timeout Warning</h2>
              <p className="text-gray-500 text-sm">
                You have been inactive for 25 minutes. You will be signed out in:
              </p>
              <div className="mt-4 text-5xl font-bold text-amber-600 font-mono">{fmt(countdown)}</div>
              <p className="text-xs text-gray-400 mt-1">minutes remaining</p>
            </div>
            <div className="flex gap-3">
              <button onClick={resetActivity} className="btn-primary flex-1 justify-center py-3">
                I am Still Here — Continue
              </button>
              <button onClick={() => signOut("manual")} className="btn-secondary px-4" title="Sign Out">
                <LogOut size={18} />
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              Unsaved data may be lost if you are signed out
            </p>
          </div>
        </div>
      )}
    </>
  );
}