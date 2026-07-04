"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today } from "@/utils";
import { ArrowLeft, Loader2, Info, Plus, Trash2, AlertTriangle } from "lucide-react";

interface Tank {
  id: string;
  tank_name: string;
  tank_number: number;
  product_name: string;
  product_code: string;
  capacity_litres: number;
  nozzles: Nozzle[];
}

interface Nozzle {
  id: string;
  nozzle_label: string;
  nozzle_number: number;
  pump_name: string;
}

interface MeterEntry {
  nozzle_id: string;
  opening: string;
}

interface Attendant {
  id: string;
  name: string;
  role: "pump_attendant" | "cashier" | "supervisor";
  nozzle_id: string;
}

export default function NewShiftPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [tanks, setTanks]         = useState<Tank[]>([]);
  const [allNozzles, setAllNozzles] = useState<Nozzle[]>([]);
  const [meters, setMeters]       = useState<MeterEntry[]>([]);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const [stationId, setStationId]       = useState(activeStation?.id ?? "");
  const [shiftDate, setShiftDate]       = useState(today());
  const [shiftType, setShiftType]       = useState<"morning" | "afternoon" | "night">("morning");
  const [shiftSequence, setShiftSequence] = useState("1");
  const [supervisorName, setSupervisorName] = useState("");
  const [cashierName, setCashierName]   = useState("");
  const [enteredBy, setEnteredBy]       = useState("");
  const [notes, setNotes]               = useState("");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  // Load ALL tanks with their nozzles when station changes
  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();

      // Load tanks
      const { data: tankData } = await supabase
        .from("tanks")
        .select("id, tank_name, tank_number, capacity_litres, product:products(name, product_code)")
        .eq("station_id", stationId)
        .eq("is_active", true)
        .order("tank_number");

      // Load all nozzles for this station
      const { data: nozzleData } = await supabase
        .from("nozzles")
        .select("id, nozzle_label, nozzle_number, tank_id, pump:pumps(pump_name)")
        .eq("station_id", stationId)
        .eq("is_active", true)
        .order("nozzle_number");

      if (tankData && nozzleData) {
        const nozzleMap: Record<string, Nozzle[]> = {};
        nozzleData.forEach((n: any) => {
          if (!nozzleMap[n.tank_id]) nozzleMap[n.tank_id] = [];
          nozzleMap[n.tank_id].push({
            id: n.id,
            nozzle_label: n.nozzle_label,
            nozzle_number: n.nozzle_number,
            pump_name: n.pump?.pump_name ?? "Unknown Pump",
          });
        });

        const mapped: Tank[] = tankData.map((t: any) => ({
          id: t.id,
          tank_name: t.tank_name,
          tank_number: t.tank_number,
          product_name: t.product?.name ?? "Unknown",
          product_code: t.product?.product_code ?? "",
          capacity_litres: t.capacity_litres ?? 0,
          nozzles: nozzleMap[t.id] ?? [],
        }));

        setTanks(mapped);

        // Flatten all nozzles for meter entries
        const flat: Nozzle[] = [];
        mapped.forEach((t) => t.nozzles.forEach((n) => flat.push(n)));
        setAllNozzles(flat);
        setMeters(flat.map((n) => ({ nozzle_id: n.id, opening: "" })));
      }
    };
    load();
  }, [stationId]);

  const updateMeter = (nozzleId: string, val: string) => {
    setMeters((prev) => prev.map((m) => m.nozzle_id === nozzleId ? { ...m, opening: val } : m));
  };

  // Attendant management
  const addAttendant = () => {
    setAttendants((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: "",
      role: "pump_attendant",
      nozzle_id: "",
    }]);
  };

  const updateAttendant = (id: string, field: keyof Attendant, val: string) => {
    setAttendants((prev) => prev.map((a) => a.id === id ? { ...a, [field]: val } : a));
  };

  const removeAttendant = (id: string) => {
    setAttendants((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationId) { setError("Select a station."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();

    // Create the shift
    const { data: shift, error: shiftErr } = await supabase
      .from("shifts")
      .insert({
        station_id:      stationId,
        shift_date:      shiftDate,
        shift_type:      shiftType,
        shift_sequence:  parseInt(shiftSequence || "1"),
        sub_label:       shiftSequence !== "1" ? `${shiftType} shift ${shiftSequence}` : null,
        supervisor_name: supervisorName || null,
        cashier_name:    cashierName || null,
        entered_by:      enteredBy || null,
        notes:           notes || null,
        status:          "open",
        opening_entered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (shiftErr || !shift) {
      setError(shiftErr?.message ?? "Failed to create shift.");
      setSaving(false);
      return;
    }

    // Save opening meter readings for all nozzles that have a value
    const readings = meters
      .filter((m) => m.opening !== "" && !isNaN(parseFloat(m.opening)))
      .map((m) => ({
        shift_id:     shift.id,
        station_id:   stationId,
        nozzle_id:    m.nozzle_id,
        reading_type: "opening",
        meter_value:  parseFloat(m.opening),
      }));

    if (readings.length > 0) {
      const { error: mErr } = await supabase.from("meter_readings").insert(readings);
      if (mErr) {
        setError("Shift created but meter readings failed: " + mErr.message);
        setSaving(false);
        return;
      }
    }

    // Save attendants
    const attendantRows = attendants
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        shift_id:      shift.id,
        station_id:    stationId,
        nozzle_id:     a.nozzle_id || null,
        attendant_name: a.name.trim(),
        role:          a.role,
      }));

    if (attendantRows.length > 0) {
      await supabase.from("shift_attendants").insert(attendantRows);
    }

    router.push(`/shifts/${shift.id}`);
  };

  const nozzlesWithoutTank = allNozzles.filter(
    (n) => !tanks.some((t) => t.nozzles.some((tn) => tn.id === n.id))
  );

  return (
    <>
      <Header title="Open New Shift" />
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Link href="/shifts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Shifts
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── SHIFT DETAILS ── */}
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

            {/* Shift type */}
            <div>
              <label className="form-label">Shift Period *</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "morning",   label: "Morning",   time: "06:00 – 14:00" },
                  { value: "afternoon", label: "Afternoon", time: "14:00 – 22:00" },
                  { value: "night",     label: "Night",     time: "22:00 – 06:00" },
                ].map((opt) => (
                  <label key={opt.value}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${shiftType === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="radio" className="hidden" value={opt.value}
                      checked={shiftType === opt.value as any}
                      onChange={() => setShiftType(opt.value as any)} />
                    <span className="font-bold text-gray-800 text-sm">{opt.label}</span>
                    <span className="text-xs text-gray-400 mt-0.5">{opt.time}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shift sequence — for stations with multiple shifts per period */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">
                  Shift Number
                  <span className="ml-1 text-gray-400 font-normal text-[11px]">
                    (if more than one {shiftType} shift today)
                  </span>
                </label>
                <select className="form-select" value={shiftSequence}
                  onChange={(e) => setShiftSequence(e.target.value)}>
                  <option value="1">Shift 1</option>
                  <option value="2">Shift 2</option>
                  <option value="3">Shift 3</option>
                  <option value="4">Shift 4</option>
                </select>
              </div>
              <div>
                <label className="form-label">Shift Supervisor</label>
                <input type="text" className="form-input"
                  placeholder="Supervisor on duty"
                  value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Cashier</label>
                <input type="text" className="form-input"
                  placeholder="Cashier on duty"
                  value={cashierName} onChange={(e) => setCashierName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Entered By (Main Branch)</label>
                <input type="text" className="form-input"
                  placeholder="Your name"
                  value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes / Handover</label>
                <input type="text" className="form-input"
                  placeholder="Any handover notes..."
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── PUMP ATTENDANTS ── */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Pump Attendants</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Add each attendant and the nozzle they are assigned to for this shift.
                  Each attendant records their own opening meter reading below.
                </p>
              </div>
              <button type="button" onClick={addAttendant} className="btn-secondary btn-sm">
                <Plus size={14} /> Add Attendant
              </button>
            </div>

            {attendants.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center">
                <p className="text-gray-400 text-sm">No attendants added yet.</p>
                <button type="button" onClick={addAttendant}
                  className="btn-primary btn-sm inline-flex mt-2">
                  <Plus size={13} /> Add First Attendant
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {attendants.map((att) => (
                  <div key={att.id} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-4">
                      {att.id === attendants[0].id && (
                        <label className="form-label">Attendant Name</label>
                      )}
                      <input type="text" className="form-input"
                        placeholder="Full name"
                        value={att.name}
                        onChange={(e) => updateAttendant(att.id, "name", e.target.value)} />
                    </div>
                    <div className="col-span-3">
                      {att.id === attendants[0].id && (
                        <label className="form-label">Role</label>
                      )}
                      <select className="form-select" value={att.role}
                        onChange={(e) => updateAttendant(att.id, "role", e.target.value)}>
                        <option value="pump_attendant">Pump Attendant</option>
                        <option value="cashier">Cashier</option>
                        <option value="supervisor">Supervisor</option>
                      </select>
                    </div>
                    <div className="col-span-4">
                      {att.id === attendants[0].id && (
                        <label className="form-label">Assigned Nozzle</label>
                      )}
                      <select className="form-select" value={att.nozzle_id}
                        onChange={(e) => updateAttendant(att.id, "nozzle_id", e.target.value)}>
                        <option value="">No specific nozzle</option>
                        {tanks.map((t) =>
                          t.nozzles.length > 0 ? (
                            <optgroup key={t.id} label={`${t.tank_name} (${t.product_name})`}>
                              {t.nozzles.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.pump_name} — {n.nozzle_label}
                                </option>
                              ))}
                            </optgroup>
                          ) : null
                        )}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeAttendant(att.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── OPENING METER READINGS ── */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Opening Pump Meter Readings</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Record the totalizer reading on every nozzle at the START of this shift.
                These are the cumulative numbers shown on the pump display.
                Every tank and every nozzle is shown below.
              </p>
            </div>

            {!stationId ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                Select a station above to see its tanks and pumps
              </div>
            ) : tanks.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50">
                <p className="text-amber-700 text-sm font-semibold">
                  No tanks found for this station.
                </p>
                <p className="text-amber-600 text-xs mt-1">
                  Go to System Setup → Tanks & Pumps to add tanks, pumps and nozzles first.
                </p>
                <Link href="/setup" className="btn-primary btn-sm inline-flex mt-3">
                  Go to Setup
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {tanks.map((tank) => (
                  <div key={tank.id}
                    className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Tank header */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-700 font-black text-sm">
                          T{tank.tank_number}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">{tank.tank_name}</p>
                        <p className="text-xs text-gray-500">
                          {tank.product_name}
                          {tank.product_code ? ` (${tank.product_code})` : ""} ·
                          Capacity: {tank.capacity_litres.toLocaleString()} L
                        </p>
                      </div>
                      {tank.nozzles.length === 0 && (
                        <span className="ml-auto badge bg-amber-100 text-amber-700 text-xs">
                          No nozzles configured
                        </span>
                      )}
                    </div>

                    {/* Nozzles for this tank */}
                    {tank.nozzles.length > 0 ? (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Pump</th>
                            <th>Nozzle</th>
                            <th>Product</th>
                            <th>Attendant (this shift)</th>
                            <th>Opening Meter Reading (Litres) *</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tank.nozzles.map((nozzle) => {
                            const assignedAttendant = attendants.find(
                              (a) => a.nozzle_id === nozzle.id
                            );
                            const meterEntry = meters.find(
                              (m) => m.nozzle_id === nozzle.id
                            );
                            return (
                              <tr key={nozzle.id}>
                                <td className="text-gray-500 text-sm">{nozzle.pump_name}</td>
                                <td className="font-semibold text-gray-800">
                                  {nozzle.nozzle_label}
                                </td>
                                <td>
                                  <span className="badge bg-green-50 text-green-700 text-xs">
                                    {tank.product_name}
                                  </span>
                                </td>
                                <td className="text-gray-500 text-xs">
                                  {assignedAttendant
                                    ? <span className="badge bg-blue-50 text-blue-700 text-xs">
                                        {assignedAttendant.name}
                                      </span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    className="form-input w-48"
                                    placeholder="e.g. 125430.250"
                                    value={meterEntry?.opening ?? ""}
                                    onChange={(e) => updateMeter(nozzle.id, e.target.value)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-4 py-3 text-amber-600 text-sm bg-amber-50">
                        ⚠ This tank has no nozzles configured. Go to{" "}
                        <Link href="/setup" className="underline font-semibold">System Setup</Link>
                        {" "}→ Tanks & Pumps to add nozzles to this tank.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2.5 rounded-lg">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <p>
                The opening meter reading is the number you physically see on the pump display
                right now. It is a cumulative total that always increases. You will enter the
                closing reading for each nozzle when this shift ends.
              </p>
            </div>
          </div>

          {/* Tanks without nozzles warning */}
          {stationId && tanks.some((t) => t.nozzles.length === 0) && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-700 font-semibold text-sm">Some tanks have no nozzles</p>
                <p className="text-amber-600 text-xs mt-0.5">
                  Tanks without nozzles cannot have meter readings recorded.
                  Go to System Setup → Tanks & Pumps to add nozzles.
                  {" "}{tanks.filter((t) => t.nozzles.length === 0).map((t) => t.tank_name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
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