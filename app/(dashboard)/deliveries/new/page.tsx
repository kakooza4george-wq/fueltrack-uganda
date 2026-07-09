"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today, formatLitres, formatUGX } from "@/utils";
import {
  ArrowLeft, Loader2, CheckCircle, AlertTriangle,
  Info, Package, ShieldAlert, ShieldCheck
} from "lucide-react";

interface TankOption {
  id: string;
  tank_name: string;
  tank_number: number;
  capacity_litres: number;
  product_id: string;
  product_name: string;
  current_stock: number;
  remaining_capacity: number;
}

export default function NewDeliveryPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [omcs, setOmcs]           = useState<any[]>([]);
  const [tanks, setTanks]         = useState<TankOption[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [capacityWarning, setCapacityWarning] = useState("");
  const [selectedTank, setSelectedTank]       = useState<TankOption | null>(null);

  const [stationId, setStationId]       = useState(activeStation?.id ?? "");
  const [omcId, setOmcId]               = useState("");
  const [tankId, setTankId]             = useState("");
  const [productId, setProductId]       = useState("");
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [deliveryTime, setDeliveryTime] = useState("");
  const [waybillNumber, setWaybillNumber]   = useState("");
  const [invoiceNumber, setInvoiceNumber]   = useState("");
  const [tankerPlate, setTankerPlate]   = useState("");
  const [driverName, setDriverName]     = useState("");
  const [sealNumbers, setSealNumbers]   = useState("");
  const [sealsIntact, setSealsIntact]   = useState(true);
  const [quantityOnWaybill, setQuantityOnWaybill] = useState("");
  const [preDipCm, setPreDipCm]         = useState("");
  const [postDipCm, setPostDipCm]       = useState("");
  const [unitCostUgx, setUnitCostUgx]   = useState("");
  const [vatAmount, setVatAmount]       = useState("");
  const [enteredBy, setEnteredBy]       = useState("");
  const [notes, setNotes]               = useState("");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<"received" | "pending">("received");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("omcs").select("*").eq("is_active", true).order("brand_name");
      if (data) setOmcs(data);
    };
    load();
  }, []);

  // Load tanks with real-time stock and remaining capacity
  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data: tankData } = await supabase
        .from("tanks")
        .select("id, tank_name, tank_number, capacity_litres, product:products(id, name)")
        .eq("station_id", stationId)
        .eq("is_active", true)
        .order("tank_number");

      if (tankData) {
        const enriched: TankOption[] = await Promise.all(
          tankData.map(async (t: any) => {
            const s = createClient();
            const [stockRes, remRes] = await Promise.all([
              s.rpc("get_tank_stock_litres", { p_tank_id: t.id }),
              s.rpc("get_tank_remaining_capacity", { p_tank_id: t.id }),
            ]);
            return {
              id:                 t.id,
              tank_name:          t.tank_name,
              tank_number:        t.tank_number,
              capacity_litres:    t.capacity_litres ?? 0,
              product_id:         t.product?.id ?? "",
              product_name:       t.product?.name ?? "Unknown",
              current_stock:      stockRes.data ?? 0,
              remaining_capacity: remRes.data ?? 0,
            };
          })
        );
        setTanks(enriched);
      }
    };
    load();
  }, [stationId]);

  // When tank selected — update product and check capacity
  useEffect(() => {
    if (!tankId) { setSelectedTank(null); setCapacityWarning(""); return; }
    const t = tanks.find((x) => x.id === tankId);
    if (!t) return;
    setSelectedTank(t);
    setProductId(t.product_id);
  }, [tankId, tanks]);

  // Capacity validation whenever quantity changes
  useEffect(() => {
    if (!selectedTank || !quantityOnWaybill) { setCapacityWarning(""); return; }
    const qty = parseFloat(quantityOnWaybill);
    if (isNaN(qty) || qty <= 0) { setCapacityWarning(""); return; }
    if (qty > selectedTank.remaining_capacity + 0.5) {
      setCapacityWarning(
        `${selectedTank.tank_name} only has space for ${formatLitres(selectedTank.remaining_capacity)} more. ` +
        `This delivery is ${formatLitres(qty)}. ` +
        `The tank would overflow by ${formatLitres(qty - selectedTank.remaining_capacity)}.`
      );
    } else { setCapacityWarning(""); }
  }, [quantityOnWaybill, selectedTank]);

  const totalCost = quantityOnWaybill && unitCostUgx
    ? parseFloat(quantityOnWaybill) * parseFloat(unitCostUgx) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!tankId)  { setError("Select a tank to receive this delivery."); return; }
    if (!omcId)   { setError("Select an OMC supplier."); return; }
    if (!quantityOnWaybill || parseFloat(quantityOnWaybill) <= 0) {
      setError("Enter the quantity on the waybill."); return;
    }
    if (!unitCostUgx || parseFloat(unitCostUgx) <= 0) {
      setError("Enter the unit cost per litre."); return;
    }
    if (capacityWarning && confirmStatus === "received") {
      setError("Cannot confirm this delivery — it would overfill the tank. Change the tank or save as Pending.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const quantityReceived = parseFloat(quantityOnWaybill);
    const status = !sealsIntact ? "disputed" : confirmStatus;

    const { error: delErr } = await supabase.from("fuel_deliveries").insert({
      station_id:           stationId,
      omc_id:               omcId,
      tank_id:              tankId,
      product_id:           productId,
      delivery_date:        deliveryDate,
      delivery_time:        deliveryTime || null,
      waybill_number:       waybillNumber || null,
      invoice_number:       invoiceNumber || null,
      tanker_plate:         tankerPlate || null,
      tanker_driver_name:   driverName || null,
      seal_numbers:         sealNumbers || null,
      seals_intact:         sealsIntact,
      quantity_on_waybill:  quantityReceived,
      quantity_received:    quantityReceived,
      unit_cost_ugx:        parseFloat(unitCostUgx),
      vat_amount_ugx:       vatAmount ? parseFloat(vatAmount) : null,
      status,
      dispute_notes:        disputeNotes || null,
      entered_by:           enteredBy || null,
      notes:                notes || null,
    });

    if (delErr) {
      if (delErr.message.includes("TANK_CAPACITY_EXCEEDED")) {
        const parts = delErr.message.split("|");
        setError(
          `Tank capacity error — ${parts[1] ?? ""}: ${parts[2] ?? ""}, delivery is ${parts[3] ?? ""}.`
        );
      } else {
        setError(delErr.message);
      }
      setSaving(false);
      return;
    }

    router.push("/deliveries");
  };

  return (
    <>
      <Header title="Record Fuel Delivery" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/deliveries"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Deliveries
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── DELIVERY INFO ── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Delivery Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" value={stationId}
                  onChange={(e) => { setStationId(e.target.value); setTankId(""); }}
                  required>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">OMC Supplier *</label>
                <select className="form-select" value={omcId}
                  onChange={(e) => setOmcId(e.target.value)} required>
                  <option value="">Select OMC...</option>
                  {omcs.map((o) => (
                    <option key={o.id} value={o.id}>{o.brand_name ?? o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Delivery Date *</label>
                <input type="date" className="form-input" value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Delivery Time</label>
                <input type="time" className="form-input" value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Waybill Number</label>
                <input type="text" className="form-input"
                  placeholder="From OMC delivery note"
                  value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input"
                  placeholder="OMC tax invoice #"
                  value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Tanker Plate</label>
                <input type="text" className="form-input" placeholder="e.g. UAA 234B"
                  value={tankerPlate} onChange={(e) => setTankerPlate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Driver Name</label>
                <input type="text" className="form-input"
                  value={driverName} onChange={(e) => setDriverName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Seal Numbers</label>
                <input type="text" className="form-input" placeholder="e.g. SL-4421, SL-4422"
                  value={sealNumbers} onChange={(e) => setSealNumbers(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Seals Intact? *</label>
                <select className="form-select"
                  value={sealsIntact ? "yes" : "no"}
                  onChange={(e) => setSealsIntact(e.target.value === "yes")}>
                  <option value="yes">Yes — All seals intact</option>
                  <option value="no">No — Seal(s) broken or tampered</option>
                </select>
              </div>
            </div>

            {!sealsIntact && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">
                      Broken seals — delivery will be saved as Disputed
                    </p>
                    <textarea className="form-input mt-2 text-sm" rows={2}
                      placeholder="Describe which seals were broken and actions taken..."
                      value={disputeNotes} onChange={(e) => setDisputeNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── TANK SELECTION ── */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Receiving Tank *</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Select the underground tank this delivery will go into.
                Only tanks with sufficient capacity are shown.
              </p>
            </div>

            {tanks.length === 0 && stationId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-amber-700 font-semibold text-sm">No tanks configured</p>
                <Link href="/setup" className="btn-primary btn-sm inline-flex mt-2">
                  Go to Setup
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {tanks.map((t) => {
                  const pct   = t.capacity_litres > 0
                    ? Math.min((t.current_stock / t.capacity_litres) * 100, 100) : 0;
                  const isFull  = t.remaining_capacity < 100;
                  const selected = tankId === t.id;

                  return (
                    <label key={t.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${isFull    ? "border-red-200 bg-red-50 opacity-70 cursor-not-allowed"
                        : selected  ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" className="hidden"
                        value={t.id}
                        checked={selected}
                        disabled={isFull}
                        onChange={() => setTankId(t.id)} />
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        selected ? "border-blue-500 bg-blue-500"
                        : isFull  ? "border-red-300"
                        : "border-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-800 text-sm">
                            T{t.tank_number} — {t.tank_name}
                          </p>
                          <span className="badge bg-gray-100 text-gray-600 text-xs">
                            {t.product_name}
                          </span>
                          {isFull && (
                            <span className="badge bg-red-100 text-red-600 text-xs">
                              FULL — no space
                            </span>
                          )}
                        </div>
                        {/* Capacity fill bar */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                pct > 90 ? "bg-red-500"
                                : pct > 70 ? "bg-amber-500"
                                : "bg-green-500"}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {pct.toFixed(0)}% full
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>Current: <strong>{formatLitres(t.current_stock)}</strong></span>
                          <span>Capacity: <strong>{formatLitres(t.capacity_litres)}</strong></span>
                          <span className={`font-bold ${isFull ? "text-red-600" : "text-green-600"}`}>
                            Space: {formatLitres(t.remaining_capacity)}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Capacity warning */}
            {capacityWarning && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl px-4 py-3">
                <ShieldAlert size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-bold text-sm">Tank Would Overflow</p>
                  <p className="text-red-600 text-sm">{capacityWarning}</p>
                  <p className="text-red-500 text-xs mt-1">
                    Split this delivery across multiple tanks or save as Pending.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── QUANTITY ── */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Quantity</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Enter the quantity from the waybill. The system will block confirmation
                if it exceeds the tank's remaining capacity.
              </p>
            </div>
            <div>
              <label className="form-label">Quantity on Waybill (litres) *</label>
              <input type="number" step="0.01" className="form-input text-xl font-bold py-3"
                placeholder="e.g. 5000" value={quantityOnWaybill}
                onChange={(e) => setQuantityOnWaybill(e.target.value)} required />
              {selectedTank && quantityOnWaybill && !capacityWarning && (
                <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
                  <ShieldCheck size={15} />
                  <span className="text-sm">
                    Tank has {formatLitres(selectedTank.remaining_capacity)} of space —
                    this delivery fits.
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2.5 rounded-lg">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              The quantity on the waybill is used as the quantity received.
              If a dip rod reading gives a different figure, record the variance in notes.
            </div>
          </div>

          {/* ── COST ── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Cost</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Unit Cost (UGX per litre) *</label>
                <input type="number" step="0.0001" className="form-input"
                  placeholder="e.g. 3450.00"
                  value={unitCostUgx} onChange={(e) => setUnitCostUgx(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">VAT Amount (UGX)</label>
                <input type="number" step="0.01" className="form-input"
                  placeholder="If applicable"
                  value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} />
              </div>
            </div>
            {totalCost !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-600 font-medium">Estimated Total Cost</span>
                <span className="font-black text-xl text-gray-800">{formatUGX(totalCost)}</span>
              </div>
            )}
          </div>

          {/* ── CONFIRM ── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Confirm Delivery</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer
                ${capacityWarning ? "opacity-50 cursor-not-allowed" : ""}
                ${confirmStatus === "received" && !capacityWarning
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" className="hidden"
                  checked={confirmStatus === "received"}
                  disabled={!!capacityWarning}
                  onChange={() => setConfirmStatus("received")} />
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                  confirmStatus === "received"
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300"}`} />
                <div>
                  <p className="font-bold text-sm text-gray-800">Confirm as Received</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stock increases immediately. Adds to OMC balance owed.
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer
                ${confirmStatus === "pending"
                  ? "border-amber-500 bg-amber-50"
                  : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" className="hidden"
                  checked={confirmStatus === "pending"}
                  onChange={() => setConfirmStatus("pending")} />
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                  confirmStatus === "pending"
                    ? "border-amber-500 bg-amber-500"
                    : "border-gray-300"}`} />
                <div>
                  <p className="font-bold text-sm text-gray-800">Save as Pending</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stock does NOT change until confirmed.
                  </p>
                </div>
              </label>
            </div>

            {confirmStatus === "received" && selectedTank && quantityOnWaybill && !capacityWarning && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                <p className="text-green-700 text-sm">
                  <strong>{selectedTank.tank_name}</strong> stock will increase by{" "}
                  <strong>{formatLitres(parseFloat(quantityOnWaybill))}</strong> to{" "}
                  <strong>
                    {formatLitres(selectedTank.current_stock + parseFloat(quantityOnWaybill))}
                  </strong>
                  &nbsp;({((((selectedTank.current_stock + parseFloat(quantityOnWaybill)) / selectedTank.capacity_litres) * 100)).toFixed(0)}% full)
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name"
                  value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input type="text" className="form-input"
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
              <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <Link href="/deliveries" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary px-8"
              disabled={saving || (!!capacityWarning && confirmStatus === "received")}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : confirmStatus === "received"
                ? "Confirm & Update Stock"
                : "Save as Pending"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}