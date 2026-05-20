"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { Station } from "@/types/database";
import { Building2, Plus, MapPin, Phone, CheckCircle } from "lucide-react";

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("stations")
        .select("*, omc:omcs(name, brand_name)")
        .order("is_main_branch", { ascending: false })
        .order("name");
      if (data) setStations(data);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <>
      <Header title="Stations" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">All fuel stations registered in the system</p>
          <Link href="/settings" className="btn-primary"><Plus size={16} /> Add Station</Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : stations.length === 0 ? (
          <div className="card p-12 text-center">
            <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No stations added yet</p>
            <p className="text-gray-400 text-sm mt-1">Go to Settings to add your first station</p>
            <Link href="/settings" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Add Station</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stations.map((station) => (
              <div key={station.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 size={16} className="text-blue-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-sm">{station.name}</h3>
                      {station.is_main_branch && (
                        <span className="badge bg-blue-100 text-blue-700 text-[10px]">Main Branch</span>
                      )}
                    </div>
                  </div>
                  <CheckCircle size={16} className={station.is_active ? "text-green-500" : "text-gray-300"} />
                </div>
                <div className="space-y-1.5">
                  {(station.district || station.region) && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin size={12} />
                      <span>{[station.district, station.region].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {station.contact_phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={12} />
                      <span>{station.contact_phone}</span>
                    </div>
                  )}
                  {(station.omc as any) && (
                    <p className="text-xs text-gray-400">
                      Supplier: <span className="font-medium text-gray-600">
                        {(station.omc as any).brand_name ?? (station.omc as any).name}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}