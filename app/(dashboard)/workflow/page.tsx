"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today, formatUGX, formatLitres } from "@/utils";
import {
  Clock, Truck, ShoppingCart, Receipt,
  CheckSquare, ChevronRight,
  AlertTriangle, CheckCircle, ArrowRight
} from "lucide-react";

interface Shift {
  id: string;
  shift_type: string;
  status: string;
  supervisor_name: string | null;
}

interface StockLevel {
  product_name: string;
  current_stock_litres: number;
}

interface TodaySummary {
  total_revenue_ugx: number;
  total_litres_sold: number;
}

export default function WorkflowPage() {
  const { activeStation } = useStation();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [salesCount, setSalesCount] = useState(0);
  const [expensesCount, setExpensesCount] = useState(0);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const date = today();

  const load = async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();

    const [shiftRes, stockRes, sumRes, salesRes, expRes, delRes] = await Promise.all([
      supabase.from("shifts").select("id, shift_type, status, supervisor_name")
        .eq("station_id", activeStation.id).eq("shift_date", date),
      supabase.from("vw_current_stock").select("product_name, current_stock_litres")
        .eq("station_id", activeStation.id),
      supabase.from("vw_daily_station_summary").select("total_revenue_ugx, total_litres_sold")
        .eq("station_id", activeStation.id).eq("transaction_date", date).single(),
      supabase.from("sales_transactions").select("id", { count: "exact" })
        .eq("station_id", activeStation.id).eq("transaction_date", date),
      supabase.from("expenses").select("id", { count: "exact" })
        .eq("station_id", activeStation.id).eq("expense_date", date),
      supabase.from("fuel_deliveries").select("id", { count: "exact" })
        .eq("station_id", activeStation.id).eq("delivery_date", date),
    ]);

    if (shiftRes.data) setShifts(shiftRes.data);
    if (stockRes.data) setStock(stockRes.data);
    if (sumRes.data) setSummary(sumRes.data);
    setSalesCount(salesRes.count ?? 0);
    setExpensesCount(expRes.count ?? 0);
    setDeliveriesCount(delRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeStation]);

  const hasOpenShift = shifts.some((s) => s.status === "open");
  const hasAnyShift = shifts.length > 0;
  const hasReconciledShift = shifts.some((s) => s.status === "reconciled");
  const emptyProducts = stock.filter((s) => s.current_stock_litres <= 0);

  const STEPS = [
    {
      number: 1,
      title: "Open Today's Shift",
      description: "Start the day by opening a shift. This records who is on duty and captures opening pump meter readings.",
      done: hasAnyShift,
      href: "/shifts/new",
      actionLabel: hasAnyShift ? "View Shifts" : "Open Shift",
      icon: Clock,
      color: "blue",
      detail: hasAnyShift
        ? `${shifts.length} shift(s) opened today — ${shifts.filter((s) => s.status === "open").length} still open`
        : "No shifts opened yet today",
    },
    {
      number: 2,
      title: "Record Fuel Delivery (if any)",
      description: "If a tanker delivered fuel today, record it here. The stock levels will automatically increase once delivery is confirmed.",
      done: deliveriesCount > 0,
      skipable: true,
      href: "/deliveries/new",
      actionLabel: deliveriesCount > 0 ? "Add Another" : "Record Delivery",
      icon: Truck,
      color: "purple",
      detail: deliveriesCount > 0
        ? `${deliveriesCount} delivery recorded today — stock updated automatically`
        : "No deliveries recorded today",
    },
    {
      number: 3,
      title: "Enter Today's Sales",
      description: "Enter all fuel and product sales for each shift. You can enter sales by amount (UGX) or by litres.",
      done: salesCount > 0,
      href: "/sales/new",
      actionLabel: "Add Sales",
      icon: ShoppingCart,
      color: "green",
      detail: salesCount > 0
        ? `${salesCount} transaction(s) recorded — ${formatUGX(summary?.total_revenue_ugx)} / ${formatLitres(summary?.total_litres_sold)}`
        : "No sales recorded yet",
    },
    {
      number: 4,
      title: "Record Today's Expenses",
      description: "Enter all expenses for today — salaries, electricity, maintenance, generator fuel, or any other costs.",
      done: expensesCount > 0,
      skipable: true,
      href: "/expenses/new",
      actionLabel: expensesCount > 0 ? "Add More" : "Add Expense",
      icon: Receipt,
      color: "orange",
      detail: expensesCount > 0
        ? `${expensesCount} expense(s) recorded today`
        : "No expenses recorded today",
    },
    {
      number: 5,
      title: "Close and Reconcile Shifts",
      description: "End each shift by entering the closing pump meter readings and reconciling the cash collected against sales recorded.",
      done: hasReconciledShift,
      href: "/shifts",
      actionLabel: "Go to Shifts",
      icon: CheckSquare,
      color: "teal",
      detail: hasReconciledShift
        ? "At least one shift has been reconciled today"
        : hasAnyShift
        ? "Shifts are open — close them at end of day"
        : "Open a shift first",
    },
  ];

  const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string; btn: string }> = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-600",   badge: "bg-blue-100 text-blue-700",   btn: "bg-blue-600 hover:bg-blue-700 text-white" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-600", badge: "bg-purple-100 text-purple-700", btn: "bg-purple-600 hover:bg-purple-700 text-white" },
    green:  { bg: "bg-green-50",  border: "border-green-200",  icon: "text-green-600",  badge: "bg-green-100 text-green-700",  btn: "bg-green-600 hover:bg-green-700 text-white" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600", badge: "bg-orange-100 text-orange-700", btn: "bg-orange-600 hover:bg-orange-700 text-white" },
    teal:   { bg: "bg-teal-50",   border: "border-teal-200",   icon: "text-teal-600",   badge: "bg-teal-100 text-teal-700",   btn: "bg-teal-600 hover:bg-teal-700 text-white" },
  };

  return (
    <>
      <Header title="Today's Workflow" />
      <div className="p-6 max-w-3xl mx-auto space-y-4">

        {/* Station + Date banner */}
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-800 text-lg">
              {activeStation?.name ?? "Select a station"}
            </p>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {summary && (
            <div className="text-right">
              <p className="text-2xl font-black text-green-700">{formatUGX(summary.total_revenue_ugx)}</p>
              <p className="text-xs text-gray-400">{formatLitres(summary.total_litres_sold)} sold today</p>
            </div>
          )}
        </div>

        {/* Empty stock alert */}
        {emptyProducts.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-semibold text-sm">Stock Alert</p>
              <p className="text-red-600 text-sm">
                {emptyProducts.map((p) => p.product_name).join(", ")} — empty. Record a delivery to continue selling.
              </p>
            </div>
          </div>
        )}

        {/* Steps */}
        {!activeStation ? (
          <div className="card p-10 text-center text-gray-400 text-sm">
            Select a station from the top bar to see today's workflow.
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const c = colorMap[step.color];
              return (
                <div
                  key={step.number}
                  className={`card border-2 ${step.done ? "border-gray-200" : c.border} overflow-hidden`}
                >
                  <div className={`p-5 ${step.done ? "bg-white" : c.bg}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${step.done ? "bg-green-100" : c.bg}`}>
                          {step.done
                            ? <CheckCircle size={22} className="text-green-600" />
                            : <Icon size={22} className={c.icon} />}
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${step.done ? "bg-green-100 text-green-700" : c.badge}`}>
                          Step {step.number}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-800">{step.title}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
                            <p className={`text-xs mt-2 font-medium ${step.done ? "text-green-600" : "text-gray-400"}`}>
                              {step.done ? "✓ " : "○ "}{step.detail}
                            </p>
                          </div>
                          <Link
                            href={step.href}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${step.done ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : c.btn}`}
                          >
                            {step.actionLabel}
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                        {step.skipable && !step.done && (
                          <p className="text-xs text-gray-400 mt-2">
                            No {step.icon === Truck ? "delivery" : "expense"} today? You can skip this step.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasReconciledShift && salesCount > 0 && (
          <div className="card p-6 text-center bg-green-50 border-2 border-green-300">
            <CheckCircle size={40} className="mx-auto text-green-600 mb-3" />
            <h3 className="font-bold text-green-800 text-lg">Day Complete</h3>
            <p className="text-green-600 text-sm mt-1">
              All steps done for {activeStation?.name} today.
            </p>
            <Link href="/reports" className="btn-success inline-flex mt-4">
              View Today's Report <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}