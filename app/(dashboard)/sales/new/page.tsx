"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { Product, Shift, CreditCustomer } from "@/types/database";
import { formatUGX, today } from "@/utils";
import { ArrowLeft, Loader2 } from "lucide-react";

interface SaleForm {
  station_id: string; shift_id: string; product_id: string;
  transaction_date: string; transaction_time: string;
  quantity: string; unit_price_ugx: string; discount_ugx: string;
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

  const { register, handleSubmit, watch, setValue } = useForm<SaleForm>({
    defaultValues: { station_id: activeStation?.id ?? "", transaction_date: today(), payment_type: "cash", discount_ugx: "0" },
  });

  const paymentType = watch("payment_type");
  const qty = parseFloat(watch("quantity") || "0");
  const price = parseFloat(watch("unit_price_ugx") || "0");
  const discount = parseFloat(watch("discount_ugx") || "0");
  const subtotal = qty * price - discount;
  const stationId = watch("station_id");

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

  const handleProductChange = async (productId: string) => {
    if (!productId || !stationId) return;
    const supabase = createClient();
    const { data } = await supabase.from("product_prices").select("pump_price_ugx")
      .eq("product_id", productId).eq("station_id", stationId)
      .lte("effective_date", today()).order("effective_date", { ascending: false }).limit(1).single();
    if (data) setValue("unit_price_ugx", data.pump_price_ugx.toString());
  };

  const onSubmit = async (data: SaleForm) => {
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("sales_transactions").insert({
      station_id: data.station_id, shift_id: data.shift_id || null,
      product_id: data.product_id, transaction_date: data.transaction_date,
      transaction_time: data.transaction_time || null, quantity: parseFloat(data.quantity),
      unit_price_ugx: parseFloat(data.unit_price_ugx), discount_ugx: parseFloat(data.discount_ugx || "0"),
      payment_type: data.payment_type, momo_reference: data.momo_reference || null,
      fuel_card_number: data.fuel_card_number || null, lpo_number: data.lpo_number || null,
      bank_pos_reference: data.bank_pos_reference || null,
      credit_customer_id: data.credit_customer_id || null,
      vehicle_reg: data.vehicle_reg || null, driver_name: data.driver_name || null,
      efd_receipt_number: data.efd_receipt_number || null,
      entered_by: data.entered_by || null, notes: data.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    if (data.payment_type === "credit" && data.credit_customer_id) {
      await supabase.from("credit_account_transactions").insert({
        credit_customer_id: data.credit_customer_id, station_id: data.station_id,
        transaction_date: data.transaction_date, entry_type: "charge",
        amount_ugx: subtotal, entered_by: data.entered_by || null,
        notes: `Fuel sale — ${data.vehicle_reg ?? ""}`,
      });
    }
    router.push("/sales");
  };

  return (
    <>
      <Header title="Add Sale" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Link href="/sales" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </Link>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Sale Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Link to Shift</label>
                <select className="form-select" {...register("shift_id")}>
                  <option value="">Not linked</option>
                  {shifts.map((sh) => <option key={sh.id} value={sh.id}>{sh.shift_date} — {sh.shift_type}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Product *</label>
                <select className="form-select" {...register("product_id", { required: true })}
                  onChange={(e) => { setValue("product_id", e.target.value); handleProductChange(e.target.value); }}>
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
              <div>
                <label className="form-label">Quantity *</label>
                <input type="number" step="0.001" className="form-input" {...register("quantity", { required: true })} />
              </div>
              <div>
                <label className="form-label">Unit Price (UGX) *</label>
                <input type="number" step="0.01" className="form-input" {...register("unit_price_ugx", { required: true })} />
              </div>
              <div>
                <label className="form-label">Discount (UGX)</label>
                <input type="number" step="0.01" className="form-input" defaultValue="0" {...register("discount_ugx")} />
              </div>
            </div>
            {subtotal > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex justify-between">
                <span className="text-sm text-green-700 font-medium">Total Amount</span>
                <span className="text-lg font-bold text-green-800">{formatUGX(subtotal)}</span>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Payment</h2>
            <div>
              <label className="form-label">Payment Method *</label>
              <select className="form-select" {...register("payment_type", { required: true })}>
                <option value="cash">Cash</option>
                <option value="mtn_momo">MTN MoMo</option>
                <option value="airtel_money">Airtel Money</option>
                <option value="fuel_card">Fuel Card</option>
                <option value="credit">Credit (Fleet Account)</option>
                <option value="lpo">LPO</option>
                <option value="bank_pos">Bank POS</option>
              </select>
            </div>
            {(paymentType === "mtn_momo" || paymentType === "airtel_money") && (
              <div>
                <label className="form-label">MoMo / Airtel Reference</label>
                <input type="text" className="form-input" placeholder="Transaction ID from SMS" {...register("momo_reference")} />
              </div>
            )}
            {paymentType === "fuel_card" && (
              <div><label className="form-label">Fuel Card Number</label>
                <input type="text" className="form-input" {...register("fuel_card_number")} /></div>
            )}
            {paymentType === "lpo" && (
              <div><label className="form-label">LPO Number</label>
                <input type="text" className="form-input" {...register("lpo_number")} /></div>
            )}
            {paymentType === "credit" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Credit Customer *</label>
                  <select className="form-select" {...register("credit_customer_id")}>
                    <option value="">Select customer...</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Vehicle Reg</label>
                  <input type="text" className="form-input" placeholder="e.g. UAA 123B" {...register("vehicle_reg")} /></div>
                <div><label className="form-label">Driver Name</label>
                  <input type="text" className="form-input" {...register("driver_name")} /></div>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Receipt & Entry</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="form-label">EFD Receipt Number</label>
                <input type="text" className="form-input font-mono" {...register("efd_receipt_number")} /></div>
              <div><label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name" {...register("entered_by")} /></div>
              <div className="sm:col-span-2"><label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} {...register("notes")} /></div>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3">
            <Link href="/sales" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Sale"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}