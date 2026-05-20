"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { FuelDelivery } from "@/types/database";
import { formatDate, formatLitres, formatUGX, deliveryStatusColor } from "@/utils";
import { Truck, Plus } from "lucide-react";

export default function DeliveriesPage() {
  const { activeStation } = useStation();
  const [deliveries, setDeliveries] = useState<FuelDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeStation) return;
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("fuel_deliveries")
        .select("*, omc:omcs(brand_name,name), product:products(name), tank:tanks(tank_name)")
        .eq("station_id", activeStation.id)
        .order("delivery_date", { ascending: false }).limit(100);
      if (data) setDeliveries(data);
      setLoading(false);
    };
    load();
  }, [activeStation]);

  return (
    <>
      <Header title="Fuel Deliveries" />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Tanker deliveries for {activeStation?.name ?? "selected station"}
          </p>
          <Link href="/deliveries/new" className="btn-primary"><Plus size={16} /> Record Delivery</Link>
        </div>
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : deliveries.length === 0 ? (
            <div className="p-10 text-center">
              <Truck size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No deliveries recorded yet</p>
              <Link href="/deliveries/new" className="btn-primary mt-4 inline-flex"><Plus size={16} /> Record First Delivery</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>OMC</th><th>Product</th><th>Tank</th>
                    <th>Waybill #</th><th className="text-right">Waybill Qty</th>
                    <th className="text-right">Received</th><th className="text-right">Variance</th>
                    <th className="text-right">Total Cost</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => {
                    const variance = d.quantity_variance ?? 0;
                    return (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap">{formatDate(d.delivery_date)}</td>
                        <td className="font-medium">{(d.omc as any)?.brand_name ?? (d.omc as any)?.name ?? "—"}</td>
                        <td>{(d.product as any)?.name ?? "—"}</td>
                        <td className="text-gray-500 text-xs">{(d.tank as any)?.tank_name ?? "—"}</td>
                        <td className="font-mono text-xs text-gray-600">{d.waybill_number ?? "—"}</td>
                        <td className="text-right">{formatLitres(d.quantity_on_waybill)}</td>
                        <td className="text-right font-medium">{formatLitres(d.quantity_received)}</td>
                        <td className={`text-right font-semibold ${variance < 0 ? "text-red-600" : variance > 0 ? "text-green-600" : "text-gray-400"}`}>
                          {d.quantity_received != null ? `${variance >= 0 ? "+" : ""}${variance.toFixed(2)} L` : "—"}
                        </td>
                        <td className="text-right font-medium">{formatUGX(d.total_cost_ugx)}</td>
                        <td><span className={`badge ${deliveryStatusColor(d.status)}`}>{d.status}</span></td>
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