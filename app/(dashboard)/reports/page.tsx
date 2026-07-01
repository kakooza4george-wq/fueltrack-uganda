"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { VwDailyStationSummary } from "@/types/database";
import { formatUGX, formatLitres, today } from "@/utils";
import { BarChart3, Loader2 } from "lucide-react";

interface StationStats {
  station_name: string;
  total_revenue: number;
  total_litres: number;
  cash: number;
  momo: number;
  credit: number;
  lpo: number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<VwDailyStationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.from("vw_daily_station_summary")
        .select("*")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      
      if (error) {
        console.error("Error loading reports:", error);
      } else if (data) {
        setSummary(data);
      }
      setLoading(false);
    };
    load();
  }, [from, to]);

  const byStation = summary.reduce((acc, row) => {
    if (!acc[row.station_id]) {
      acc[row.station_id] = {
        station_name: row.station_name,
        total_revenue: 0,
        total_litres: 0,
        cash: 0,
        momo: 0,
        credit: 0,
        lpo: 0,
      };
    }
    acc[row.station_id].total_revenue += row.total_revenue_ugx;
    acc[row.station_id].total_litres += row.total_litres_sold;
    acc[row.station_id].cash += row.cash_revenue;
    acc[row.station_id].momo += (row.momo_revenue || 0) + (row.airtel_revenue || 0);
    acc[row.station_id].credit += row.credit_revenue;
    acc[row.station_id].lpo += row.lpo_revenue;
    return acc;
  }, {} as Record<string, StationStats>);

  const statsArray = Object.values(byStation);
  const grandRevenue = statsArray.reduce((s, r) => s + r.total_revenue, 0);
  const grandLitres = statsArray.reduce((s, r) => s + r.total_litres, 0);
  const days = new Set(summary.map((r) => r.transaction_date)).size;

  return (
    <>
      <Header title="Reports" />
      <div className="p-6 space-y-6">

        <div className="card p-4 flex items-center gap-4 flex-wrap">
          <BarChart3 size={18} className="text-blue-600" />
          <span className="text-sm text-gray-600 font-medium">Period:</span>
          <input type="date" className="form-input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="form-input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: formatUGX(grandRevenue), color: "text-green-700" },
            { label: "Total Litres Sold", value: formatLitres(grandLitres), color: "text-blue-700" },
            { label: "Stations Reporting", value: statsArray.length, color: "text-purple-700" },
            { label: "Days in Period", value: days, color: "text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Station Comparison</h2>
          </div>
          {loading ? (
            <div className="p-10 flex justify-center items-center text-gray-400 text-sm">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading...
            </div>
          ) : statsArray.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Station</th>
                    <th className="text-right">Litres</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">MoMo</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">LPO</th>
                  </tr>
                </thead>
                <tbody>
                  {statsArray.map((s) => (
                    <tr key={s.station_name}>
                      <td className="font-semibold text-gray-800">{s.station_name}</td>
                      <td className="text-right">{formatLitres(s.total_litres)}</td>
                      <td className="text-right font-bold text-green-700">{formatUGX(s.total_revenue)}</td>
                      <td className="text-right">{formatUGX(s.cash)}</td>
                      <td className="text-right">{formatUGX(s.momo)}</td>
                      <td className="text-right text-amber-700">{formatUGX(s.credit)}</td>
                      <td className="text-right">{formatUGX(s.lpo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-gray-700">TOTAL</td>
                    <td className="px-4 py-3 text-right text-blue-700">{formatLitres(grandLitres)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatUGX(grandRevenue)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Daily Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 flex justify-center items-center text-gray-400 text-sm">
                <Loader2 className="animate-spin mr-2" size={18} /> Loading...
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th className="text-right">Litres</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">MoMo</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={`${row.station_id}-${row.transaction_date}`}>
                      <td className="text-gray-500 whitespace-nowrap">{row.transaction_date}</td>
                      <td className="font-medium text-gray-800">{row.station_name}</td>
                      <td className="text-right">{formatLitres(row.total_litres_sold)}</td>
                      <td className="text-right font-semibold text-green-700">{formatUGX(row.total_revenue_ugx)}</td>
                      <td className="text-right">{formatUGX(row.cash_revenue)}</td>
                      <td className="text-right">{formatUGX((row.momo_revenue || 0) + (row.airtel_revenue || 0))}</td>
                      <td className="text-right text-amber-700">{formatUGX(row.credit_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}