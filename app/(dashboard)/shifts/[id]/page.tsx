"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { formatUGX, formatLitres, formatDate, shiftLabel } from "@/utils";
import {
  ArrowLeft, CheckCircle, Clock, Loader2,
  AlertTriangle, TrendingUp, Fuel, DollarSign
} from "lucide-react";

interface ShiftData {
  shift_id: string; station_id: string; station_name: string;
  shift_date: string; shift_type: string; status: string;
  supervisor_name: string | null; cashier_name: string | null; notes: string | null;
  nozzles_with_opening: number; nozzles_with_closing: number;
  total_litres_from_meters: number; total_sales_ugx: number; sales_count: number;
}

interface NozzleReading {
  nozzle_id: string; nozzle_label: string; pump_name: string;
  product_name: string; opening_reading: number | null; closing_reading: number | null;
}

interface ReconcData {
  theoretical_sales_ugx: number; total_cash_ugx: number; total_momo_ugx: number;
  total_credit_ugx: number; total_lpo_ugx: number; total_fuel_card_ugx: number;
  total_expenses_ugx: number; litres_from_meters: number;
  litres_from_sales: number; litres_variance: number;
}

export default function ShiftDetailPage() {
  const router = useRouter();
  const params = useParams();
  const shiftId = params.id as string;

  const [shift, setShift] = useState<ShiftData | null>(null);
  const [nozzles, setNozzles] = useState<NozzleReading[]>([]);
  const [closingMeters, setClosingMeters] = useState<Record<string, string>>({});
  const [reconcData, setReconcData] = useState<ReconcData | null>(null);
  const [cashCollected, setCashCollected] = useState("");
  const [momoCollected, setMomoCollected] = useState("");
  const [bankDeposit, setBankDeposit] = useState("");
  const [bankRef, setBankRef] = useState("");
  const [reconcNotes, setReconcNotes] = useState("");
  const [varianceExplanation, setVarianceExplanation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "close" | "reconcile">("overview");

  const loadShift = async () => {
    const supabase = createClient();
    const { data: shiftData } = await supabase
      .from("vw_shift_detail")
      .select("*")
      .eq("shift_id", shiftId)
      .single();

    if (shiftData) {
      setShift(shiftData);
      if (shiftData.status === "open") setActiveTab("close");
      else if (shiftData.status === "closed") setActiveTab("reconcile");
      else setActiveTab("overview");

      // Load nozzles for this station
      const { data: stationNozzles } = await supabase
        .from("nozzles")
        .select("id, nozzle_label, pump:pumps(pump_name), product:products(name)")
        .eq("station_id", shiftData.station_id)
        .eq("is_active", true)
        .order("nozzle_number");

      // Load meter readings for this shift
      const { data: readings } = await supabase
        .from("meter_readings")
        .select("nozzle_id, reading_type, meter_value")
        .eq("shift_id", shiftId);

      const readingMap: Record<string, { opening?: number; closing?: number }> = {};
      readings?.forEach((r) => {
        if (!readingMap[r.nozzle_id]) readingMap[r.nozzle_id] = {};
        if (r.reading_type === "opening") readingMap[r.nozzle_id].opening = r.meter_value;
        if (r.reading_type === "closing") readingMap[r.nozzle_id].closing = r.meter_value;
      });

      if (stationNozzles) {
        const mapped: NozzleReading[] = stationNozzles.map((n: any) => ({
          nozzle_id: n.id,
          nozzle_label: n.nozzle_label,
          pump_name: n.pump?.pump_name ?? "Pump",
          product_name: n.product?.name ?? "Unknown",
          opening_reading: readingMap[n.id]?.opening ?? null,
          closing_reading: readingMap[n.id]?.closing ?? null,
        }));
        setNozzles(mapped);
      }

      // Load reconciliation data if shift is closed or reconciled
      if (shiftData.status !== "open") {
        const { data: reconc } = await supabase
          .rpc("calculate_shift_reconciliation", { p_shift_id: shiftId });
        if (reconc && reconc.length > 0) setReconcData(reconc[0]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadShift(); }, [shiftId]);

  const handleCloseShift = async () => {
    setSaving(true); setError("");
    const supabase = createClient();

    // Validate closing >= opening
    for (const n of nozzles) {
      const closing = parseFloat(closingMeters[n.nozzle_id] ?? "0");
      if (n.opening_reading !== null && closing > 0 && closing < n.opening_reading) {
        setError(`Closing reading for ${n.nozzle_label} (${closing}) cannot be less than opening (${n.opening_reading}).`);
        setSaving(false); return;
      }
    }

    const readings = nozzles
      .filter((n) => closingMeters[n.nozzle_id] && !isNaN(parseFloat(closingMeters[n.nozzle_id])))
      .map((n) => ({
        shift_id: shiftId,
        station_id: shift!.station_id,
        nozzle_id: n.nozzle_id,
        reading_type: "closing",
        meter_value: parseFloat(closingMeters[n.nozzle_id]),
      }));

    if (readings.length > 0) {
      // Remove existing closing readings first
      await supabase.from("meter_readings")
        .delete().eq("shift_id", shiftId).eq("reading_type", "closing");

      const { error: mErr } = await supabase.from("meter_readings").insert(readings);
      if (mErr) { setError(mErr.message); setSaving(false); return; }
    }

    const { error: sErr } = await supabase
      .from("shifts")
      .update({ status: "closed", closing_entered_at: new Date().toISOString() })
      .eq("id", shiftId);

    if (sErr) { setError(sErr.message); setSaving(false); return; }
    setSaving(false);
    loadShift();
  };

  const handleReconcile = async () => {
    setSaving(true); setError("");
    const supabase = createClient();

    const { error: rErr } = await supabase
      .from("shift_reconciliation")
      .upsert({
        shift_id: shiftId,
        station_id: shift!.station_id,
        cash_collected_ugx: parseFloat(cashCollected || "0"),
        mtn_momo_ugx: parseFloat(momoCollected || "0"),
        airtel_money_ugx: 0,
        fuel_card_ugx: reconcData?.total_fuel_card_ugx ?? 0,
        credit_sales_ugx: reconcData?.total_credit_ugx ?? 0,
        lpo_sales_ugx: reconcData?.total_lpo_ugx ?? 0,
        bank_pos_ugx: 0,
        theoretical_sales_ugx: reconcData?.theoretical_sales_ugx ?? 0,
        total_litres_from_meters: reconcData?.litres_from_meters ?? 0,
        total_litres_from_sales: reconcData?.litres_from_sales ?? 0,
        litres_variance: reconcData?.litres_variance ?? 0,
        amount_banked_ugx: parseFloat(bankDeposit || "0"),
        bank_deposit_reference: bankRef || null,
        variance_explanation: varianceExplanation || null,
        notes: reconcNotes || null,
        status: "approved",
        reconciled_at: new Date().toISOString(),
      }, { onConflict: "shift_id" });

    if (rErr) { setError(rErr.message); setSaving(false); return; }

    await supabase.from("shifts").update({ status: "reconciled" }).eq("id", shiftId);
    setSaving(false);
    loadShift();
  };

  if (loading) return (
    <>
      <Header title="Shift" />
      <div className="p-6 text-center text-gray-400">Loading shift...</div>
    </>
  );

  if (!shift) return (
    <>
      <Header title="Shift Not Found" />
      <div className="p-6 text-center">
        <p className="text-gray-500">Shift not found.</p>
        <Link href="/shifts" className="btn-primary inline-flex mt-4">Back to Shifts</Link>
      </div>
    </>
  );

  const expectedCash = (reconcData?.theoretical_sales_ugx ?? 0)
    - (reconcData?.total_credit_ugx ?? 0)
    - (reconcData?.total_lpo_ugx ?? 0)
    - (reconcData?.total_fuel_card_ugx ?? 0);
  const actualCash = parseFloat(cashCollected || "0") + parseFloat(momoCollected || "0");
  const cashVariance = actualCash - expectedCash;

  return (
    <>
      <Header title={`${shiftLabel(shift.shift_type)} — ${formatDate(shift.shift_date)}`} />
      <div className="p-6 max-w-3xl mx-auto space-y-5">

        <Link href="/shifts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Shifts
        </Link>

        {/* Status Banner */}
        <div className={`card p-4 flex items-center gap-4 border-l-4 ${
          shift.status === "reconciled" ? "border-blue-500 bg-blue-50" :
          shift.status === "closed"     ? "border-amber-500 bg-amber-50" :
                                          "border-green-500 bg-green-50"}`}>
          <div>
            <p className="font-bold text-gray-800">{shift.station_name}</p>
            <p className="text-sm text-gray-500">
              {shiftLabel(shift.shift_type)} · {formatDate(shift.shift_date)} ·
              Supervisor: {shift.supervisor_name ?? "—"} ·
              Cashier: {shift.cashier_name ?? "—"}
            </p>
          </div>
          <span className={`ml-auto badge text-sm font-bold ${
            shift.status === "reconciled" ? "bg-blue-100 text-blue-700" :
            shift.status === "closed"     ? "bg-amber-100 text-amber-700" :
                                            "bg-green-100 text-green-700"}`}>
            {shift.status === "reconciled" ? "✓ Reconciled" :
             shift.status === "closed"     ? "Closed — Needs Reconciliation" :
                                             "● Open"}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[
            { id: "overview",   label: "Overview" },
            { id: "close",      label: shift.status === "open" ? "⚡ Close Shift" : "Meter Readings" },
            { id: "reconcile",  label: shift.status === "reconciled" ? "✓ Reconciliation" : "Reconcile" },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? "border-blue-700 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Litres (Meters)", value: formatLitres(shift.total_litres_from_meters), icon: Fuel,        color: "text-blue-600" },
                { label: "Sales Recorded",  value: formatUGX(shift.total_sales_ugx),             icon: DollarSign,  color: "text-green-600" },
                { label: "Transactions",    value: String(shift.sales_count),                     icon: TrendingUp,  color: "text-purple-600" },
                { label: "Nozzles Closed",  value: `${shift.nozzles_with_closing}/${shift.nozzles_with_opening}`, icon: CheckCircle, color: "text-amber-600" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="stat-card">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                );
              })}
            </div>

            {shift.status === "open" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Shift is currently open</p>
                    <p className="text-sm text-green-600">Enter closing meter readings to close this shift</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab("close")} className="btn-success btn-sm">
                  Close Shift →
                </button>
              </div>
            )}

            {shift.status === "closed" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-800">Shift closed — reconciliation pending</p>
                    <p className="text-sm text-amber-600">Enter cash collected to complete reconciliation</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab("reconcile")}
                  className="btn-sm bg-amber-500 text-white hover:bg-amber-600">
                  Reconcile →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CLOSE SHIFT ── */}
        {activeTab === "close" && (
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">
                {shift.status === "open" ? "Enter Closing Meter Readings" : "Meter Readings"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {shift.status === "open"
                  ? "Record the pump totalizer readings at the END of this shift. Closing minus Opening = litres dispensed."
                  : "Meter readings recorded for this shift."}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pump</th><th>Nozzle</th><th>Product</th>
                    <th className="text-right">Opening</th>
                    <th className="text-right">Closing</th>
                    <th className="text-right">Dispensed</th>
                  </tr>
                </thead>
                <tbody>
                  {nozzles.map((n) => {
                    const closingVal = parseFloat(
                      closingMeters[n.nozzle_id] || String(n.closing_reading ?? "")
                    );
                    const opening = n.opening_reading ?? 0;
                    const dispensed = !isNaN(closingVal) && closingVal >= opening
                      ? closingVal - opening : null;

                    return (
                      <tr key={n.nozzle_id}>
                        <td className="text-gray-500 text-sm">{n.pump_name}</td>
                        <td className="font-semibold text-gray-800">{n.nozzle_label}</td>
                        <td>
                          <span className="badge bg-green-50 text-green-700 text-xs">
                            {n.product_name}
                          </span>
                        </td>
                        <td className="text-right font-mono text-gray-600">
                          {n.opening_reading !== null ? n.opening_reading.toFixed(3) : "—"}
                        </td>
                        <td className="text-right">
                          {shift.status === "open" ? (
                            <input
                              type="number" step="0.001"
                              min={n.opening_reading ?? 0}
                              className="form-input w-40 text-right font-mono"
                              placeholder="0.000"
                              value={closingMeters[n.nozzle_id] ?? ""}
                              onChange={(e) => setClosingMeters((prev) => ({
                                ...prev, [n.nozzle_id]: e.target.value
                              }))}
                            />
                          ) : (
                            <span className="font-mono text-gray-600">
                              {n.closing_reading !== null ? n.closing_reading.toFixed(3) : "—"}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          {dispensed !== null
                            ? <span className="font-bold text-green-700">{formatLitres(dispensed)}</span>
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700 text-sm">
                      Total Litres Dispensed (from meters)
                    </td>
                    <td className="px-4 py-3 text-right font-black text-green-700 text-base">
                      {formatLitres(shift.total_litres_from_meters)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {shift.status === "open" && (
              <div className="flex justify-end">
                <button onClick={handleCloseShift} className="btn-primary px-8" disabled={saving}>
                  {saving
                    ? <><Loader2 size={16} className="animate-spin" /> Closing...</>
                    : "Close Shift & Save Readings"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RECONCILE ── */}
        {activeTab === "reconcile" && (
          <div className="space-y-4">

            {reconcData && (
              <div className="card p-5 space-y-4">
                <h2 className="font-bold text-gray-800 text-lg">Shift Summary</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider">
                      Pump Meters Say
                    </p>
                    <p className="text-2xl font-black text-blue-800 mt-1">
                      {formatLitres(reconcData.litres_from_meters)}
                    </p>
                    <p className="text-sm text-blue-600 font-medium">
                      ≈ {formatUGX(reconcData.theoretical_sales_ugx)}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-500 font-semibold uppercase tracking-wider">
                      Sales Recorded
                    </p>
                    <p className="text-2xl font-black text-green-800 mt-1">
                      {formatLitres(reconcData.litres_from_sales)}
                    </p>
                    <p className="text-sm text-green-600 font-medium">
                      {formatUGX(shift.total_sales_ugx)}
                    </p>
                  </div>
                </div>

                {/* Litre variance */}
                <div className={`rounded-xl p-3 flex items-center gap-3 ${
                  Math.abs(reconcData.litres_variance) < 10
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"}`}>
                  {Math.abs(reconcData.litres_variance) < 10
                    ? <CheckCircle size={18} className="text-green-600" />
                    : <AlertTriangle size={18} className="text-red-600" />}
                  <p className={`text-sm font-medium ${
                    Math.abs(reconcData.litres_variance) < 10 ? "text-green-700" : "text-red-700"}`}>
                    Litre variance: {reconcData.litres_variance > 0 ? "+" : ""}
                    {formatLitres(reconcData.litres_variance)}
                    {Math.abs(reconcData.litres_variance) < 10
                      ? " — within acceptable range"
                      : " — investigate discrepancy"}
                  </p>
                </div>

                {/* Payment breakdown */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm pt-2">
                  {[
                    { label: "Cash sales",    val: reconcData.total_cash_ugx },
                    { label: "MoMo sales",    val: reconcData.total_momo_ugx },
                    { label: "Credit sales",  val: reconcData.total_credit_ugx },
                    { label: "Fuel card",     val: reconcData.total_fuel_card_ugx },
                    { label: "LPO sales",     val: reconcData.total_lpo_ugx },
                    { label: "Expenses today",val: reconcData.total_expenses_ugx },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-semibold text-gray-800">{formatUGX(r.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shift.status !== "reconciled" && (
              <div className="card p-5 space-y-4">
                <h2 className="font-bold text-gray-800">Enter Actual Cash Collected</h2>
                <p className="text-sm text-gray-500">
                  Enter the actual cash and MoMo physically counted at end of shift.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Cash Collected (UGX)</label>
                    <input type="number" step="1000" className="form-input text-lg font-bold"
                      placeholder="0" value={cashCollected}
                      onChange={(e) => setCashCollected(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">
                      Expected: {formatUGX(reconcData?.total_cash_ugx ?? 0)}
                    </p>
                  </div>
                  <div>
                    <label className="form-label">MoMo Collected (UGX)</label>
                    <input type="number" step="1000" className="form-input text-lg font-bold"
                      placeholder="0" value={momoCollected}
                      onChange={(e) => setMomoCollected(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">
                      Expected: {formatUGX(reconcData?.total_momo_ugx ?? 0)}
                    </p>
                  </div>

                  {/* Cash variance live */}
                  {(cashCollected || momoCollected) && (
                    <div className={`sm:col-span-2 rounded-xl p-3 flex items-center gap-3 border ${
                      Math.abs(cashVariance) < 5000
                        ? "bg-green-50 border-green-200"
                        : cashVariance > 0
                        ? "bg-blue-50 border-blue-200"
                        : "bg-red-50 border-red-200"}`}>
                      {Math.abs(cashVariance) < 5000
                        ? <CheckCircle size={18} className="text-green-600" />
                        : <AlertTriangle size={18} className={cashVariance > 0 ? "text-blue-600" : "text-red-600"} />}
                      <p className={`text-sm font-semibold ${
                        Math.abs(cashVariance) < 5000 ? "text-green-700"
                        : cashVariance > 0 ? "text-blue-700" : "text-red-700"}`}>
                        Cash variance: {cashVariance > 0 ? "+" : ""}{formatUGX(cashVariance)}
                        {Math.abs(cashVariance) < 5000 ? " — balanced"
                         : cashVariance > 0 ? " — over (excess cash)"
                         : " — short (missing cash)"}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="form-label">Amount Banked (UGX)</label>
                    <input type="number" step="1000" className="form-input"
                      placeholder="0" value={bankDeposit}
                      onChange={(e) => setBankDeposit(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Bank Deposit Reference</label>
                    <input type="text" className="form-input font-mono"
                      placeholder="Deposit slip number"
                      value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
                  </div>

                  {Math.abs(cashVariance) >= 5000 && (cashCollected || momoCollected) && (
                    <div className="sm:col-span-2">
                      <label className="form-label">Explain Variance *</label>
                      <textarea className="form-input" rows={2}
                        placeholder="Explain why there is a difference in cash..."
                        value={varianceExplanation}
                        onChange={(e) => setVarianceExplanation(e.target.value)} />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={2}
                      placeholder="Any notes about this shift..."
                      value={reconcNotes} onChange={(e) => setReconcNotes(e.target.value)} />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={handleReconcile} className="btn-primary px-8" disabled={saving}>
                    {saving
                      ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                      : "Complete Reconciliation"}
                  </button>
                </div>
              </div>
            )}

            {shift.status === "reconciled" && (
              <div className="card p-6 text-center bg-blue-50 border-2 border-blue-300">
                <CheckCircle size={36} className="mx-auto text-blue-600 mb-3" />
                <h3 className="font-bold text-blue-800 text-lg">Shift Fully Reconciled</h3>
                <p className="text-blue-600 text-sm mt-1">
                  This shift has been closed and reconciled successfully.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}