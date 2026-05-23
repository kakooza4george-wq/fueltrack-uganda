"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Product, Shift, CreditCustomer } from "@/types/database";
import { formatUGX, formatLitres, today } from "@/utils";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, Calculator } from "lucide-react";

interface SaleForm {
  station_id: string; shift_id: string; product_id: string;
  transaction_date: string; transaction_time: string;
  entry_mode: "by_amount" | "by_litres";
  amount_ugx: string; quantity_litres: string; unit_price_ugx: string;
  payment_type: string; momo_reference: string; fuel_card_number: string;
  lpo_number: string; bank_pos_reference: string;
  credit_customer_id: string; vehicle_reg: string; driver_name: string;
  efd_receipt_number: string; entered_by: string; notes: string;
}

export default function NewSalePage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [products, setProducts] = useState<Product[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceSet, setPriceSet] = useState(false);
  const [stockError, setStockError] = useState("");
  const [calculatedLitres, setCalculatedLitres] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);

  const { register, handleSubmit, watch, setValue } = useForm<SaleForm>({
    defaultValues: {
      station_id: activeStation?.id ?? "",
      transaction_date: today(),
      payment_type: "cash",
      entry_mode: "by_amount",
    },
  });

  const stationId = watch("station_id");
  const productId = watch("product_id");
  const entryMode = watch("entry_mode");
  const amountUGX = watch("amount_ugx");
  const quantityLitres = watch("quantity_litres");
  const unitPrice = watch("unit_price_ugx");
  const paymentType = watch("payment_type");

  useEffect(() => { if (activeStation) setValue("station_id", activeStation.id); }, [activeStation, setValue]);

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
      const { data } = await supabase.from("shifts").select("*")
        .eq("station_id", stationId).in("status", ["open", "closed"])
        .order("shift_date", { ascending: false }).limit(20);
      if (data) setShifts(data);
    };
    load();
  }, [stationId]);

  // Load stock + price when product/station changes
  useEffect(() => {
    if (!productId || !stationId) {
      setAvailableStock(null); setCurrentPrice(null); setPriceSet(false); return;
    }
    const load = async () => {
      const supabase = createClient();
      const { data: stockData } = await supabase.rpc("get_available_stock", {
        p_station_id: stationId, p_product_id: productId,
      });
      setAvailableStock(stockData ?? 0);

      const { data: priceData } = await supabase.from("product_prices")
        .select("pump_price_ugx").eq("product_id", productId).eq("station_id", stationId)
        .lte("effective_date", today()).order("effective_date", { ascending: false }).limit(1).single();

      if (priceData) {
        setCurrentPrice(priceData.pump_price_ugx);
        setValue("unit_price_ugx", priceData.pump_price_ugx.toString());
        setPriceSet(true);
      } else {
        setCurrentPrice(null); setPriceSet(false); setValue("unit_price_ugx", "");
      }
    };
    load();
  }, [productId, stationId, setValue]);

  // Live calculation
  useEffect(() => {
    const price = parseFloat(unitPrice || "0");
    if (price <= 0) return;
    if (entryMode === "by_amount") {
      const amt = parseFloat(amountUGX || "0");
      if (amt > 0) {
        const litres = amt / price;
        setCalculatedLitres(litres); setCalculatedAmount(null);
        if (availableStock !== null && litres > availableStock + 0.5) {
          setStockError(`Insufficient stock. Available: ${formatLitres(availableStock)}. This sale needs ${formatLitres(litres)}.`);
        } else { setStockError(""); }
      } else { setCalculatedLitres(null); setStockError(""); }
    } else {
      const litres = parseFloat(quantityLitres || "0");
      if (litres > 0) {
        setCalculatedAmount(litres * price); setCalculatedLitres(null);
        if (availableStock !== null && litres > availableStock + 0.5) {
          setStockError(`Insufficient stock. Available: ${formatLitres(availableStock)}. Requested: ${formatLitres(litres)}.`);
        } else { setStockError(""); }
      } else { setCalculatedAmount(null); setStockError(""); }
    }
  }, [amountUGX, quantityLitres, unitPrice, entryMode, availableStock]);

  const onSubmit = async (data: SaleForm) => {
    if (stockError) { setError("Cannot save: " + stockError); return; }
    const price = parseFloat(data.unit_price_ugx);
    let finalLitres: number;
    let finalAmount: number;

    if (data.entry_mode === "by_amount") {
      finalAmount = parseFloat(data.amount_ugx || "0");
      finalLitres = finalAmount / price;
    } else {
      finalLitres = parseFloat(data.quantity_litres || "0");
      finalAmount = finalLitres * price;
    }

    if (!finalLitres || finalLitres <= 0) { setError("Enter a valid amount or quantity."); return; }

    setSaving(true); setError("");
    const supabase = createClient();

    const { error: err } = await supabase.from("sales_transactions").insert({
      station_id: data.station_id,
      shift_id: data.shift_id || null,
      product_id: data.product_id,
      transaction_date: data.transaction_date,
      transaction_time: data.transaction_time || null,
      quantity: Math.round(finalLitres * 1000) / 1000,
      unit_price_ugx: price,
      discount_ugx: 0,
      payment_type: data.payment_type,
      momo_reference: data.momo_reference || null,
      fuel_card_number: data.fuel_card_number || null,
      lpo_number: data.lpo_number || null,
      bank_pos_reference: data.bank_pos_reference || null,
      credit_customer_id: data.credit_customer_id || null,
      vehicle_reg: data.vehicle_reg || null,
      driver_name: data.driver_name || null,
      efd_receipt_number: data.efd_receipt_number || null,
      entered_by: data.entered_by || null,
      notes: data.notes || null,
    });

    if (err) {
      if (err.message.includes("INSUFFICIENT_STOCK")) {
        const parts = err.message.split("|");
        setError(`Stock blocked: ${parts[1] ?? ""} — ${parts[2] ?? ""}`);
      } else { setError(err.message); }
      setSaving(false); return;
    }

    if (data.payment_type === "credit" && data.credit_customer_id) {
      await supabase.from("credit_account_transactions").insert({
        credit_customer_id: data.credit_customer_id,
        station_id: data.station_id,
        transaction_date: data.transaction_date,
        entry_type: "charge",
        amount_ugx: finalAmount,
        entered_by: data.entered_by || null,
        notes: `Fuel — ${data.vehicle_reg ?? ""}`,
      });
    }

    router.push("/sales");
  };

  const selectedProduct = products.find((p) => p.id === productId);
  const isFuel = selectedProduct?.is_fuel ?? false;
  const isBlocked = isFuel && availableStock !== null && availableStock <= 0;

  return (
    <>
      <Header title="Record Sale" />
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Sales
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Station + Product */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Sale Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Shift (optional)</label>
                <select className="form-select" {...register("shift_id")}>
                  <option value="">Not linked to shift</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>{sh.shift_date} — {sh.shift_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Product *</label>
                <select className="form-select"
                  {...register("product_id", { required: true })}
                  onChange={(e) => { setValue("product_id", e.target.value); }}>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" {...register("transaction_date", { required: true })} />
              </div>
              <div>
                <label className="form-label">Time</label>
                <input type="time" className="form-input" {...register("transaction_time")} />
              </div>
            </div>

            {/* Stock + Price info bar */}
            {productId && stationId && (
              <div className={`rounded-xl border p-4 ${isBlocked ? "bg-red-50 border-red-300" : "bg-blue-50 border-blue-200"}`}>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Available Stock</p>
                    <p className={`font-bold text-xl ${isBlocked ? "text-red-700" : availableStock !== null && availableStock < 500 ? "text-amber-700" : "text-blue-800"}`}>
                      {availableStock !== null ? formatLitres(availableStock) : "Loading..."}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Today&apos;s Pump Price</p>
                    {priceSet
                      ? <p className="font-bold text-xl text-green-700">{formatUGX(currentPrice)}/L</p>
                      : <p className="text-amber-600 text-sm font-medium">No price set — go to Pump Prices first</p>}
                  </div>
                </div>
                {isBlocked && (
                  <div className="mt-2 flex items-center gap-2 text-red-700 text-sm font-semibold">
                    <AlertTriangle size={15} /> Stock depleted — record a delivery before making more sales
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Smart quantity section — fuel only */}
          {isFuel && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Calculator size={17} className="text-blue-600" /> Quantity Entry
              </h2>

              <div>
                <label className="form-label">Pump Price (UGX per Litre) *</label>
                <input type="number" step="0.01" className="form-input"
                  placeholder="Price per litre" {...register("unit_price_ugx", { required: true })} />
                {!priceSet && (
                  <p className="text-xs text-amber-600 mt-1">No price found — enter manually or set it in Pump Prices</p>
                )}
              </div>

              {/* Mode selector */}
              <div>
                <label className="form-label">How is the customer buying?</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    { value: "by_amount", title: "By Amount (UGX)", desc: "Customer says: give me UGX 100,000 of petrol" },
                    { value: "by_litres", title: "By Litres", desc: "Customer says: give me 20 litres of diesel" },
                  ].map((opt) => (
                    <label key={opt.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${entryMode === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" value={opt.value} className="hidden"
                        {...register("entry_mode")}
                        onChange={() => setValue("entry_mode", opt.value as "by_amount" | "by_litres")} />
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${entryMode === opt.value ? "border-blue-500 bg-blue-500" : "border-gray-300"}`} />
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{opt.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {entryMode === "by_amount" ? (
                <div>
                  <label className="form-label">Amount Customer Pays (UGX) *</label>
                  <input type="number" step="1000" min="0" className="form-input text-lg font-bold"
                    placeholder="e.g. 100000" {...register("amount_ugx")} />
                  {calculatedLitres !== null && calculatedLitres > 0 && (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
                      <CheckCircle size={15} />
                      <span className="text-sm font-medium">= {formatLitres(calculatedLitres)} will be dispensed</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="form-label">Litres to Dispense *</label>
                  <input type="number" step="0.001" min="0" className="form-input text-lg font-bold"
                    placeholder="e.g. 20.000" {...register("quantity_litres")} />
                  {calculatedAmount !== null && calculatedAmount > 0 && (
                    <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
                      <CheckCircle size={15} />
                      <span className="text-sm font-medium">= {formatUGX(calculatedAmount)} total charge</span>
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

          {/* Non-fuel quantity */}
          {!isFuel && productId && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-gray-800">Quantity</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Quantity *</label>
                  <input type="number" step="0.001" className="form-input"
                    {...register("quantity_litres", { required: true })} />
                </div>
                <div>
                  <label className="form-label">Unit Price (UGX) *</label>
                  <input type="number" step="0.01" className="form-input"
                    {...register("unit_price_ugx", { required: true })} />
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Payment Method</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { value: "cash", label: "Cash" },
                { value: "mtn_momo", label: "MTN MoMo" },
                { value: "airtel_money", label: "Airtel Money" },
                { value: "fuel_card", label: "Fuel Card" },
                { value: "credit", label: "Credit (Fleet)" },
                { value: "lpo", label: "LPO" },
              ].map((opt) => (
                <label key={opt.value}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all
                    ${paymentType === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <input type="radio" value={opt.value} className="hidden"
                    {...register("payment_type")} onChange={() => setValue("payment_type", opt.value)} />
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${paymentType === opt.value ? "border-blue-500 bg-blue-500" : "border-gray-300"}`} />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="space-y-3 pt-1">
              {(paymentType === "mtn_momo" || paymentType === "airtel_money") && (
                <div>
                  <label className="form-label">MoMo Reference *</label>
                  <input type="text" className="form-input" placeholder="Transaction ID from SMS"
                    {...register("momo_reference")} />
                  <p className="text-xs text-amber-600 mt-1">
                    Only confirm after receiving SMS on the station till — never accept customer screenshots
                  </p>
                </div>
              )}
              {paymentType === "fuel_card" && (
                <div>
                  <label className="form-label">Fuel Card Number</label>
                  <input type="text" className="form-input" {...register("fuel_card_number")} />
                </div>
              )}
              {paymentType === "lpo" && (
                <div>
                  <label className="form-label">LPO Number *</label>
                  <input type="text" className="form-input" placeholder="Official LPO reference"
                    {...register("lpo_number")} />
                </div>
              )}
              {paymentType === "credit" && (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Fleet Customer *</label>
                    <select className="form-select" {...register("credit_customer_id")}>
                      <option value="">Select customer...</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Vehicle Registration</label>
                      <input type="text" className="form-input" placeholder="e.g. UAA 123B"
                        {...register("vehicle_reg")} />
                    </div>
                    <div>
                      <label className="form-label">Driver Name</label>
                      <input type="text" className="form-input" {...register("driver_name")} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* EFD + entry details */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Receipt and Entry Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">EFD Receipt Number</label>
                <input type="text" className="form-input font-mono" placeholder="URA EFD #"
                  {...register("efd_receipt_number")} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name"
                  {...register("entered_by")} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} {...register("notes")} />
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