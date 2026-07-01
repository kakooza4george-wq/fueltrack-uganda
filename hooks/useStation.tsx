"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface Station {
  id: string; name: string; location: string | null;
  region: string | null; district: string | null;
  contact_person: string | null; contact_phone: string | null;
  omc_id: string | null; ownership_model: string | null;
  is_main_branch: boolean; is_active: boolean;
}

interface StationContextType {
  stations: Station[];
  activeStation: Station | null;
  setActiveStation: (s: Station) => void;
  setStations: (s: Station[]) => void;
  loading: boolean;
}

const StationContext = createContext<StationContextType | null>(null);
const KEY = "fueltrack_active_station";

export function StationProvider({ children }: { children: ReactNode }) {
  const [stations, setStations]               = useState<Station[]>([]);
  const [activeStation, setActiveStationState] = useState<Station | null>(null);
  const [loading, setLoading]                  = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      try { setActiveStationState(JSON.parse(saved)); }
      catch { localStorage.removeItem(KEY); }
    }

    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("stations")
        .select("*")
        .eq("is_active", true)
        .order("is_main_branch", { ascending: false })
        .order("name");
      if (data) {
        setStations(data);
        if (!saved && data.length > 0) {
          const main = data.find((s) => s.is_main_branch) ?? data[0];
          setActiveStationState(main);
          localStorage.setItem(KEY, JSON.stringify(main));
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const setActiveStation = (s: Station) => {
    setActiveStationState(s);
    localStorage.setItem(KEY, JSON.stringify(s));
  };

  return (
    <StationContext.Provider value={{ stations, activeStation, setActiveStation, setStations, loading }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  const ctx = useContext(StationContext);
  if (!ctx) throw new Error("useStation must be used within StationProvider");
  return ctx;
}