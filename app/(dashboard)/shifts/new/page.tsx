"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today } from "@/utils";
import { ArrowLeft, Loader2, Info } from "lucide-react";

interface Nozzle {
  id: string;
  nozzle_label: string;
  nozzle_number: number;
  pump_name: string;
  product_name: string;
  product_code: string;
}

interface MeterEntry {
  nozzle_id: string;
  opening: string;
}

export default function NewShiftPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);
  const [meters, setMeters] = useState<MeterEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [stationId, setStationId] = useState(activeStation?.id ?? "");
  const [shiftDate, setShiftDate] = useState(today());
  const [shiftType, setShiftType] = useState<"morning" | "afternoon" | "night">("morning");
  const [supervisorName, setSupervisorName] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (activeStation) setStationId(activeStation.id);
  }, [activeStation]);

  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("nozzles")
        .select(`
          id, nozzle_label, nozzle_number,
          pump:pumps(pump_name),
          product:products(name, product_code)
        `)
        .eq("station_id", stationId)
        .eq("is_active", true)
        .order("nozzle_number");

      if (data) {
        const mapped: Nozzle[] = data.map((n: any) => ({
          id: n.id,
          nozzle_label: n.nozzle_label,
          nozzle_number: n.nozzle_number,
          pump_name: n.pump?.pump_name ?? "Pump",
          product_name: n.product?.name ?? "Unknown",
          product_code: n.product?.product_code ?? "",
        }));
        setNozzles(mapped);
        setMeters(mapped.map((n) => ({ nozzle_id: n.id, opening: "" })));
      }
    };
    load();
  }, [stationId]);

  const updateMeter = (idx: number, val: string) => {
    setMeters((prev) => prev.map((e, i) => i === idx ? { ...e, opening: val } : e));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationId) { setError("Select a station."); return; }

    setSaving(true);
    setError("");
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("shifts")
      .select("id")
      .eq("station_id", stationId)
      .eq("shift_date", shiftDate)
      .eq("shift_type", shiftType)
      .single();

    if (existing) {
      setError(`A ${shiftType} shift already exists for this station on ${shiftDate}.`);
      setSaving(false);
      return;
    }

    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .insert({
        station_id: stationId,
        shift_date: shiftDate,
        shift_type: shiftType,
        supervisor_name: supervisorName || null,
        cashier_name: cashierName || null,
        entered_by: enteredBy || null,
        notes: notes || null,
        status: "open",
        opening_entered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (shiftErr || !shift) {
      setError(shiftErr?.message ?? "Failed to create shift.");
      setSaving(false);
      return;
    }

    const readings = meters
      .filter((m) => m.opening !== "" && !isNaN(parseFloat(m.opening)))
      .map((m) => ({
        shift_id: shift.id,
        station_id: stationId,
        nozzle_id: m.nozzle_id,
        reading_type: "opening",
        meter_value: parseFloat(m.opening),
      }));

    if (readings.length > 0) {
      const { error: mErr } = await supabase.from("meter_readings").insert(readings);
      if (mErr) {
        setError("Shift created but meter readings failed: " + mErr.message);
        setSaving(false);
        return;
      }
    }

    router.push(`/shifts/${shift.id}`);
  };

  return (
    <>
      <Header title="Open New Shift" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/shifts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Shifts
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Shift Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" value={stationId}
                  onChange={(e) => setStationId(e.target.value)} required>
                  <option value="">Select station...</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.is_main_branch ? " (Main)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="form-label">Shift *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "morning",   label: "Morning",   time: "06:00 – 14:00" },
                  { value: "afternoon", label: "Afternoon", time: "14:00 – 22:00" },
                  { value: "night",     label: "Night",     time: "22:00 – 06:00" },
                ].map((opt) => (
                  <label key={opt.value}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${shiftType === opt.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" className="hidden" value={opt.value}
                      checked={shiftType === opt.value as any}
                      onChange={() => setShiftType(opt.value as any)} />
                    <span className="font-bold text-gray-800 text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-400 mt-0.5">{opt.time}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Shift Supervisor</label>
                <input type="text" className="form-input"
                  placeholder="Name of supervisor on duty"
                  value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Cashier</label>
                <input type="text" className="form-input"
                  placeholder="Name of cashier on duty"
                  value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Entered By (at Main Branch)</label>
                <input type="text" className="form-input"
                  placeholder="Your name"
                  value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2}
                placeholder="Any incidents, handover notes..."
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Opening Pump Meter Readings</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Record the totalizer reading on each pump nozzle at the START of this shift.
                  These are the cumulative numbers shown on the pump display.
                </p>
              </div>
            </div>

            {!stationId ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                Select a station above to see its pumps
              </div>
            ) : nozzles.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50">
                <p className="text-amber-700 text-sm font-medium">No pumps found for this station.</p>
                <p className="text-amber-600 text-xs mt-1">
                  Add pumps and nozzles in System Setup first.
                </p>
                <Link href="/setup" className="btn-primary btn-sm inline-flex mt-3">
                  Go to Setup
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pump</th>
                      <th>Nozzle</th>
                      <th>Product</th>
                      <th>Opening Meter Reading (Litres)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nozzles.map((nozzle, idx) => (
                      <tr key={nozzle.id}>
                        <td className="text-gray-500 text-sm">{nozzle.pump_name}</td>
                        <td className="font-semibold text-gray-800">{nozzle.nozzle_label}</td>
                        <td>
                          <span className="badge bg-green-50 text-green-700 text-xs">
                            {nozzle.product_name}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            className="form-input w-44"
                            placeholder="e.g. 125430.250"
                            value={meters[idx]?.opening ?? ""}
                            onChange={(e) => updateMeter(idx, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <p>The opening meter reading is the number you physically see on the pump display right now. It is a cumulative total — always increasing. You will enter the closing reading when the shift ends.</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/shifts" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary px-8" disabled={saving}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Opening Shift...</>
                : "Open Shift"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}