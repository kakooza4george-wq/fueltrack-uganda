"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Omc, Tank } from "@/types/database";
import { today } from "@/utils";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

interface DeliveryForm {
  station_id: string; omc_id: string; tank_id: string; product_id: string;
  delivery_date: string; delivery_time: string; waybill_number: string;
  invoice_number: string; tanker_plate: string; tanker_driver_name: string;
  seal_numbers: string; seals_intact: string; quantity_on_waybill: string;
  pre_dip_cm: string; post_dip_cm: string; unit_cost_ugx: string;
  vat_amount_ugx: string; entered_by: string; notes: string; dispute_notes: string;
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [omcs, setOmcs] = useState<Omc[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, setValue } = useForm<DeliveryForm>({
    defaultValues: { station_id: activeStation?.id ?? "", delivery_date: today(), seals_intact: "true" },
  });

  const stationId = watch("station_id");
  const selectedTankId = watch("tank_id");
  const sealsIntact = watch("seals_intact");
  const preDip = watch("pre_dip_cm");
  const postDip = watch("post_dip_cm");

  useEffect(() => { if (activeStation) setValue("station_id", activeStation.id); }, [activeStation, setValue]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("omcs").select("*").eq("is_active", true).order("brand_name");
      if (data) setOmcs(data);
    };
    load();
  }, []);

  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("tanks")
        .select("*, product:products(name)")
        .eq("station_id", stationId).eq("is_active", true).order("tank_number");
      if (data) setTanks(data);
    };
    load();
  }, [stationId]);

  useEffect(() => {
    if (!selectedTankId) return;
    const tank = tanks.find((t) => t.id === selectedTankId);
    if (tank) setValue("product_id", tank.product_id);
  }, [selectedTankId, tanks, setValue]);

  const dipWarning = preDip && postDip && parseFloat(postDip) <= parseFloat(preDip)
    ? "Warning: Post-delivery dip is less than or equal to pre-delivery dip. Check your readings."
    : "";

  const onSubmit = async (data: DeliveryForm) => {
    setSaving(true); setError("");
    const supabase = createClient();
    let preId: string | null = null;
    let postId: string | null = null;

    if (data.pre_dip_cm) {
      const { data: row, error: err } = await supabase.from("dip_readings")
        .insert({ station_id: data.station_id, tank_id: data.tank_id, reading_type: "pre_delivery", dip_cm: parseFloat(data.pre_dip_cm) })
        .select().single();
      if (err) { setError("Pre-dip failed: " + err.message); setSaving(false); return; }
      preId = row.id;
    }
    if (data.post_dip_cm) {
      const { data: row, error: err } = await supabase.from("dip_readings")
        .insert({ station_id: data.station_id, tank_id: data.tank_id, reading_type: "post_delivery", dip_cm: parseFloat(data.post_dip_cm) })
        .select().single();
      if (err) { setError("Post-dip failed: " + err.message); setSaving(false); return; }
      postId = row.id;
    }

    let quantityReceived: number | null = null;
    if (preId && postId) {
      const [preRow, postRow] = await Promise.all([
        supabase.from("dip_readings").select("volume_litres").eq("id", preId).single(),
        supabase.from("dip_readings").select("volume_litres").eq("id", postId).single(),
      ]);
      if (preRow.data && postRow.data)
        quantityReceived = (postRow.data.volume_litres ?? 0) - (preRow.data.volume_litres ?? 0);
    }

    const intact = data.seals_intact === "true";
    const { error: delErr } = await supabase.from("fuel_deliveries").insert({
      station_id: data.station_id, omc_id: data.omc_id, tank_id: data.tank_id,
      product_id: data.product_id, delivery_date: data.delivery_date,
      delivery_time: data.delivery_time || null, waybill_number: data.waybill_number || null,
      invoice_number: data.invoice_number || null, tanker_plate: data.tanker_plate || null,
      tanker_driver_name: data.tanker_driver_name || null, seal_numbers: data.seal_numbers || null,
      seals_intact: intact, quantity_on_waybill: parseFloat(data.quantity_on_waybill),
      pre_delivery_dip_id: preId, post_delivery_dip_id: postId,
      quantity_received: quantityReceived, unit_cost_ugx: parseFloat(data.unit_cost_ugx),
      vat_amount_ugx: data.vat_amount_ugx ? parseFloat(data.vat_amount_ugx) : null,
      status: intact ? "received" : "disputed",
      dispute_notes: data.dispute_notes || null,
      entered_by: data.entered_by || null, notes: data.notes || null,
    });
    if (delErr) { setError(delErr.message); setSaving(false); return; }
    router.push("/deliveries");
  };

  return (
    <>
      <Header title="Record Fuel Delivery" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </Link>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Delivery Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">OMC Supplier *</label>
                <select className="form-select" {...register("omc_id", { required: true })}>
                  <option value="">Select OMC...</option>
                  {omcs.map((o) => <option key={o.id} value={o.id}>{o.brand_name ?? o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tank *</label>
                <select className="form-select" {...register("tank_id", { required: true })}>
                  <option value="">Select tank...</option>
                  {tanks.map((t) => <option key={t.id} value={t.id}>{t.tank_name} — {(t.product as any)?.name}</option>)}
                </select>
              </div>
              <input type="hidden" {...register("product_id")} />
              <div>
                <label className="form-label">Delivery Date *</label>
                <input type="date" className="form-input" {...register("delivery_date", { required: true })} />
              </div>
              <div>
                <label className="form-label">Time</label>
                <input type="time" className="form-input" {...register("delivery_time")} />
              </div>
              <div>
                <label className="form-label">Waybill Number</label>
                <input type="text" className="form-input" {...register("waybill_number")} />
              </div>
              <div>
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" {...register("invoice_number")} />
              </div>
              <div>
                <label className="form-label">Tanker Plate</label>
                <input type="text" className="form-input" placeholder="e.g. UAA 234B" {...register("tanker_plate")} />
              </div>
              <div>
                <label className="form-label">Driver Name</label>
                <input type="text" className="form-input" {...register("tanker_driver_name")} />
              </div>
              <div>
                <label className="form-label">Seal Numbers</label>
                <input type="text" className="form-input" placeholder="e.g. SL-4421, SL-4422" {...register("seal_numbers")} />
              </div>
              <div>
                <label className="form-label">Seals Intact on Arrival? *</label>
                <select className="form-select" {...register("seals_intact")}>
                  <option value="true">Yes — All seals intact</option>
                  <option value="false">No — Seal(s) broken / tampered</option>
                </select>
              </div>
            </div>
            {sealsIntact === "false" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 mb-2">Broken seals — document carefully</p>
                  <textarea className="form-input" rows={2} placeholder="Describe which seals were broken and any actions taken..."
                    {...register("dispute_notes")} />
                </div>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Quantity Verification (Dip Rod)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Quantity on Waybill (litres) *</label>
                <input type="number" step="0.01" className="form-input" placeholder="e.g. 30000"
                  {...register("quantity_on_waybill", { required: true })} />
              </div>
              <div>
                <label className="form-label">Pre-Delivery Dip (cm)</label>
                <input type="number" step="0.1" className="form-input" placeholder="Tank depth before (cm)"
                  {...register("pre_dip_cm")} />
              </div>
              <div>
                <label className="form-label">Post-Delivery Dip (cm)</label>
                <input type="number" step="0.1" className="form-input" placeholder="Tank depth after (cm)"
                  {...register("post_dip_cm")} />
              </div>
            </div>
            {dipWarning && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                <AlertTriangle size={15} /> {dipWarning}
              </div>
            )}
            <p className="text-xs text-gray-400">The system converts dip readings to litres automatically using the tank calibration chart.</p>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Financials</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Unit Cost (UGX per litre) *</label>
                <input type="number" step="0.0001" className="form-input" placeholder="e.g. 3450.00"
                  {...register("unit_cost_ugx", { required: true })} />
              </div>
              <div>
                <label className="form-label">VAT Amount (UGX) — if applicable</label>
                <input type="number" step="0.01" className="form-input" placeholder="Leave blank if not applicable"
                  {...register("vat_amount_ugx")} />
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Entry Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name" {...register("entered_by")} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} {...register("notes")} />
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3">
            <Link href="/deliveries" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Delivery"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}