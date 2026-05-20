"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { SalesTransaction } from "@/types/database";
import { formatUGX, paymentLabel, today } from "@/utils";
import { ShoppingCart, Plus } from "lucide-react";

export default function SalesPage() {
  const { activeStation } = useStation();
  const [sales, setSales] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("sales_transactions")
        .select("*, product:products(name), credit_customer:credit_customers(name)")
        .eq("station_id", activeStation.id).eq("transaction_date", date)
        .order("created_at", { ascending: false });
      if (data) setSales(data);
      setLoading(false);
    };
    load();
  }, [activeStation, date]);

  const total = sales.reduce((sum, s) => sum + (s.net_amount_ugx ?? 0), 0);

  return (
    <>
      <Header title="Sales" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <input type="date" className="form-input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
            {!loading && sales.length > 0 && <span className="text-sm font-semibold text-green-700">Total: {formatUGX(total)}</span>}
          </div>
          <Link href="/sales/new" className="btn-primary"><Plus size={16} /> Add Sale</Link>
        </div>
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : sales.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingCart size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No sales for this date</p>
              <Link href="/sales/new" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Add Sale</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Time</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Amount</th><th>Payment</th><th>Ref / Customer</th><th>EFD #</th></tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-gray-400 text-xs">{s.transaction_time ?? "—"}</td>
                      <td className="font-medium">{(s.product as any)?.name ?? "—"}</td>
                      <td className="text-right">{s.quantity}</td>
                      <td className="text-right">{formatUGX(s.unit_price_ugx)}</td>
                      <td className="text-right font-semibold text-green-700">{formatUGX(s.net_amount_ugx)}</td>
                      <td><span className="badge bg-blue-50 text-blue-700 text-xs">{paymentLabel(s.payment_type)}</span></td>
                      <td className="text-gray-500 text-xs">
                        {s.payment_type === "credit" ? (s.credit_customer as any)?.name ?? s.vehicle_reg ?? "—"
                          : s.momo_reference ?? s.lpo_number ?? "—"}
                      </td>
                      <td className="text-gray-400 text-xs font-mono">{s.efd_receipt_number ?? "—"}</td>
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