"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import StationSelector from "./StationSelector";
import { LogOut, User } from "lucide-react";

export default function Header({ title }: { title?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const get = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);
    };
    get();
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-20">
      <div>
        {title && (
          <h1 className="text-base font-bold text-gray-800">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        <StationSelector />
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
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}