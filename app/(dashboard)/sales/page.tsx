"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatLitres, paymentLabel, today } from "@/utils";
import { ShoppingCart, Plus, Filter } from "lucide-react";

export default function SalesPage() {
  const { activeStation } = useStation();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("sales_transactions")
        .select(`
          id, transaction_date, transaction_time, quantity,
          unit_price_ugx, net_amount_ugx, payment_type,
          momo_reference, lpo_number, vehicle_reg, efd_receipt_number,
          entered_by,
          product:products(name, product_code, is_fuel),
          credit_customer:credit_customers(name)
        `)
        .eq("station_id", activeStation.id)
        .eq("transaction_date", date)
        .order("created_at", { ascending: false });
      if (data) setSales(data);
      setLoading(false);
    };
    load();
  }, [activeStation, date]);

  const totalRevenue = sales.reduce((s, r) => s + (r.net_amount_ugx ?? 0), 0);
  const totalLitres  = sales.filter((s) => s.product?.is_fuel)
    .reduce((s, r) => s + (r.quantity ?? 0), 0);

  const paymentBadge = (type: string) => ({
    cash:         "bg-green-100 text-green-700",
    mtn_momo:     "bg-yellow-100 text-yellow-700",
    airtel_money: "bg-red-100 text-red-700",
    fuel_card:    "bg-blue-100 text-blue-700",
    credit:       "bg-purple-100 text-purple-700",
    lpo:          "bg-orange-100 text-orange-700",
    bank_pos:     "bg-gray-100 text-gray-700",
  }[type] ?? "bg-gray-100 text-gray-600");

  return (
    <>
      <Header title="Sales" />
      <div className="p-6 space-y-5">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Filter size={15} className="text-gray-400" />
            <label className="text-sm text-gray-500">Date:</label>
            <input type="date" className="form-input w-auto" value={date}
              onChange={(e) => setDate(e.target.value)} />
            {!loading && sales.length > 0 && (
              <div className="flex gap-4 ml-2">
                <span className="text-sm font-bold text-green-700">{formatUGX(totalRevenue)}</span>
                <span className="text-sm font-medium text-blue-600">{formatLitres(totalLitres)} fuel</span>
              </div>
            )}
          </div>
          <Link href="/sales/new" className="btn-primary">
            <Plus size={16} /> Record Sale
          </Link>
        </div>

        {!loading && sales.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { type: "cash",     label: "Cash" },
              { type: "mtn_momo", label: "MTN MoMo" },
              { type: "credit",   label: "Credit" },
              { type: "lpo",      label: "LPO" },
            ].map(({ type, label }) => {
              const total = sales
                .filter((s) => s.payment_type === type ||
                  (type === "mtn_momo" && s.payment_type === "airtel_money"))
                .reduce((s, r) => s + (r.net_amount_ugx ?? 0), 0);
              return (
                <div key={type} className="card p-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{formatUGX(total)}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : sales.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No sales for this date</p>
              <Link href="/sales/new" className="btn-primary inline-flex mt-4">
                <Plus size={16} /> Record Sale
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th><th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price/L</th>
                    <th className="text-right">Amount</th>
                    <th>Payment</th>
                    <th>Ref / Customer</th>
                    <th>EFD #</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-gray-400 text-xs whitespace-nowrap">
                        {s.transaction_time ?? "—"}
                      </td>
                      <td className="font-medium text-gray-800">{s.product?.name ?? "—"}</td>
                      <td className="text-right text-gray-600">
                        {s.product?.is_fuel ? formatLitres(s.quantity) : s.quantity}
                      </td>
                      <td className="text-right text-gray-500 text-xs">
                        {formatUGX(s.unit_price_ugx)}
                      </td>
                      <td className="text-right font-bold text-green-700">
                        {formatUGX(s.net_amount_ugx)}
                      </td>
                      <td>
                        <span className={`badge text-xs ${paymentBadge(s.payment_type)}`}>
                          {paymentLabel(s.payment_type)}
                        </span>
                      </td>
                      <td className="text-gray-500 text-xs">
                        {s.payment_type === "credit"
                          ? s.credit_customer?.name ?? s.vehicle_reg ?? "—"
                          : s.momo_reference ?? s.lpo_number ?? "—"}
                      </td>
                      <td className="text-gray-400 text-xs font-mono">
                        {s.efd_receipt_number ?? "—"}
                      </td>
                      <td className="text-gray-400 text-xs">{s.entered_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}