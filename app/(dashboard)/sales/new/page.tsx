"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatLitres, today } from "@/utils";
import {
  ArrowLeft, Loader2, AlertTriangle,
  CheckCircle, Calculator, Fuel
} from "lucide-react";

export default function NewSalePage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [products, setProducts]   = useState<any[]>([]);
  const [shifts, setShifts]       = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice]     = useState<number | null>(null);
  const [priceSet, setPriceSet]             = useState(false);
  const [stockError, setStockError]         = useState("");
  const [calculatedLitres, setCalculatedLitres] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  const [stationId, setStationId]       = useState(activeStation?.id ?? "");
  const [shiftId, setShiftId]           = useState("");
  const [productId, setProductId]       = useState("");
  const [transactionDate, setDate]      = useState(today());
  const [transactionTime, setTime]      = useState("");
  const [entryMode, setEntryMode]       = useState<"by_amount" | "by_litres">("by_amount");
  const [amountUGX, setAmountUGX]       = useState("");
  const [quantityLitres, setQtyLitres]  = useState("");
  const [unitPrice, setUnitPrice]       = useState("");
  const [paymentType, setPaymentType]   = useState("cash");
  const [momoRef, setMomoRef]           = useState("");
  const [fuelCardNum, setFuelCardNum]   = useState("");
  const [lpoNumber, setLpoNumber]       = useState("");
  const [creditCustomerId, setCreditId] = useState("");
  const [vehicleReg, setVehicleReg]     = useState("");
  const [driverName, setDriverName]     = useState("");
  const [efdNumber, setEfdNumber]       = useState("");
  const [enteredBy, setEnteredBy]       = useState("");
  const [notes, setNotes]               = useState("");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [pRes, cRes] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("product_type").order("name"),
        supabase.from("credit_customers").select("*").eq("is_active", true).order("name"),
      ]);
      if (pRes.data) setProducts(pRes.data);
      if (cRes.data) setCustomers(cRes.data);
    };
    load();
  }, []);

  useEffect(() => {
    if (!stationId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("shifts").select("id, shift_type, shift_date, status")
        .eq("station_id", stationId).in("status", ["open", "closed"])
        .order("shift_date", { ascending: false }).limit(20);
      if (data) setShifts(data);
    };
    load();
  }, [stationId]);

  useEffect(() => {
    if (!productId || !stationId) {
      setAvailableStock(null); setCurrentPrice(null); setPriceSet(false);
      setCalculatedLitres(null); setCalculatedAmount(null);
      return;
    }
    const load = async () => {
      const supabase = createClient();
      const [stockRes, priceRes] = await Promise.all([
        supabase.rpc("get_available_stock", { p_station_id: stationId, p_product_id: productId }),
        supabase.from("product_prices").select("pump_price_ugx")
          .eq("product_id", productId).eq("station_id", stationId)
          .lte("effective_date", today()).order("effective_date", { ascending: false })
          .limit(1).single(),
      ]);
      setAvailableStock(stockRes.data ?? 0);
      if (priceRes.data) {
        setCurrentPrice(priceRes.data.pump_price_ugx);
        setUnitPrice(priceRes.data.pump_price_ugx.toString());
        setPriceSet(true);
      } else { setCurrentPrice(null); setPriceSet(false); setUnitPrice(""); }
    };
    load();
  }, [productId, stationId]);

  useEffect(() => {
    const price = parseFloat(unitPrice || "0");
    if (price <= 0) { setCalculatedLitres(null); setCalculatedAmount(null); return; }
    const isFuelProd = products.find((p) => p.id === productId)?.is_fuel;

    if (entryMode === "by_amount") {
      const amt = parseFloat(amountUGX || "0");
      if (amt > 0) {
        const litres = amt / price;
        setCalculatedLitres(litres); setCalculatedAmount(null);
        if (isFuelProd && availableStock !== null && litres > availableStock + 0.5)
          setStockError(`Not enough stock. Available: ${formatLitres(availableStock)}. This sale needs ${formatLitres(litres)}.`);
        else setStockError("");
      } else { setCalculatedLitres(null); setStockError(""); }
    } else {
      const litres = parseFloat(quantityLitres || "0");
      if (litres > 0) {
        setCalculatedAmount(litres * price); setCalculatedLitres(null);
        if (isFuelProd && availableStock !== null && litres > availableStock + 0.5)
          setStockError(`Not enough stock. Available: ${formatLitres(availableStock)}. Requested: ${formatLitres(litres)}.`);
        else setStockError("");
      } else { setCalculatedAmount(null); setStockError(""); }
    }
  }, [amountUGX, quantityLitres, unitPrice, entryMode, availableStock, productId, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stockError) { setError("Cannot save: " + stockError); return; }
    const price = parseFloat(unitPrice || "0");
    if (price <= 0) { setError("Enter a price per litre."); return; }

    let finalLitres: number;
    let finalAmount: number;

    if (entryMode === "by_amount") {
      finalAmount = parseFloat(amountUGX || "0");
      finalLitres = finalAmount / price;
    } else {
      finalLitres = parseFloat(quantityLitres || "0");
      finalAmount = finalLitres * price;
    }

    const selectedProduct = products.find((p) => p.id === productId);
    if (!selectedProduct?.is_fuel && !quantityLitres) { setError("Enter quantity."); return; }
    if (finalLitres <= 0) { setError("Enter a valid amount or quantity."); return; }

    setSaving(true); setError("");
    const supabase = createClient();

    const { error: err } = await supabase.from("sales_transactions").insert({
      station_id: stationId, shift_id: shiftId || null,
      product_id: productId, transaction_date: transactionDate,
      transaction_time: transactionTime || null,
      quantity: Math.round(finalLitres * 1000) / 1000,
      unit_price_ugx: price, discount_ugx: 0,
      payment_type: paymentType,
      momo_reference: momoRef || null, fuel_card_number: fuelCardNum || null,
      lpo_number: lpoNumber || null,
      credit_customer_id: creditCustomerId || null,
      vehicle_reg: vehicleReg || null, driver_name: driverName || null,
      efd_receipt_number: efdNumber || null,
      entered_by: enteredBy || null, notes: notes || null,
    });

    if (err) {
      if (err.message.includes("INSUFFICIENT_STOCK")) {
        const parts = err.message.split("|");
        setError(`Stock Error — ${parts[1] ?? ""} ${parts[2] ?? ""}`);
      } else { setError(err.message); }
      setSaving(false); return;
    }

    if (paymentType === "credit" && creditCustomerId) {
      await supabase.from("credit_account_transactions").insert({
        credit_customer_id: creditCustomerId, station_id: stationId,
        transaction_date: transactionDate, entry_type: "charge",
        amount_ugx: finalAmount, entered_by: enteredBy || null,
        notes: `Fuel sale — ${vehicleReg ?? ""}`,
      });
    }

    router.push("/sales");
  };

  const selectedProduct = products.find((p) => p.id === productId);
  const isFuel    = selectedProduct?.is_fuel ?? false;
  const isBlocked = isFuel && availableStock !== null && availableStock <= 0;

  return (
    <>
      <Header title="Record Sale" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Sales
        </Link>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">What was sold?</h2>
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
                <label className="form-label">Product *</label>
                <select className="form-select" value={productId}
                  onChange={(e) => setProductId(e.target.value)} required>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Link to Shift</label>
                <select className="form-select" value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}>
                  <option value="">No shift selected</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.shift_date} — {sh.shift_type} ({sh.status})
                    </option>
                  ))}
                </select>
              </div>
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

            {productId && stationId && (
              <div className={`rounded-xl border p-4 flex justify-between items-center flex-wrap gap-3 ${
                isBlocked ? "bg-red-50 border-red-300" : "bg-blue-50 border-blue-200"}`}>
                <div className="flex items-center gap-3">
                  <Fuel size={20} className={isBlocked ? "text-red-600" : "text-blue-600"} />
                  <div>
                    <p className="text-xs text-gray-500">Available Stock</p>
                    <p className={`font-black text-xl ${
                      isBlocked ? "text-red-700" :
                      availableStock !== null && availableStock < 500 ? "text-amber-700" :
                      "text-blue-800"}`}>
                      {availableStock !== null ? formatLitres(availableStock) : "Loading..."}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Today&apos;s Pump Price</p>
                  {priceSet
                    ? <p className="font-black text-xl text-green-700">{formatUGX(currentPrice)}/L</p>
                    : <p className="text-amber-600 text-sm font-semibold">No price set</p>}
                </div>
                {isBlocked && (
                  <div className="w-full flex items-center gap-2 text-red-700 text-sm font-semibold">
                    <AlertTriangle size={15} />
                    Stock empty — record a delivery before making more sales
                  </div>
                )}
                {!priceSet && (
                  <div className="w-full flex items-center gap-2 text-amber-700 text-xs">
                    <AlertTriangle size={13} />
                    Go to <Link href="/prices" className="underline font-semibold">Pump Prices</Link> to set today&apos;s price
                  </div>
                )}
              </div>
            )}
          </div>

          {isFuel && productId && (
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Calculator size={18} className="text-blue-600" /> How much?
              </h2>
              <div>
                <label className="form-label">
                  Pump Price (UGX/Litre) *
                  {priceSet && <span className="ml-2 text-green-600 text-xs font-normal">✓ Auto-filled</span>}
                </label>
                <input type="number" step="0.01" className="form-input"
                  placeholder="Price per litre" value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)} required />
              </div>

              <div>
                <label className="form-label">Customer is buying by...</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    { value: "by_amount", title: "Amount (UGX)", desc: 'Customer says: "Give me 100,000 of petrol"' },
                    { value: "by_litres", title: "Litres",        desc: 'Customer says: "Give me 20 litres of diesel"' },
                  ].map((opt) => (
                    <label key={opt.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${entryMode === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" className="hidden"
                        checked={entryMode === opt.value as any}
                        onChange={() => { setEntryMode(opt.value as any); setAmountUGX(""); setQtyLitres(""); }} />
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0
                        ${entryMode === opt.value ? "border-blue-500 bg-blue-500" : "border-gray-300"}`} />
                      <div>
                        <p className="font-bold text-sm text-gray-800">{opt.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
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
                    placeholder="e.g. 100000"
                    value={amountUGX} onChange={(e) => setAmountUGX(e.target.value)} />
                  {calculatedLitres !== null && calculatedLitres > 0 && (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2.5">
                      <CheckCircle size={16} />
                      <span className="font-semibold">= {formatLitres(calculatedLitres)} will be dispensed</span>
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
                  {calculatedAmount !== null && calculatedAmount > 0 && (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2.5">
                      <CheckCircle size={16} />
                      <span className="font-semibold">= {formatUGX(calculatedAmount)} total charge</span>
                    </div>
                  )}
                </div>
              )}

              {stockError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-3">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{stockError}</p>
                </div>
              )}
            </div>
          )}

          {!isFuel && productId && (
            <div className="card p-5 space-y-3">
              <h2 className="font-bold text-gray-800">Quantity & Price</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Quantity *</label>
                  <input type="number" step="0.001" className="form-input"
                    value={quantityLitres} onChange={(e) => setQtyLitres(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Unit Price (UGX) *</label>
                  <input type="number" step="0.01" className="form-input"
                    value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
                </div>
              </div>
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Payment</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { value: "cash",         label: "Cash",      bg: "bg-green-500" },
                { value: "mtn_momo",     label: "MTN MoMo",  bg: "bg-yellow-500" },
                { value: "airtel_money", label: "Airtel",    bg: "bg-red-500" },
                { value: "fuel_card",    label: "Fuel Card", bg: "bg-blue-500" },
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
                    placeholder="Reference from the SMS confirmation"
                    value={momoRef} onChange={(e) => setMomoRef(e.target.value)} />
                  <p className="text-xs text-amber-600 mt-1">
                    Only confirm after receiving SMS on station till — never accept screenshots
                  </p>
                </div>
              )}
              {paymentType === "fuel_card" && (
                <div>
                  <label className="form-label">Fuel Card Number</label>
                  <input type="text" className="form-input"
                    value={fuelCardNum} onChange={(e) => setFuelCardNum(e.target.value)} />
                </div>
              )}
              {paymentType === "lpo" && (
                <div>
                  <label className="form-label">LPO Number *</label>
                  <input type="text" className="form-input" placeholder="Official LPO reference"
                    value={lpoNumber} onChange={(e) => setLpoNumber(e.target.value)} />
                </div>
              )}
              {paymentType === "credit" && (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Fleet Customer *</label>
                    <select className="form-select" value={creditCustomerId}
                      onChange={(e) => setCreditId(e.target.value)}>
                      <option value="">Select customer...</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Vehicle Registration</label>
                      <input type="text" className="form-input" placeholder="e.g. UAA 123B"
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

          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800">Receipt & Entry</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">EFD Receipt Number</label>
                <input type="text" className="form-input font-mono" placeholder="URA EFD #"
                  value={efdNumber} onChange={(e) => setEfdNumber(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name"
                  value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pb-6">
            <Link href="/sales" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary px-8"
              disabled={saving || !!stockError || isBlocked}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Sale"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}