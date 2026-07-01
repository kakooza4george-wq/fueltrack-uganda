"use client";

import { useStation } from "@/hooks/useStation";
import { Building2, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function StationSelector() {
  const { stations, activeStation, setActiveStation } = useStation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (stations.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
      >
        <Building2 size={14} className="text-blue-600" />
        <span className="font-semibold text-gray-700 max-w-[140px] truncate">
          {activeStation?.name ?? "Select Station"}
        </span>
        {activeStation?.is_main_branch && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold hidden sm:block">
            Main
          </span>
        )}
        <ChevronDown size={13} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <p className="px-3 py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-100">
            Select Station
          </p>
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveStation(s); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2
                ${activeStation?.id === s.id
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="truncate">{s.name}</span>
              {s.is_main_branch && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  Main
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}