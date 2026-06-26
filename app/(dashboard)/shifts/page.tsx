"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Shift } from "@/types/database";
import { formatDate, shiftLabel, shiftStatusColor } from "@/utils";
import { Clock, Plus, ChevronRight, Calculator, AlertCircle, Loader2 } from "lucide-react";

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
      <Header title="Shifts & Reconciliation" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            {(["all", "open", "closed", "reconciled"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? "bg-blue-700 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Link href="/shifts/new" className="btn-primary py-2.5 px-5 shadow-lg shadow-blue-200 transition-transform hover:scale-105 active:scale-95">
            <Plus size={18} /> New Shift Entry
          </Link>
        </div>

        {!activeStation ? (
          <div className="card p-12 text-center text-gray-400 bg-gray-50 border-dashed border-2">
            <AlertCircle size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Select a station from the top bar to view its shifts.</p>
          </div>
        ) : (
          <div className="card overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-4 text-blue-600" />
                <p>Loading shifts...</p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="p-12 text-center bg-gray-50">
                <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 font-semibold text-lg">No shifts found</p>
                <p className="text-gray-400 mb-6">Start by recording your first shift for today.</p>
                <Link href="/shifts/new" className="btn-primary py-2.5 px-6"><Plus size={18} /> New Shift Entry</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">Date & Time</th>
                      <th className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">Shift Type</th>
                      <th className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">Staff (Supervisor/Cashier)</th>
                      <th className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">Status</th>
                      <th className="px-6 py-4 font-semibold text-gray-700 uppercase text-xs tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{formatDate(s.shift_date)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{s.start_time ?? "—"} to {s.end_time ?? "—"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-bold border border-gray-200">
                            {shiftLabel(s.shift_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-800">S: {s.supervisor_name ?? "—"}</div>
                          <div className="text-sm text-gray-500">C: {s.cashier_name ?? "—"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${shiftStatusColor(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {s.status === "closed" && (
                              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 border border-amber-200">
                                <Calculator size={14} /> Reconcile
                              </button>
                            )}
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        </td>
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