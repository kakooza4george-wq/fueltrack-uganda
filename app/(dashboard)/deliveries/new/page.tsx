"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today, formatLitres, formatUGX } from "@/utils";
import { ArrowLeft, Loader2, CheckCircle, AlertTriangle, Info, Package } from "lucide-react";

export default function NewDeliveryPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [omcs, setOmcs] = useState<any[]>([]);
  const [tanks, setTanks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stockPreview, setStockPreview] = useState<number | null>(null);

  const [stationId, setStationId]     = useState(activeStation?.id ?? "");
  const [omcId, setOmcId]             = useState("");
  const [tankId, setTankId]           = useState("");
  const [productId, setProductId]     = useState("");
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [deliveryTime, setDeliveryTime] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [tankerPlate, setTankerPlate] = useState("");
  const [driverName, setDriverName]   = useState("");
  const [sealNumbers, setSealNumbers] = useState("");
  const [sealsIntact, setSealsIntact] = useState(true);
  const [quantityOnWaybill, setQuantityOnWaybill] = useState("");
  const [preDipCm, setPreDipCm]       = useState("");
  const [postDipCm, setPostDipCm]     = useState("");
  const [unitCostUgx, setUnitCostUgx] = useState("");
  const [vatAmount, setVatAmount]     = useState("");
  const [enteredBy, setEnteredBy]     = useState("");
  const [notes, setNotes]             = useState("");
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

  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tanks")
        .select("*, product:products(id, name, product_code)")
        .eq("station_id", stationId).eq("is_active", true).order("tank_number");
      if (data) setTanks(data);
    };
    load();
  }, [stationId]);

  useEffect(() => {
    if (!tankId) return;
    const tank = tanks.find((t) => t.id === tankId);
    if (tank?.product) {
      setProductId(tank.product.id);
      const getStock = async () => {
        const supabase = createClient();
        const { data } = await supabase.rpc("get_available_stock", {
          p_station_id: stationId, p_product_id: tank.product.id,
        });
        setStockPreview(data ?? 0);
      };
      getStock();
    }
  }, [tankId, tanks, stationId]);

  const totalCost = quantityOnWaybill && unitCostUgx
    ? parseFloat(quantityOnWaybill) * parseFloat(unitCostUgx) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    const supabase = createClient();

    let preId: string | null = null;
    let postId: string | null = null;

    if (preDipCm) {
      const { data, error: err } = await supabase.from("dip_readings").insert({
        station_id: stationId, tank_id: tankId,
        reading_type: "pre_delivery", dip_cm: parseFloat(preDipCm),
      }).select().single();
      if (err) { setError("Pre-dip failed: " + err.message); setSaving(false); return; }
      preId = data.id;
    }

    if (postDipCm) {
      const { data, error: err } = await supabase.from("dip_readings").insert({
        station_id: stationId, tank_id: tankId,
        reading_type: "post_delivery", dip_cm: parseFloat(postDipCm),
      }).select().single();
      if (err) { setError("Post-dip failed: " + err.message); setSaving(false); return; }
      postId = data.id;
    }

    const quantityReceived = quantityOnWaybill ? parseFloat(quantityOnWaybill) : null;
    const status = sealsIntact ? confirmStatus : "disputed";

    const { error: delErr } = await supabase.from("fuel_deliveries").insert({
      station_id: stationId, omc_id: omcId, tank_id: tankId, product_id: productId,
      delivery_date: deliveryDate, delivery_time: deliveryTime || null,
      waybill_number: waybillNumber || null, invoice_number: invoiceNumber || null,
      tanker_plate: tankerPlate || null, tanker_driver_name: driverName || null,
      seal_numbers: sealNumbers || null, seals_intact: sealsIntact,
      quantity_on_waybill: parseFloat(quantityOnWaybill),
      pre_delivery_dip_id: preId, post_delivery_dip_id: postId,
      quantity_received: quantityReceived,
      unit_cost_ugx: parseFloat(unitCostUgx),
      vat_amount_ugx: vatAmount ? parseFloat(vatAmount) : null,
      status,
      dispute_notes: disputeNotes || null,
      entered_by: enteredBy || null, notes: notes || null,
    });

    if (delErr) { setError(delErr.message); setSaving(false); return; }
    router.push("/deliveries");
  };

  return (
    <>
      <Header title="Record Fuel Delivery" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/deliveries" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Deliveries
        </Link>

        {stockPreview !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Package size={18} className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-blue-700 text-sm font-medium">
                Current stock for {tanks.find((t) => t.id === tankId)?.product?.name}:
                <span className="font-black ml-2">{formatLitres(stockPreview)}</span>
              </p>
              <p className="text-blue-500 text-xs mt-0.5">
                After confirming this delivery, stock will automatically increase
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Delivery Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" value={stationId}
                  onChange={(e) => setStationId(e.target.value)} required>
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
                <label className="form-label">Tank (Receiving) *</label>
                <select className="form-select" value={tankId}
                  onChange={(e) => setTankId(e.target.value)} required>
                  <option value="">Select tank...</option>
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tank_name} — {t.product?.name} (Cap: {t.capacity_litres?.toLocaleString()}L)
                    </option>
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
                <input type="text" className="form-input" placeholder="From OMC delivery note"
                  value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Invoice Number</label>
                <input type="text" className="form-input" placeholder="OMC tax invoice #"
                  value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Tanker Plate Number</label>
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
                <label className="form-label">Seals Intact on Arrival? *</label>
                <select className="form-select" value={sealsIntact ? "yes" : "no"}
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
                    <p className="text-sm font-semibold text-red-700">Broken seals — document carefully</p>
                    <textarea className="form-input mt-2 text-sm" rows={2}
                      placeholder="Describe which seals were broken and actions taken..."
                      value={disputeNotes} onChange={(e) => setDisputeNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Quantity Verification</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Use dip rod readings before and after delivery to verify actual quantity received
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Quantity on Waybill (litres) *</label>
                <input type="number" step="0.01" className="form-input font-bold text-lg"
                  placeholder="e.g. 30000" value={quantityOnWaybill}
                  onChange={(e) => setQuantityOnWaybill(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Pre-Delivery Dip (cm)</label>
                <input type="number" step="0.1" className="form-input"
                  placeholder="Tank depth before"
                  value={preDipCm} onChange={(e) => setPreDipCm(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Post-Delivery Dip (cm)</label>
                <input type="number" step="0.1" className="form-input"
                  placeholder="Tank depth after"
                  value={postDipCm} onChange={(e) => setPostDipCm(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              If no dip readings are entered, the waybill quantity is used as quantity received.
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Cost</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Unit Cost (UGX per litre) *</label>
                <input type="number" step="0.0001" className="form-input"
                  placeholder="e.g. 3450.00" value={unitCostUgx}
                  onChange={(e) => setUnitCostUgx(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">VAT Amount (UGX)</label>
                <input type="number" step="0.01" className="form-input"
                  placeholder="If applicable"
                  value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} />
              </div>
            </div>
            {totalCost !== null && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">Estimated Total Cost</span>
                <span className="font-black text-xl text-gray-800">{formatUGX(totalCost)}</span>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Confirm Delivery</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${confirmStatus === "received" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" className="hidden" checked={confirmStatus === "received"}
                  onChange={() => setConfirmStatus("received")} />
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0
                  ${confirmStatus === "received" ? "border-green-500 bg-green-500" : "border-gray-300"}`} />
                <div>
                  <p className="font-bold text-sm text-gray-800">Confirm as Received</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stock will automatically increase when saved
                  </p>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${confirmStatus === "pending" ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" className="hidden" checked={confirmStatus === "pending"}
                  onChange={() => setConfirmStatus("pending")} />
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0
                  ${confirmStatus === "pending" ? "border-amber-500 bg-amber-500" : "border-gray-300"}`} />
                <div>
                  <p className="font-bold text-sm text-gray-800">Save as Pending</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Stock will NOT update until confirmed
                  </p>
                </div>
              </label>
            </div>

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

          {confirmStatus === "received" && quantityOnWaybill && (
            <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-sm font-medium">
                When saved, stock for {tanks.find((t) => t.id === tankId)?.product?.name ?? "this product"} will
                automatically increase by {formatLitres(parseFloat(quantityOnWaybill))}.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <Link href="/deliveries" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary px-8" disabled={saving}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : confirmStatus === "received" ? "Save & Update Stock" : "Save as Pending"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}