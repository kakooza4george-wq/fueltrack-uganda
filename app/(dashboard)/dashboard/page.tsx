"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatLitres, today } from "@/utils";
import {
  TrendingUp, Fuel, AlertTriangle, Truck,
  Clock, ArrowRight, CheckCircle
} from "lucide-react";

interface StockLevel {
  product_name: string;
  product_code: string;
  current_stock_litres: number;
  station_name: string;
}

interface DailySummary {
  station_name: string;
  station_id: string;
  total_revenue_ugx: number;
  total_litres_sold: number;
  cash_revenue: number;
  momo_revenue: number;
  airtel_revenue: number;
  credit_revenue: number;
}

interface OmcBalance {
  omc_name: string;
  station_name: string;
  current_balance_ugx: number;
}

export default function DashboardPage() {
  const { activeStation } = useStation();
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [omcBalances, setOmcBalances] = useState<OmcBalance[]>([]);
  const [openShifts, setOpenShifts] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const date = today();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();

      const [sumRes, stockRes, omcRes, shiftRes] = await Promise.all([
        supabase
          .from("vw_daily_station_summary")
          .select("*")
          .eq("transaction_date", date),
        supabase
          .from("vw_current_stock")
          .select("product_name, product_code, current_stock_litres, station_name"),
        supabase
          .from("vw_omc_account_balance")
          .select("omc_name, station_name, current_balance_ugx")
          .gt("current_balance_ugx", 0),
        supabase
          .from("shifts")
          .select("id", { count: "exact" })
          .eq("status", "open")
          .eq("shift_date", date),
      ]);

      if (sumRes.data) setSummary(sumRes.data);
      if (stockRes.data) setStock(stockRes.data);
      if (omcRes.data) setOmcBalances(omcRes.data);
      if (shiftRes.count !== null) setOpenShifts(shiftRes.count);
      setLoading(false);
    };
    load();
  }, [date]);

  const totalRevenue = summary.reduce((s, r) => s + (r.total_revenue_ugx || 0), 0);
  const totalLitres = summary.reduce((s, r) => s + (r.total_litres_sold || 0), 0);
  const totalOMCOwed = omcBalances.reduce((s, b) => s + (b.current_balance_ugx || 0), 0);
  const lowStock = stock.filter((s) => s.current_stock_litres < 2000 && s.current_stock_litres > 0);
  const emptyStock = stock.filter((s) => s.current_stock_litres <= 0);

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">

        {/* Alerts */}
        {(emptyStock.length > 0 || lowStock.length > 0) && (
          <div className="space-y-2">
            {emptyStock.map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-sm font-semibold">
                  {s.station_name} — {s.product_name} is completely empty. Record a delivery to continue sales.
                </p>
                <Link href="/deliveries/new" className="ml-auto btn-danger btn-sm whitespace-nowrap">
                  Record Delivery
                </Link>
              </div>
            ))}
            {lowStock.map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
                <p className="text-amber-700 text-sm font-medium">
                  {s.station_name} — {s.product_name} is low: only {formatLitres(s.current_stock_litres)} remaining.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Today's Quick Actions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Today at a Glance</h2>
            <span className="text-xs text-gray-400">{new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/workflow" className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-all text-center">
              <CheckCircle size={24} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Today's Workflow</span>
            </Link>
            <Link href="/shifts/new" className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-all text-center">
              <Clock size={24} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700">Open Shift</span>
            </Link>
            <Link href="/sales/new" className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all text-center">
              <Fuel size={24} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Record Sale</span>
            </Link>
            <Link href="/deliveries/new" className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-all text-center">
              <Truck size={24} className="text-purple-600" />
              <span className="text-xs font-semibold text-purple-700">Record Delivery</span>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Today's Revenue", value: formatUGX(totalRevenue), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
            { label: "Litres Sold Today", value: formatLitres(totalLitres), icon: Fuel, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "OMC Balance Owed", value: formatUGX(totalOMCOwed), icon: Truck, color: "text-red-600", bg: "bg-red-50" },
            { label: "Open Shifts", value: openShifts.toString(), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="stat-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-gray-900">
                      {loading
                        ? <span className="inline-block w-24 h-7 bg-gray-100 rounded animate-pulse" />
                        : stat.value}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon size={20} className={stat.color} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Today's sales by station */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Today — Station Breakdown</h3>
              <Link href="/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Full Reports <ArrowRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : summary.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No sales recorded today yet.</p>
                <Link href="/sales/new" className="btn-primary btn-sm inline-flex mt-3">
                  Record First Sale
                </Link>
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
                      <th className="text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.station_id}>
                        <td className="font-semibold text-gray-800">{s.station_name}</td>
                        <td className="text-right text-gray-600">{formatLitres(s.total_litres_sold)}</td>
                        <td className="text-right font-bold text-green-700">{formatUGX(s.total_revenue_ugx)}</td>
                        <td className="text-right text-gray-500">{formatUGX(s.cash_revenue)}</td>
                        <td className="text-right text-amber-600">{formatUGX(s.credit_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Stock levels */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Live Stock Levels</h3>
              <Link href="/stock" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Manage Stock <ArrowRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : stock.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No stock data yet.</p>
                <Link href="/stock" className="btn-primary btn-sm inline-flex mt-3">
                  Set Opening Stock
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stock.map((s, i) => {
                  const isLow = s.current_stock_litres < 2000;
                  const isEmpty = s.current_stock_litres <= 0;
                  return (
                    <div key={i} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{s.product_name}</p>
                        <p className="text-xs text-gray-400">{s.station_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-lg ${isEmpty ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600"}`}>
                          {isEmpty ? "EMPTY" : formatLitres(s.current_stock_litres)}
                        </p>
                        {isLow && !isEmpty && (
                          <p className="text-xs text-amber-500">Low stock</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* OMC Balances */}
        {omcBalances.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Outstanding OMC Balances</h3>
              <Link href="/suppliers" className="text-xs text-blue-600 hover:underline">
                Manage Suppliers
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>OMC</th>
                    <th>Station</th>
                    <th className="text-right">Balance Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {omcBalances.map((b, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-gray-800">{b.omc_name}</td>
                      <td className="text-gray-600">{b.station_name}</td>
                      <td className="text-right font-bold text-red-600">{formatUGX(b.current_balance_ugx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}