"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { VwOwnerDashboard, VwDailyStationSummary, VwCreditBalance, VwOmcAccountBalance } from "@/types/database";
import { formatUGX, formatLitres, formatDate, today } from "@/utils";
import { Fuel, TrendingUp, Building2, AlertTriangle, CreditCard, Truck, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [todaySummary, setTodaySummary] = useState<VwOwnerDashboard | null>(null);
  const [stationBreakdown, setStationBreakdown] = useState<VwDailyStationSummary[]>([]);
  const [creditAlerts, setCreditAlerts] = useState<VwCreditBalance[]>([]);
  const [omcBalances, setOmcBalances] = useState<VwOmcAccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const date = today();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [ownerRes, stationRes, creditRes, omcRes] = await Promise.all([
        supabase.from("vw_owner_dashboard").select("*").eq("transaction_date", date).single(),
        supabase.from("vw_daily_station_summary").select("*").eq("transaction_date", date).order("total_revenue_ugx", { ascending: false }),
        supabase.from("vw_credit_balances").select("*").gt("outstanding_balance_ugx", 0).order("outstanding_balance_ugx", { ascending: false }).limit(5),
        supabase.from("vw_omc_account_balance").select("*").gt("current_balance_ugx", 0).order("current_balance_ugx", { ascending: false }),
      ]);
      if (ownerRes.data) setTodaySummary(ownerRes.data);
      if (stationRes.data) setStationBreakdown(stationRes.data);
      if (creditRes.data) setCreditAlerts(creditRes.data);
      if (omcRes.data) setOmcBalances(omcRes.data);
      setLoading(false);
    };
    load();
  }, [date]);

  const stats = [
    { label: "Today's Total Revenue", value: formatUGX(todaySummary?.total_revenue_all_stations), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Litres Sold Today", value: formatLitres(todaySummary?.total_litres_all_stations), icon: Fuel, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Stations Active Today", value: todaySummary?.stations_active ?? "—", icon: Building2, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Credit Sales Today", value: formatUGX(todaySummary?.total_credit_sales), icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <>
      <Header title="Owner Dashboard" />
      <div className="p-6 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="stat-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {loading ? <span className="inline-block w-32 h-7 bg-gray-100 rounded animate-pulse" /> : stat.value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={stat.color} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatDate(date)}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Station Breakdown */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Stations — Today</h2>
              <Link href="/reports" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Full Reports <ArrowUpRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : stationBreakdown.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No sales entered for today yet.</p>
                <Link href="/sales/new" className="btn-primary btn-sm mt-3 inline-flex">Enter Sales</Link>
              </div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {stationBreakdown.map((s) => (
                      <tr key={s.station_id}>
                        <td className="font-medium text-gray-800">{s.station_name}</td>
                        <td className="text-right text-gray-600">{formatLitres(s.total_litres_sold)}</td>
                        <td className="text-right font-semibold text-green-700">{formatUGX(s.total_revenue_ugx)}</td>
                        <td className="text-right text-gray-600">{formatUGX(s.cash_revenue)}</td>
                        <td className="text-right text-gray-600">{formatUGX(s.momo_revenue + s.airtel_revenue)}</td>
                        <td className="text-right text-amber-700">{formatUGX(s.credit_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">

            {/* OMC Balances */}
            <div className="card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <Truck size={16} className="text-blue-600" />
                <h3 className="font-semibold text-gray-800 text-sm">OMC Balances Owed</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
                ) : omcBalances.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">No outstanding balances</div>
                ) : (
                  omcBalances.map((b) => (
                    <div key={`${b.omc_id}-${b.station_id}`} className="px-4 py-3 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{b.omc_name}</p>
                        <p className="text-xs text-gray-500">{b.station_name}</p>
                      </div>
                      <p className="text-sm font-semibold text-red-600">{formatUGX(b.current_balance_ugx)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Credit Alerts */}
            <div className="card">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <AlertTriangle size={16} className="text-amber-500" />
                <h3 className="font-semibold text-gray-800 text-sm">Top Credit Balances</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-4 text-center text-gray-400 text-xs">Loading...</div>
                ) : creditAlerts.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-xs">No outstanding credit</div>
                ) : (
                  creditAlerts.map((c) => (
                    <div key={c.credit_customer_id} className="px-4 py-3 flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.customer_name}</p>
                        <p className="text-xs text-gray-400">Limit: {formatUGX(c.credit_limit_ugx)}</p>
                      </div>
                      <p className="text-sm font-semibold text-amber-700 flex-shrink-0 ml-2">
                        {formatUGX(c.outstanding_balance_ugx)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {creditAlerts.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <Link href="/credit" className="text-xs text-blue-600 hover:underline">View all →</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-4">
          <p className="section-label mb-3">Quick Actions</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/shifts/new" className="btn-primary">+ New Shift</Link>
            <Link href="/deliveries/new" className="btn-secondary">+ Fuel Delivery</Link>
            <Link href="/sales/new" className="btn-secondary">+ Sales Entry</Link>
            <Link href="/expenses/new" className="btn-secondary">+ Expense</Link>
            <Link href="/credit/new" className="btn-secondary">+ Credit Payment</Link>
          </div>
        </div>

      </div>
    </>
  );
}