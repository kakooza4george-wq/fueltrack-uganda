"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Expense } from "@/types/database";
import { formatDate, formatUGX, today } from "@/utils";
import { Receipt, Plus, Loader2 } from "lucide-react";

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
  transport: "Transport", cleaning: "Cleaning", advertising: "Advertising", other: "Other",
};

export default function ExpensesPage() {
  const { activeStation } = useStation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(today().slice(0, 7));

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      
      // Calculate start and end of month more reliably
      const startDate = `${month}-01`;
      const lastDay = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0).getDate();
      const endDate = `${month}-${lastDay}`;

      const { data, error } = await supabase
        .from("expenses").select("*")
        .eq("station_id", activeStation.id)
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });
      
      if (error) {
        console.error("Error loading expenses:", error);
      } else if (data) {
        setExpenses(data);
      }
      setLoading(false);
    };
    load();
  }, [activeStation, month]);

  const total = expenses.reduce((sum, e) => sum + e.amount_ugx, 0);

  return (
    <>
      <Header title="Expenses" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <input type="month" className="form-input w-auto" value={month}
              onChange={(e) => setMonth(e.target.value)} />
            {!loading && expenses.length > 0 && (
              <span className="text-sm font-semibold text-red-600">Total: {formatUGX(total)}</span>
            )}
          </div>
          <Link href="/expenses/new" className="btn-primary"><Plus size={16} /> Add Expense</Link>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 flex justify-center items-center text-gray-400 text-sm">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading...
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No expenses this month</p>
              <Link href="/expenses/new" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Add Expense</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Category</th><th>Description</th>
                    <th>Payee</th><th>Payment</th><th>Receipt #</th>
                    <th className="text-right">Amount</th><th>Entered By</th>
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
                      <td className="text-gray-600 text-xs max-w-[160px] truncate">{e.sub_description ?? "—"}</td>
                      <td className="text-gray-700">{e.payee ?? "—"}</td>
                      <td className="text-gray-500 text-xs capitalize">{e.payment_method?.replace("_", " ") ?? "—"}</td>
                      <td className="text-gray-400 text-xs font-mono">{e.receipt_reference ?? "—"}</td>
                      <td className="text-right font-semibold text-red-700">{formatUGX(e.amount_ugx)}</td>
                      <td className="text-gray-400 text-xs">{e.entered_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-600">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{formatUGX(total)}</td>
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