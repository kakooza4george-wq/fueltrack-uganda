"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { Building2, MapPin, Phone, User } from "lucide-react";

export default function StationsPage() {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("stations")
        .select("*, omc:omcs(brand_name, name)")
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
          <p className="text-sm text-gray-500">All stations managed from this main branch</p>
          <Link href="/setup" className="btn-secondary text-sm">
            Manage in Setup
          </Link>
        </div>

        {loading ? (
          <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stations.map((s) => (
              <div key={s.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Building2 size={20} className="text-blue-700" />
                  </div>
                  <div className="flex gap-1.5">
                    {s.is_main_branch && (
                      <span className="badge bg-blue-100 text-blue-700 text-xs">Main Branch</span>
                    )}
                    <span className={`badge text-xs ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{s.name}</h3>
                  {s.omc && (
                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                      {s.omc.brand_name ?? s.omc.name}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 text-sm">
                  {(s.district || s.region) && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                      <span>{[s.location, s.district, s.region].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {s.contact_person && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <User size={13} className="text-gray-400 flex-shrink-0" />
                      <span>{s.contact_person}</span>
                    </div>
                  )}
                  {s.contact_phone && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone size={13} className="text-gray-400 flex-shrink-0" />
                      <span>{s.contact_phone}</span>
                    </div>
                  )}
                </div>
                {s.ownership_model && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="badge bg-gray-100 text-gray-600 text-xs">
                      {s.ownership_model}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {stations.length === 0 && (
              <div className="card p-12 text-center col-span-3">
                <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No stations yet</p>
                <Link href="/setup" className="btn-primary inline-flex mt-4">
                  Add Station in Setup
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}