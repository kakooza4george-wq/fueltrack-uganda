"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatDate, formatLitres, formatUGX } from "@/utils";
import { Truck, Plus } from "lucide-react";

export default function DeliveriesPage() {
  const { activeStation } = useStation();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("fuel_deliveries")
        .select(`
          id, delivery_date, status, waybill_number, invoice_number,
          quantity_on_waybill, quantity_received, quantity_variance,
          total_cost_ugx, seals_intact, entered_by,
          omc:omcs(brand_name, name),
          product:products(name, product_code),
          tank:tanks(tank_name)
        `)
        .eq("station_id", activeStation.id)
        .order("delivery_date", { ascending: false })
        .limit(100);
      if (data) setDeliveries(data);
      setLoading(false);
    };
    load();
  }, [activeStation]);

  const statusStyle = (s: string) => ({
    pending:  "bg-yellow-100 text-yellow-700",
    received: "bg-green-100 text-green-700",
    disputed: "bg-red-100 text-red-700",
    resolved: "bg-blue-100 text-blue-700",
  }[s] ?? "bg-gray-100 text-gray-600");

  return (
    <>
      <Header title="Fuel Deliveries" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-gray-500">
              Tanker deliveries for <span className="font-semibold text-gray-700">{activeStation?.name}</span>
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              ✓ Confirmed deliveries automatically increase stock levels
            </p>
          </div>
          <Link href="/deliveries/new" className="btn-primary">
            <Plus size={16} /> Record Delivery
          </Link>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-12 text-center">
              <Truck size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No deliveries recorded yet</p>
              <p className="text-gray-400 text-sm mt-1">Record a tanker delivery to start tracking stock</p>
              <Link href="/deliveries/new" className="btn-primary inline-flex mt-4">
                <Plus size={16} /> Record First Delivery
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>OMC</th><th>Product</th><th>Tank</th>
                    <th>Waybill #</th>
                    <th className="text-right">Waybill Qty</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Variance</th>
                    <th className="text-right">Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => {
                    const variance = d.quantity_variance ?? 0;
                    return (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap font-medium">{formatDate(d.delivery_date)}</td>
                        <td className="font-semibold text-gray-800">
                          {d.omc?.brand_name ?? d.omc?.name ?? "—"}
                        </td>
                        <td>{d.product?.name ?? "—"}</td>
                        <td className="text-gray-500 text-xs">{d.tank?.tank_name ?? "—"}</td>
                        <td className="font-mono text-xs text-gray-600">{d.waybill_number ?? "—"}</td>
                        <td className="text-right">{formatLitres(d.quantity_on_waybill)}</td>
                        <td className="text-right font-semibold">
                          {d.quantity_received ? formatLitres(d.quantity_received) : "—"}
                        </td>
                        <td className={`text-right font-semibold text-xs ${
                          variance < -10 ? "text-red-600" :
                          variance > 10  ? "text-green-600" : "text-gray-400"}`}>
                          {d.quantity_received != null
                            ? `${variance >= 0 ? "+" : ""}${variance.toFixed(2)} L` : "—"}
                        </td>
                        <td className="text-right font-medium">{formatUGX(d.total_cost_ugx)}</td>
                        <td>
                          <span className={`badge text-xs ${statusStyle(d.status)}`}>
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}