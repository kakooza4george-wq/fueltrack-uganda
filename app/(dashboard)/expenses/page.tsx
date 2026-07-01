"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatDate, formatUGX, today } from "@/utils";
import { Receipt, Plus } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  salaries: "Staff Salaries", nssf: "NSSF", paye: "PAYE (URA)",
  withholding_tax: "Withholding Tax", income_tax: "Income Tax",
  rent: "Rent / Lease", electricity: "Electricity (UMEME)",
  water: "Water (NWSC)", internet_airtime: "Internet & Airtime",
  security: "Security", generator_fuel: "Generator Fuel",
  maintenance_pumps: "Pump Maintenance", maintenance_other: "Other Maintenance",
  lubricant_purchase: "Lubricant Purchase", shop_stock: "Shop Stock",
  car_wash_supplies: "Car Wash Supplies", uniforms: "Uniforms",
  stationery: "Stationery & EFD Rolls", insurance: "Insurance",
  licence_fees: "Licence Fees", banking_charges: "Banking Charges",
  transport: "Transport", cleaning: "Cleaning",
  advertising: "Advertising", other: "Other",
};

export default function ExpensesPage() {
  const { activeStation } = useStation();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(today().slice(0, 7));

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("station_id", activeStation.id)
        .gte("expense_date", `${month}-01`)
        .lte("expense_date", `${month}-31`)
        .order("expense_date", { ascending: false });
      if (data) setExpenses(data);
      setLoading(false);
    };
    load();
  }, [activeStation, month]);

  const total = expenses.reduce((s, e) => s + (e.amount_ugx ?? 0), 0);

  const grouped = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount_ugx;
    return acc;
  }, {});

  return (
    <>
      <Header title="Expenses" />
      <div className="p-6 space-y-5">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-500">Month:</label>
            <input type="month" className="form-input w-auto" value={month}
              onChange={(e) => setMonth(e.target.value)} />
            {!loading && expenses.length > 0 && (
              <span className="text-sm font-bold text-red-600">Total: {formatUGX(total)}</span>
            )}
          </div>
          <Link href="/expenses/new" className="btn-primary">
            <Plus size={16} /> Add Expense
          </Link>
        </div>

        {!loading && Object.keys(grouped).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => (
              <div key={cat} className="card p-3">
                <p className="text-xs text-gray-400 truncate">{CATEGORY_LABELS[cat] ?? cat}</p>
                <p className="font-bold text-red-600 text-sm mt-0.5">{formatUGX(amt)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No expenses this month</p>
              <Link href="/expenses/new" className="btn-primary inline-flex mt-4">
                <Plus size={16} /> Add Expense
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Category</th><th>Description</th>
                    <th>Payee</th><th>Payment</th><th>Receipt #</th>
                    <th className="text-right">Amount</th><th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{formatDate(e.expense_date)}</td>
                      <td>
                        <span className="badge bg-orange-50 text-orange-700 text-xs">
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                      </td>
                      <td className="text-gray-600 text-xs max-w-[160px] truncate">
                        {e.sub_description ?? "—"}
                      </td>
                      <td className="text-gray-700">{e.payee ?? "—"}</td>
                      <td className="text-gray-500 text-xs capitalize">
                        {e.payment_method?.replace("_", " ") ?? "—"}
                      </td>
                      <td className="text-gray-400 text-xs font-mono">{e.receipt_reference ?? "—"}</td>
                      <td className="text-right font-bold text-red-600">{formatUGX(e.amount_ugx)}</td>
                      <td className="text-gray-400 text-xs">{e.entered_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-3 font-bold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-right font-black text-red-600 text-base">
                      {formatUGX(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}