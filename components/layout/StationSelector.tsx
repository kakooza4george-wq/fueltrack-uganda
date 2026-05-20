"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useStation } from "@/hooks/useStation";
import { Station } from "@/types/database";
import { cn } from "@/utils";

export default function StationSelector() {
  const { activeStation, setActiveStation, setStations } = useStation();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("stations").select("*")
        .eq("is_active", true).order("is_main_branch", { ascending: false }).order("name");
      if (data) {
        setList(data); setStations(data);
        if (!activeStation && data.length > 0) {
          setActiveStation(data.find((s) => s.is_main_branch) ?? data[0]);
        }
      }
      setLoading(false);
    };
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-400 text-sm">
      <Loader2 size={16} className="animate-spin" /><span>Loading...</span>
    </div>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 shadow-sm">
        <Building2 size={16} className="text-blue-700" />
        <span className="max-w-[160px] truncate">{activeStation?.name ?? "Select Station"}</span>
        {activeStation?.is_main_branch && <span className="badge bg-blue-100 text-blue-700 text-[10px]">HQ</span>}
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Entering data for...</p>
            </div>
            <ul className="py-1 max-h-64 overflow-y-auto">
              {list.map((s) => (
                <li key={s.id}>
                  <button onClick={() => { setActiveStation(s); setOpen(false); }}
                    className={cn("w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left", activeStation?.id === s.id && "bg-blue-50")}>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", activeStation?.id === s.id ? "text-blue-700" : "text-gray-800")}>
                        {s.name}{s.is_main_branch && <span className="ml-2 badge bg-blue-100 text-blue-700 text-[10px]">Main</span>}
                      </p>
                      {s.district && <p className="text-xs text-gray-500 mt-0.5">{s.district}{s.region ? ` — ${s.region}` : ""}</p>}
                    </div>
                    {activeStation?.id === s.id && <Check size={16} className="text-blue-700" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}