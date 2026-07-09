"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatLitres, today } from "@/utils";
import {
  ArrowLeft, Loader2, AlertTriangle, CheckCircle,
  Calculator, Fuel, Info, ShieldAlert
} from "lucide-react";

interface NozzleOption {
  id: string;
  nozzle_label: string;
  pump_name: string;
  tank_id: string;
  tank_name: string;
  tank_number: number;
  product_id: string;
  product_name: string;
  current_tank_stock: number;
  remaining_capacity: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [nozzles, setNozzles]       = useState<NozzleOption[]>([]);
  const [products, setProducts]     = useState<any[]>([]);
  const [shifts, setShifts]         = useState<any[]>([]);
  const [customers, setCustomers]   = useState<any[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [stockWarning, setStockWarning] = useState("");
  const [calculatedLitres, setCalculatedLitres] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  // Form state
  const [stationId, setStationId]         = useState(activeStation?.id ?? "");
  const [shiftId, setShiftId]             = useState("");
  const [nozzleId, setNozzleId]           = useState("");
  const [productId, setProductId]         = useState("");
  const [selectedNozzle, setSelectedNozzle] = useState<NozzleOption | null>(null);
  const [transactionDate, setDate]        = useState(today());
  const [transactionTime, setTime]        = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [entryMode, setEntryMode]         = useState<"by_amount" | "by_litres">("by_amount");
  const [amountUGX, setAmountUGX]         = useState("");
  const [quantityLitres, setQtyLitres]    = useState("");
  const [unitPrice, setUnitPrice]         = useState("");
  const [priceSet, setPriceSet]           = useState(false);
  const [paymentType, setPaymentType]     = useState("cash");
  const [momoRef, setMomoRef]             = useState("");
  const [fuelCardNum, setFuelCardNum]     = useState("");
  const [lpoNumber, setLpoNumber]         = useState("");
  const [creditCustomerId, setCreditId]   = useState("");
  const [vehicleReg, setVehicleReg]       = useState("");
  const [driverName, setDriverName]       = useState("");
  const [efdNumber, setEfdNumber]         = useState("");
  const [enteredBy, setEnteredBy]         = useState("");
  const [notes, setNotes]                 = useState("");

  useEffect(() => {
    if (activeStation) setStationId(activeStation.id);
  }, [activeStation]);

  // Load nozzles with real-time tank stock
  useEffect(() => {
    if (!stationId) { setNozzles([]); return; }
    const load = async () => {
      const supabase = createClient();
      const { data: nozzleData } = await supabase
        .from("nozzles")
        .select(`
          id, nozzle_label, nozzle_number,
          pump:pumps(pump_name),
          tank:tanks(id, tank_name, tank_number, capacity_litres, product_id),
          product:products(id, name)
        `)
        .eq("station_id", stationId)
        .eq("is_active", true)
        .order("nozzle_number");

      if (nozzleData) {
        const enriched: NozzleOption[] = await Promise.all(
          nozzleData.map(async (n: any) => {
            const supabase2 = createClient();
            const { data: stockData } = await supabase2
              .rpc("get_tank_stock_litres", { p_tank_id: n.tank?.id });
            const { data: remData } = await supabase2
              .rpc("get_tank_remaining_capacity", { p_tank_id: n.tank?.id });
            return {
              id:                   n.id,
              nozzle_label:         n.nozzle_label,
              pump_name:            n.pump?.pump_name ?? "Pump",
              tank_id:              n.tank?.id ?? "",
              tank_name:            n.tank?.tank_name ?? "Unknown Tank",
              tank_number:          n.tank?.tank_number ?? 0,
              product_id:           n.tank?.product_id ?? n.product?.id ?? "",
              product_name:         n.product?.name ?? "Unknown",
              current_tank_stock:   stockData ?? 0,
              remaining_capacity:   remData ?? 0,
            };
          })
        );
        setNozzles(enriched);
      }
    };
    load();
  }, [stationId]);

  // Load shifts (open only)
  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("shifts")
        .select("id, shift_type, shift_date, shift_sequence, supervisor_name")
        .eq("station_id", stationId)
        .eq("status", "open")
        .order("shift_date", { ascending: false })
        .order("shift_type")
        .limit(20);
      if (data) setShifts(data);
    };
    load();
  }, [stationId]);

  // Load misc
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [pRes, cRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("credit_customers").select("*").eq("is_active", true).order("name"),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) setCustomers(cRes.data);
    };
    load();
  }, []);

  // When nozzle changes — set product and load price
  useEffect(() => {
    if (!nozzleId) {
      setSelectedNozzle(null);
      setProductId("");
      setUnitPrice("");
      setPriceSet(false);
      return;
    }
    const n = nozzles.find((x) => x.id === nozzleId);
    if (!n) return;
    setSelectedNozzle(n);
    setProductId(n.product_id);

    const loadPrice = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_prices")
        .select("pump_price_ugx")
        .eq("product_id", n.product_id)
        .eq("station_id", stationId)
        .lte("effective_date", today())
        .order("effective_date", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setUnitPrice(data.pump_price_ugx.toString());
        setPriceSet(true);
      } else {
        setUnitPrice("");
        setPriceSet(false);
      }
    };
    loadPrice();
  }, [nozzleId, nozzles, stationId]);

  // Calculate litres/amount in real time
  useEffect(() => {
    const price = parseFloat(unitPrice || "0");
    if (price <= 0) { setCalculatedLitres(null); setCalculatedAmount(null); setStockWarning(""); return; }

    const stock = selectedNozzle?.current_tank_stock ?? 0;

    if (entryMode === "by_amount") {
      const amt = parseFloat(amountUGX || "0");
      if (amt > 0) {
        const litres = amt / price;
        setCalculatedLitres(litres);
        setCalculatedAmount(null);
        if (selectedNozzle && litres > stock + 0.5) {
          setStockWarning(
            `Not enough stock in ${selectedNozzle.tank_name}. ` +
            `Available: ${formatLitres(stock)}. ` +
            `This sale needs: ${formatLitres(litres)}.`
          );
        } else { setStockWarning(""); }
      } else { setCalculatedLitres(null); setStockWarning(""); }
    } else {
      const litres = parseFloat(quantityLitres || "0");
      if (litres > 0) {
        setCalculatedAmount(litres * price);
        setCalculatedLitres(null);
        if (selectedNozzle && litres > stock + 0.5) {
          setStockWarning(
            `Not enough stock in ${selectedNozzle.tank_name}. ` +
            `Available: ${formatLitres(stock)}. ` +
            `Requested: ${formatLitres(litres)}.`
          );
        } else { setStockWarning(""); }
      } else { setCalculatedAmount(null); setStockWarning(""); }
    }
  }, [amountUGX, quantityLitres, unitPrice, entryMode, selectedNozzle]);

  const isFuel = products.find((p) => p.id === productId)?.is_fuel ?? false;
  const tankEmpty = selectedNozzle ? selectedNozzle.current_tank_stock <= 0 : false;
  const noShifts  = shifts.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!shiftId)   { setError("Select an open shift before saving a sale."); return; }
    if (!nozzleId && isFuel) { setError("Select a nozzle to identify which tank the fuel comes from."); return; }
    if (stockWarning) { setError("Cannot save: " + stockWarning); return; }
    if (tankEmpty && isFuel) { setError("Tank is empty. Record a delivery before making more sales."); return; }

    const price = parseFloat(unitPrice || "0");
    if (price <= 0) { setError("Enter a price per litre."); return; }

    let finalLitres: number;
    let finalAmount: number;
    let discountUGX = 0;

    if (entryMode === "by_amount") {
      finalAmount  = parseFloat(amountUGX || "0");
      finalLitres  = Math.round((finalAmount / price) * 1000) / 1000;
      const theoretical = Math.round(finalLitres * price * 100) / 100;
      discountUGX  = Math.round((theoretical - finalAmount) * 100) / 100;
    } else {
      finalLitres  = parseFloat(quantityLitres || "0");
      finalAmount  = Math.round(finalLitres * price * 100) / 100;
    }

    if (finalLitres <= 0) { setError("Enter a valid amount or quantity."); return; }

    setSaving(true);
    const supabase = createClient();

    const { error: err } = await supabase.from("sales_transactions").insert({
      station_id:         stationId,
      shift_id:           shiftId,
      nozzle_id:          nozzleId || null,
      product_id:         productId,
      transaction_date:   transactionDate,
      transaction_time:   transactionTime || null,
      quantity:           finalLitres,
      unit_price_ugx:     price,
      discount_ugx:       discountUGX,
      amount_entered_ugx: finalAmount,
      payment_type:       paymentType,
      momo_reference:     momoRef || null,
      fuel_card_number:   fuelCardNum || null,
      lpo_number:         lpoNumber || null,
      credit_customer_id: creditCustomerId || null,
      vehicle_reg:        vehicleReg || null,
      driver_name:        driverName || null,
      efd_receipt_number: efdNumber || null,
      entered_by:         enteredBy || null,
      notes:              notes || null,
    });

    if (err) {
      if (err.message.includes("INSUFFICIENT_STOCK")) {
        const parts = err.message.split("|");
        setError(`Stock Error — ${parts[1] ?? ""}: ${parts[2] ?? ""}, ${parts[3] ?? ""}`);
      } else if (err.message.includes("TANK_OVER_CAPACITY")) {
        const parts = err.message.split("|");
        setError(`Capacity Error — ${parts[1] ?? ""}: ${parts[2] ?? ""}`);
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }

    if (paymentType === "credit" && creditCustomerId) {
      await supabase.from("credit_account_transactions").insert({
        credit_customer_id: creditCustomerId,
        station_id:         stationId,
        transaction_date:   transactionDate,
        entry_type:         "charge",
        amount_ugx:         finalAmount,
        entered_by:         enteredBy || null,
        notes:              `Fuel sale — ${vehicleReg ?? ""}`,
      });
    }

    router.push("/sales");
  };

  return (
    <>
      <Header title="Record Sale" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/sales"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Sales
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── STATION & SHIFT ── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Station & Shift</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" value={stationId}
                  onChange={(e) => { setStationId(e.target.value); setNozzleId(""); setShiftId(""); }}
                  required>
                  <option value="">Select...</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  Open Shift *
                  <span className="ml-1 text-[11px] font-normal text-gray-400">
                    Only open shifts shown
                  </span>
                </label>
                {noShifts ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5">
                    <p className="text-amber-700 text-sm font-semibold">No open shifts</p>
                    <p className="text-amber-600 text-xs mt-0.5">Open a shift before recording sales.</p>
                    <Link href="/shifts/new"
                      className="text-xs font-semibold text-blue-700 hover:underline mt-1 inline-block">
                      → Open a Shift Now
                    </Link>
                  </div>
                ) : (
                  <select className="form-select" value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)} required>
                    <option value="">Select shift...</option>
                    {shifts.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.shift_date} — {sh.shift_type}
                        {sh.shift_sequence > 1 ? ` #${sh.shift_sequence}` : ""}
                        {sh.supervisor_name ? ` (${sh.supervisor_name})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ── NOZZLE SELECTION ── */}
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Nozzle & Product</h2>
            <p className="text-sm text-gray-500 -mt-2">
              Select the pump nozzle the customer is using. The system will deduct
              stock from that nozzle's tank automatically.
            </p>

            {nozzles.length === 0 && stationId ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <p className="text-amber-700 font-semibold text-sm">No nozzles configured</p>
                <p className="text-amber-600 text-xs mt-1">
                  Go to Setup → Tanks & Pumps to add nozzles before recording sales.
                </p>
                <Link href="/setup" className="btn-primary btn-sm inline-flex mt-2">
                  Go to Setup
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {nozzles.map((n) => {
                  const isEmpty  = n.current_tank_stock <= 0;
                  const isLow    = !isEmpty && n.current_tank_stock < 2000;
                  const selected = nozzleId === n.id;

                  return (
                    <label key={n.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${isEmpty  ? "border-red-300 bg-red-50 opacity-80"
                        : isLow   ? "border-amber-300 bg-amber-50"
                        : selected ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" className="hidden"
                        value={n.id}
                        checked={selected}
                        onChange={() => setNozzleId(n.id)} />
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                        selected ? "border-blue-500 bg-blue-500"
                        : isEmpty ? "border-red-300"
                        : "border-gray-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm">{n.nozzle_label}</p>
                        <p className="text-xs text-gray-500">{n.pump_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tank {n.tank_number}: {n.tank_name}
                        </p>
                        <p className={`text-xs font-bold mt-1 ${
                          isEmpty ? "text-red-600"
                          : isLow ? "text-amber-600"
                          : "text-green-700"}`}>
                          {isEmpty
                            ? "EMPTY — cannot sell"
                            : `${formatLitres(n.current_tank_stock)} available`}
                        </p>
                        <p className="text-xs text-gray-400">{n.product_name}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Non-fuel products */}
            {nozzles.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Non-fuel product (no nozzle needed)?</p>
                <select className="form-select w-full" value={nozzleId ? "" : productId}
                  onChange={(e) => {
                    if (e.target.value) { setNozzleId(""); setProductId(e.target.value); }
                  }}>
                  <option value="">— Select non-fuel product —</option>
                  {products.filter((p) => !p.is_fuel).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── AMOUNT / QUANTITY ── */}
          {(selectedNozzle || productId) && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Calculator size={18} className="text-blue-600" /> Amount
              </h2>

              {/* Price */}
              <div>
                <label className="form-label">
                  Pump Price (UGX/Litre) *
                  {priceSet && (
                    <span className="ml-2 text-green-600 text-xs font-normal">
                      ✓ Auto-filled from current price
                    </span>
                  )}
                  {!priceSet && selectedNozzle && (
                    <span className="ml-2 text-amber-600 text-xs font-normal">
                      ⚠ No price set — go to Pump Prices first
                    </span>
                  )}
                </label>
                <input type="number" step="0.01" className="form-input"
                  placeholder="Price per litre"
                  value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
                  required />
              </div>

              {isFuel && (
                <>
                  {/* Entry mode */}
                  <div>
                    <label className="form-label">Customer is buying by...</label>
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {[
                        { value: "by_amount", title: "Amount (UGX)", desc: '"Give me UGX 50,000 of petrol"' },
                        { value: "by_litres", title: "Litres",        desc: '"Give me 20 litres of diesel"' },
                      ].map((opt) => (
                        <label key={opt.value}
                          className={`flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer ${
                            entryMode === opt.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" className="hidden"
                            checked={entryMode === opt.value as any}
                            onChange={() => {
                              setEntryMode(opt.value as any);
                              setAmountUGX(""); setQtyLitres("");
                            }} />
                          <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                            entryMode === opt.value
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300"}`} />
                          <div>
                            <p className="font-bold text-sm text-gray-800">{opt.title}</p>
                            <p className="text-xs text-gray-400">{opt.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {entryMode === "by_amount" ? (
                    <div>
                      <label className="form-label">Amount Customer Pays (UGX) *</label>
                      <input type="number" step="1000" min="0"
                        className="form-input text-2xl font-black py-4"
                        placeholder="e.g. 50000"
                        value={amountUGX} onChange={(e) => setAmountUGX(e.target.value)} />
                      {calculatedLitres !== null && calculatedLitres > 0 && !stockWarning && (
                        <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
                          <CheckCircle size={15} />
                          <span className="font-semibold text-sm">
                            = {formatLitres(calculatedLitres)} will be dispensed
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="form-label">Litres to Dispense *</label>
                      <input type="number" step="0.001" min="0"
                        className="form-input text-2xl font-black py-4"
                        placeholder="e.g. 20.000"
                        value={quantityLitres} onChange={(e) => setQtyLitres(e.target.value)} />
                      {calculatedAmount !== null && calculatedAmount > 0 && !stockWarning && (
                        <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
                          <CheckCircle size={15} />
                          <span className="font-semibold text-sm">
                            = {formatUGX(calculatedAmount)} total charge
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Non-fuel quantity */}
              {!isFuel && productId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Quantity *</label>
                    <input type="number" step="0.001" className="form-input"
                      value={quantityLitres} onChange={(e) => setQtyLitres(e.target.value)}
                      required />
                  </div>
                </div>
              )}

              {/* Stock warning */}
              {stockWarning && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3">
                  <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Stock Insufficient</p>
                    <p className="text-sm">{stockWarning}</p>
                  </div>
                </div>
              )}

              {/* Tank empty hard block */}
              {tankEmpty && selectedNozzle && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3">
                  <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">
                      {selectedNozzle.tank_name} is empty
                    </p>
                    <p className="text-sm">
                      Record and confirm a delivery before making more sales from this tank.
                    </p>
                    <Link href="/deliveries/new"
                      className="btn-danger btn-sm inline-flex mt-2">
                      Record Delivery
                    </Link>
                  </div>
                </div>
              )}

              {/* No price warning */}
              {!priceSet && selectedNozzle && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    No pump price set for {selectedNozzle.product_name}.
                    <Link href="/prices" className="underline font-semibold ml-1">
                      Set a price first →
                    </Link>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={transactionDate}
                    onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input" value={transactionTime}
                    onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT ── */}
          {(selectedNozzle || productId) && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-800 text-lg">Payment Method</h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { value: "cash",         label: "Cash",      bg: "bg-green-500"  },
                  { value: "mtn_momo",     label: "MTN MoMo",  bg: "bg-yellow-500" },
                  { value: "airtel_money", label: "Airtel",    bg: "bg-red-500"    },
                  { value: "fuel_card",    label: "Fuel Card", bg: "bg-blue-500"   },
                  { value: "credit",       label: "Credit",    bg: "bg-purple-500" },
                  { value: "lpo",          label: "LPO",       bg: "bg-orange-500" },
                ].map((opt) => (
                  <button key={opt.value} type="button"
                    onClick={() => setPaymentType(opt.value)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                      paymentType === opt.value
                        ? `${opt.bg} text-white border-transparent shadow-md`
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                {(paymentType === "mtn_momo" || paymentType === "airtel_money") && (
                  <div>
                    <label className="form-label">MoMo Transaction Reference *</label>
                    <input type="text" className="form-input"
                      placeholder="Reference from SMS confirmation"
                      value={momoRef} onChange={(e) => setMomoRef(e.target.value)} />
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Info size={11} />
                      Only confirm after receiving the SMS on the station till
                    </p>
                  </div>
                )}
                {paymentType === "fuel_card" && (
                  <div>
                    <label className="form-label">Fuel Card Number</label>
                    <input type="text" className="form-input font-mono"
                      value={fuelCardNum} onChange={(e) => setFuelCardNum(e.target.value)} />
                  </div>
                )}
                {paymentType === "lpo" && (
                  <div>
                    <label className="form-label">LPO Number *</label>
                    <input type="text" className="form-input"
                      placeholder="Official LPO reference number"
                      value={lpoNumber} onChange={(e) => setLpoNumber(e.target.value)} />
                  </div>
                )}
                {paymentType === "credit" && (
                  <div className="space-y-3">
                    <div>
                      <label className="form-label">Fleet / Credit Customer *</label>
                      <select className="form-select" value={creditCustomerId}
                        onChange={(e) => setCreditId(e.target.value)}>
                        <option value="">Select customer...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Vehicle Registration</label>
                        <input type="text" className="form-input"
                          placeholder="e.g. UAA 123B"
                          value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
                      </div>
                      <div>
                        <label className="form-label">Driver Name</label>
                        <input type="text" className="form-input"
                          value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RECEIPT & ENTRY ── */}
          {(selectedNozzle || productId) && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-800">Receipt & Entry</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">EFD Receipt Number</label>
                  <input type="text" className="form-input font-mono"
                    placeholder="URA EFD #"
                    value={efdNumber} onChange={(e) => setEfdNumber(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Entered By</label>
                  <input type="text" className="form-input"
                    placeholder="Your name"
                    value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2}
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
              <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <Link href="/sales" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary px-8"
              disabled={saving || !!stockWarning || tankEmpty || noShifts || !shiftId}>
              {saving
                ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                : "Save Sale"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}