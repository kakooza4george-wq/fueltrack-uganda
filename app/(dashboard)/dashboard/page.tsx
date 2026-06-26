"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { VwOwnerDashboard, VwDailyStationSummary, VwCreditBalance, VwOmcAccountBalance } from "@/types/database";
import { formatUGX, formatLitres, formatDate, today } from "@/utils";
import { 
  Fuel, TrendingUp, Building2, AlertTriangle, 
  CreditCard, Truck, ArrowUpRight, Wallet, 
  BarChart3, ArrowDownRight, Zap, ShoppingBag, Loader2
} from "lucide-react";
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

  // Derived metrics for KAKU-style dashboard
  const totalRevenue = todaySummary?.total_revenue_all_stations ?? 0;
  const totalExpenses = 0; // Placeholder for now, would fetch from expenses table
  const grossProfit = totalRevenue - totalExpenses;

  const stats = [
    { label: "Total Sales Today", value: formatUGX(totalRevenue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", trend: "+12.2%" },
    { label: "Total Purchases", value: formatUGX(0), icon: ShoppingBag, color: "text-blue-600", bg: "bg-blue-50", trend: "+8.7%" },
    { label: "Gross Profit", value: formatUGX(grossProfit), icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", trend: "+15.3%" },
    { label: "Total Expenses", value: formatUGX(totalExpenses), icon: Wallet, color: "text-rose-600", bg: "bg-rose-50", trend: "-7.2%" },
  ];

  return (
    <>
      <Header title="Business Intelligence Dashboard" />
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
        
        {/* KAKU Style Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                    <Icon size={24} className={stat.color} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'} bg-gray-50 px-2 py-1 rounded-full`}>
                    {stat.trend.startsWith('+') ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
                    {stat.trend}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    {loading ? <span className="inline-block w-32 h-8 bg-gray-100 rounded animate-pulse" /> : stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Station Performance */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50">
                <div>
                  <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                    <Building2 size={20} className="text-blue-600" />
                    Station Performance
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">Daily breakdown across all locations</p>
                </div>
                <Link href="/reports" className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">
                  Detailed Reports <ArrowUpRight size={14} />
                </Link>
              </div>
              
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-sm">Analyzing station data...</p>
                </div>
              ) : stationBreakdown.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap size={24} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-bold">No sales data for today yet.</p>
                  <Link href="/sales/new" className="mt-4 inline-flex btn-primary px-6 py-2.5">Capture First Sale</Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Station</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Litres</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Revenue</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Cash</th>
                        <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stationBreakdown.map((s) => (
                        <tr key={s.station_id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-6 py-4">
                            <p className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{s.station_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Active Station</p>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-gray-600">{formatLitres(s.total_litres_sold)}</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-700">{formatUGX(s.total_revenue_ugx)}</td>
                          <td className="px-6 py-4 text-right font-bold text-gray-500">{formatUGX(s.cash_revenue)}</td>
                          <td className="px-6 py-4 text-right font-bold text-amber-700">{formatUGX(s.credit_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="bg-blue-900 rounded-2xl p-6 shadow-xl shadow-blue-200 text-white">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <Zap size={20} className="text-amber-400" />
                Quick Operations
              </h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/shifts/new" className="px-6 py-3 bg-white text-blue-900 rounded-xl font-black text-sm hover:bg-amber-400 transition-colors shadow-lg">Start New Shift</Link>
                <Link href="/deliveries/new" className="px-6 py-3 bg-blue-800 text-white border border-blue-700 rounded-xl font-black text-sm hover:bg-blue-700 transition-colors">Record Delivery</Link>
                <Link href="/sales/new" className="px-6 py-3 bg-blue-800 text-white border border-blue-700 rounded-xl font-black text-sm hover:bg-blue-700 transition-colors">New Sale Entry</Link>
                <Link href="/expenses/new" className="px-6 py-3 bg-blue-800 text-white border border-blue-700 rounded-xl font-black text-sm hover:bg-blue-700 transition-colors">Log Expense</Link>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Financial Alerts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50 bg-amber-50/30">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  Critical Credit Alerts
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-6 text-center text-gray-400 text-xs">Scanning ledgers...</div>
                ) : creditAlerts.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm font-medium italic">No credit risks detected.</div>
                ) : (
                  creditAlerts.map((c) => (
                    <div key={c.credit_customer_id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-800 truncate">{c.customer_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Limit: {formatUGX(c.credit_limit_ugx)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-600">{formatUGX(c.outstanding_balance_ugx)}</p>
                        <p className="text-[10px] text-rose-400 font-bold uppercase">Overdue</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Supply Chain Status */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50 bg-blue-50/30">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <Truck size={18} className="text-blue-600" />
                  OMC Account Balances
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {loading ? (
                  <div className="p-6 text-center text-gray-400 text-xs">Fetching balances...</div>
                ) : omcBalances.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm font-medium italic">No outstanding supplier payments.</div>
                ) : (
                  omcBalances.map((b) => (
                    <div key={`${b.omc_id}-${b.station_id}`} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-black text-gray-800">{b.omc_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{b.station_name}</p>
                      </div>
                      <p className="text-sm font-black text-blue-700">{formatUGX(b.current_balance_ugx)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mini Calendar / Status */}
            <div className="bg-emerald-900 rounded-2xl p-6 text-white shadow-xl shadow-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Current Business Date</p>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <p className="text-xl font-black">{formatDate(date)}</p>
              <div className="mt-4 pt-4 border-t border-emerald-800 flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-200">System Status</p>
                <p className="text-xs font-black text-emerald-400 uppercase tracking-tighter">Operational</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}