"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatDate, formatUGX, formatLitres } from "@/utils";
import {
  Clock, Plus, CheckCircle, AlertCircle, ChevronRight
} from "lucide-react";

interface ShiftDetail {
  shift_id: string;
  station_name: string;
  shift_date: string;
  shift_type: string;
  status: string;
  supervisor_name: string | null;
  cashier_name: string | null;
  total_litres_from_meters: number;
  total_sales_ugx: number;
  sales_count: number;
}

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning  06:00 – 14:00",
  afternoon: "Afternoon  14:00 – 22:00",
  night: "Night  22:00 – 06:00",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  open:        { bg: "bg-green-100",  text: "text-green-700",  icon: Clock,        label: "Open" },
  closed:      { bg: "bg-amber-100",  text: "text-amber-700",  icon: AlertCircle,  label: "Closed — Needs Reconciliation" },
  reconciled:  { bg: "bg-blue-100",   text: "text-blue-700",   icon: CheckCircle,  label: "Reconciled" },
};

export default function ShiftsPage() {
  const { activeStation } = useStation();
  const [shifts, setShifts] = useState<ShiftDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"today" | "week" | "all">("today");

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from("vw_shift_detail")
        .select("*")
        .eq("station_id", activeStation.id)
        .order("shift_date", { ascending: false })
        .order("shift_type");

      const todayStr = new Date().toISOString().split("T")[0];
      if (filter === "today") {
        query = query.eq("shift_date", todayStr);
      } else if (filter === "week") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];
        query = query.gte("shift_date", weekAgo);
      }

      const { data } = await query.limit(100);
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
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["today", "week", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize
                  ${filter === f ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {f === "today" ? "Today" : f === "week" ? "This Week" : "All Time"}
              </button>
            ))}
          </div>
          <Link href="/shifts/new" className="btn-primary">
            <Plus size={16} /> Open Shift
          </Link>
        </div>

        {!activeStation ? (
          <div className="card p-10 text-center text-gray-400 text-sm">
            Select a station from the top bar to view shifts.
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-semibold">No shifts found</p>
            <p className="text-gray-400 text-sm mt-1">Open a shift to start the day</p>
            <Link href="/shifts/new" className="btn-primary inline-flex mt-4">
              <Plus size={16} /> Open First Shift
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((sh) => {
              const st = STATUS_STYLES[sh.status] ?? STATUS_STYLES.open;
              const StatusIcon = st.icon;
              const needsAction = sh.status === "open" || sh.status === "closed";

              return (
                <Link
                  key={sh.shift_id}
                  href={`/shifts/${sh.shift_id}`}
                  className="card p-5 flex items-center gap-5 hover:shadow-md transition-all cursor-pointer block"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${st.bg}`}>
                    <StatusIcon size={22} className={st.text} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-bold text-gray-800">
                        {SHIFT_LABELS[sh.shift_type] ?? sh.shift_type}
                      </p>
                      <span className={`badge ${st.bg} ${st.text} text-xs`}>
                        {st.label}
                      </span>
                      {needsAction && (
                        <span className="badge bg-red-100 text-red-600 text-xs">
                          Action Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(sh.shift_date)} &nbsp;·&nbsp;
                      Supervisor: {sh.supervisor_name ?? "—"} &nbsp;·&nbsp;
                      Cashier: {sh.cashier_name ?? "—"}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>
                        Meters: <span className="font-semibold text-gray-600">
                          {formatLitres(sh.total_litres_from_meters)}
                        </span>
                      </span>
                      <span>
                        Sales recorded: <span className="font-semibold text-gray-600">
                          {sh.sales_count} transactions — {formatUGX(sh.total_sales_ugx)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sh.status === "open" && (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                        Close Shift
                      </span>
                    )}
                    {sh.status === "closed" && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                        Reconcile
                      </span>
                    )}
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}