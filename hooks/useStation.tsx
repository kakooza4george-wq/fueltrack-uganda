"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Station } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

interface StationContextType {
  stations: Station[];
  activeStation: Station | null;
  setActiveStation: (station: Station) => void;
  setStations: (stations: Station[]) => void;
  loading: boolean;
}

const StationContext = createContext<StationContextType | null>(null);
const STORAGE_KEY = "fueltrack_active_station";

export function StationProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>([]);
  const [activeStation, setActiveStationState] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setActiveStationState(JSON.parse(saved)); }
      catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setLoading(false);
  }, []);

  const setActiveStation = (station: Station) => {
    setActiveStationState(station);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(station));
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