"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Shift } from "@/types/database";
import { formatDate, shiftLabel, shiftStatusColor } from "@/utils";
import { Clock, Plus } from "lucide-react";

export default function ShiftsPage() {
  const { activeStation } = useStation();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "reconciled">("all");

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      let query = supabase
        .from("shifts").select("*")
        .eq("station_id", activeStation.id)
        .order("shift_date", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      if (data) setShifts(data);
      setLoading(false);
    };
    load();
  }, [activeStation, filter]);

  return (
    <>
      <Header title="Shifts" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {(["all", "open", "closed", "reconciled"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Link href="/shifts/new" className="btn-primary"><Plus size={16} /> New Shift</Link>
        </div>

        {!activeStation ? (
          <div className="card p-10 text-center text-gray-400 text-sm">
            Select a station from the top bar to view its shifts.
          </div>
        ) : (
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : shifts.length === 0 ? (
              <div className="p-10 text-center">
                <Clock size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No shifts found</p>
                <Link href="/shifts/new" className="btn-primary mt-4 inline-flex"><Plus size={16} /> New Shift</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Shift</th><th>Supervisor</th>
                      <th>Cashier</th><th>Status</th><th>Entered By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium whitespace-nowrap">{formatDate(s.shift_date)}</td>
                        <td className="text-gray-600 whitespace-nowrap">{shiftLabel(s.shift_type)}</td>
                        <td>{s.supervisor_name ?? "—"}</td>
                        <td>{s.cashier_name ?? "—"}</td>
                        <td><span className={`badge ${shiftStatusColor(s.status)}`}>{s.status}</span></td>
                        <td className="text-gray-400 text-xs">{s.entered_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}