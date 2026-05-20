"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StationSelector from "./StationSelector";
import { formatDate } from "@/utils";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User } from "lucide-react";

export default function Header({ title }: { title?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        {title && <h1 className="text-lg font-semibold text-gray-800">{title}</h1>}
        <p className="text-xs text-gray-400">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="flex items-center gap-3">
        <StationSelector />

        {/* User info + sign out */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={14} className="text-blue-700" />
          </div>
          {email && (
            <span className="text-xs text-gray-500 hidden sm:block max-w-[140px] truncate">
              {email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
            title="Sign Out"
          >
            <LogOut size={15} />
            <span className="hidden sm:block">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}