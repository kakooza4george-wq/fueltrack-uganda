"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { formatUGX, formatLitres, today } from "@/utils";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo]     = useState(today());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("vw_daily_station_summary")
        .select("*")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      if (data) setSummary(data);
      setLoading(false);
    };
    load();
  }, [from, to]);

  const byStation = summary.reduce((acc: any, row) => {
    if (!acc[row.station_id]) acc[row.station_id] = {
      name: row.station_name, revenue:0, litres:0, cash:0, momo:0, credit:0, lpo:0,
    };
    acc[row.station_id].revenue += row.total_revenue_ugx ?? 0;
    acc[row.station_id].litres  += row.total_litres_sold ?? 0;
    acc[row.station_id].cash    += row.cash_revenue ?? 0;
    acc[row.station_id].momo    += (row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0);
    acc[row.station_id].credit  += row.credit_revenue ?? 0;
    acc[row.station_id].lpo     += row.lpo_revenue ?? 0;
    return acc;
  }, {});

  const grandRevenue = Object.values(byStation).reduce((s: number, r: any) => s + r.revenue, 0);
  const grandLitres  = Object.values(byStation).reduce((s: number, r: any) => s + r.litres, 0);
  const days = new Set(summary.map((r) => r.transaction_date)).size;

  return (
    <>
      <Header title="Reports" />
      <div className="p-6 space-y-6">

        <div className="card p-4 flex items-center gap-4 flex-wrap">
          <BarChart3 size={18} className="text-blue-600" />
          <span className="text-sm text-gray-600 font-semibold">Period:</span>
          <div className="flex items-center gap-2">
            <input type="date" className="form-input w-auto" value={from}
              onChange={(e) => setFrom(e.target.value)} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" className="form-input w-auto" value={to}
              onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:"Total Revenue",     value: formatUGX(grandRevenue),                          color:"text-green-700" },
            { label:"Total Litres Sold", value: formatLitres(grandLitres),                        color:"text-blue-700" },
            { label:"Stations Active",   value: String(Object.keys(byStation).length),            color:"text-purple-700" },
            { label:"Days in Period",    value: String(days),                                      color:"text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Station Comparison</h2>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : Object.keys(byStation).length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Station</th>
                    <th className="text-right">Litres Sold</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">MoMo</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">LPO</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(byStation).map((s: any) => (
                    <tr key={s.name}>
                      <td className="font-bold text-gray-800">{s.name}</td>
                      <td className="text-right">{formatLitres(s.litres)}</td>
                      <td className="text-right font-black text-green-700">{formatUGX(s.revenue)}</td>
                      <td className="text-right">{formatUGX(s.cash)}</td>
                      <td className="text-right">{formatUGX(s.momo)}</td>
                      <td className="text-right text-amber-700">{formatUGX(s.credit)}</td>
                      <td className="text-right">{formatUGX(s.lpo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-black">
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
            <h2 className="font-bold text-gray-800">Daily Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : summary.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No sales in this period.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Station</th>
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
                      <td className="text-gray-500 whitespace-nowrap text-sm">{row.transaction_date}</td>
                      <td className="font-semibold text-gray-800">{row.station_name}</td>
                      <td className="text-right">{formatLitres(row.total_litres_sold)}</td>
                      <td className="text-right font-bold text-green-700">{formatUGX(row.total_revenue_ugx)}</td>
                      <td className="text-right text-gray-600">{formatUGX(row.cash_revenue)}</td>
                      <td className="text-right text-gray-600">{formatUGX((row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0))}</td>
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