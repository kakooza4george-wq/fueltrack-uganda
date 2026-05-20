"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { CreditCustomer } from "@/types/database";
import { today } from "@/utils";
import { ArrowLeft, Loader2 } from "lucide-react";

interface PaymentForm {
  credit_customer_id: string; station_id: string; transaction_date: string;
  amount_ugx: string; payment_method: string; payment_reference: string;
  entered_by: string; notes: string;
}

export default function NewCreditPaymentPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue } = useForm<PaymentForm>({
    defaultValues: { station_id: activeStation?.id ?? "", transaction_date: today(), payment_method: "bank_transfer" },
  });

  useEffect(() => { if (activeStation) setValue("station_id", activeStation.id); }, [activeStation, setValue]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("credit_customers").select("*").eq("is_active", true).order("name");
      if (data) setCustomers(data);
    };
    load();
  }, []);

  const onSubmit = async (data: PaymentForm) => {
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("credit_account_transactions").insert({
      credit_customer_id: data.credit_customer_id, station_id: data.station_id,
      transaction_date: data.transaction_date, entry_type: "payment",
      amount_ugx: parseFloat(data.amount_ugx), payment_method: data.payment_method,
      payment_reference: data.payment_reference || null,
      entered_by: data.entered_by || null, notes: data.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.push("/credit");
  };

  return (
    <>
      <Header title="Record Credit Payment" />
      <div className="p-6 max-w-xl mx-auto space-y-6">
        <Link href="/credit" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back
        </Link>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Payment Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Customer *</label>
                <select className="form-select" {...register("credit_customer_id", { required: true })}>
                  <option value="">Select customer...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Station (payment received at) *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Payment Date *</label>
                <input type="date" className="form-input" {...register("transaction_date", { required: true })} />
              </div>
              <div>
                <label className="form-label">Amount (UGX) *</label>
                <input type="number" step="0.01" className="form-input" placeholder="0.00"
                  {...register("amount_ugx", { required: true })} />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select className="form-select" {...register("payment_method")}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="form-label">Reference (bank ref / cheque #)</label>
                <input type="text" className="form-input" {...register("payment_reference")} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" {...register("entered_by")} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} {...register("notes")} />
              </div>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3">
            <Link href="/credit" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}