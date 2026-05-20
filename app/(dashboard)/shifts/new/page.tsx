"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Nozzle } from "@/types/database";
import { today } from "@/utils";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface ShiftForm {
  station_id: string; shift_date: string;
  shift_type: "morning" | "afternoon" | "night";
  supervisor_name: string; cashier_name: string;
  entered_by: string; notes: string;
}
interface MeterEntry { nozzle_id: string; opening: string; closing: string; }

export default function NewShiftPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [meters, setMeters] = useState<MeterEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, setValue } = useForm<ShiftForm>({
    defaultValues: { station_id: activeStation?.id ?? "", shift_date: today(), shift_type: "morning" },
  });

  const stationId = watch("station_id");

  useEffect(() => {
    if (activeStation) setValue("station_id", activeStation.id);
  }, [activeStation, setValue]);

  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("nozzles")
        .select("*, pump:pumps(pump_name), product:products(name)")
        .eq("station_id", stationId).eq("is_active", true).order("nozzle_number");
      if (data) { setNozzles(data); setMeters(data.map((n) => ({ nozzle_id: n.id, opening: "", closing: "" }))); }
    };
    load();
  }, [stationId]);

  const updateMeter = (idx: number, field: "opening" | "closing", val: string) =>
    setMeters((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));

  const onSubmit = async (data: ShiftForm) => {
    setSaving(true); setError("");
    const supabase = createClient();
    const { data: shift, error: err } = await supabase.from("shifts").insert({
      station_id: data.station_id, shift_date: data.shift_date, shift_type: data.shift_type,
      supervisor_name: data.supervisor_name || null, cashier_name: data.cashier_name || null,
      entered_by: data.entered_by || null, notes: data.notes || null, status: "closed",
    }).select().single();
    if (err || !shift) { setError(err?.message ?? "Failed to save"); setSaving(false); return; }

    const readings = meters.filter((e) => e.opening || e.closing).flatMap((e) => {
      const rows = [];
      if (e.opening) rows.push({ shift_id: shift.id, station_id: data.station_id, nozzle_id: e.nozzle_id, reading_type: "opening", meter_value: parseFloat(e.opening) });
      if (e.closing) rows.push({ shift_id: shift.id, station_id: data.station_id, nozzle_id: e.nozzle_id, reading_type: "closing", meter_value: parseFloat(e.closing) });
      return rows;
    });
    if (readings.length > 0) await supabase.from("meter_readings").insert(readings);
    router.push("/shifts");
  };

  return (
    <>
      <Header title="New Shift Entry" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/shifts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </Link>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Shift Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_main_branch ? " (Main)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" {...register("shift_date", { required: true })} />
              </div>
              <div>
                <label className="form-label">Shift *</label>
                <select className="form-select" {...register("shift_type")}>
                  <option value="morning">Morning (06:00–14:00)</option>
                  <option value="afternoon">Afternoon (14:00–22:00)</option>
                  <option value="night">Night (22:00–06:00)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Supervisor Name</label>
                <input type="text" className="form-input" {...register("supervisor_name")} />
              </div>
              <div>
                <label className="form-label">Cashier Name</label>
                <input type="text" className="form-input" {...register("cashier_name")} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name" {...register("entered_by")} />
              </div>
            </div>
            <div>
              <label className="form-label">Notes / Incidents</label>
              <textarea className="form-input" rows={2} {...register("notes")} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Pump Meter Readings</h2>
            {nozzles.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                {stationId ? "No nozzles found. Add pumps in Settings first." : "Select a station to see its pumps."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Pump</th><th>Nozzle</th><th>Product</th><th>Opening (L)</th><th>Closing (L)</th><th className="text-right">Dispensed</th></tr>
                  </thead>
                  <tbody>
                    {nozzles.map((n, idx) => {
                      const e = meters[idx];
                      const open = parseFloat(e?.opening || "0");
                      const close = parseFloat(e?.closing || "0");
                      const dispensed = !isNaN(open) && !isNaN(close) && close >= open && e?.closing ? (close - open).toFixed(2) : "—";
                      return (
                        <tr key={n.id}>
                          <td className="text-xs text-gray-500">{(n.pump as any)?.pump_name ?? "—"}</td>
                          <td className="font-medium">{n.nozzle_label}</td>
                          <td><span className="badge bg-green-50 text-green-700 text-xs">{(n.product as any)?.name ?? "—"}</span></td>
                          <td><input type="number" step="0.001" className="form-input w-32" placeholder="0.000" value={e?.opening ?? ""} onChange={(ev) => updateMeter(idx, "opening", ev.target.value)} /></td>
                          <td><input type="number" step="0.001" className="form-input w-32" placeholder="0.000" value={e?.closing ?? ""} onChange={(ev) => updateMeter(idx, "closing", ev.target.value)} /></td>
                          <td className={`text-right font-semibold ${dispensed !== "—" ? "text-green-700" : "text-gray-300"}`}>{dispensed !== "—" ? `${dispensed} L` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3">
            <Link href="/shifts" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Shift"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}