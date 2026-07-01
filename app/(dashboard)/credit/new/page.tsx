"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today, formatUGX } from "@/utils";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export default function NewCreditPaymentPage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [customers, setCustomers]   = useState<any[]>([]);
  const [selectedCustomer, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const [customerId, setCustomerId]   = useState("");
  const [stationId, setStationId]     = useState(activeStation?.id ?? "");
  const [paymentDate, setDate]        = useState(today());
  const [amountUGX, setAmountUGX]     = useState("");
  const [paymentMethod, setMethod]    = useState("bank_transfer");
  const [paymentRef, setPaymentRef]   = useState("");
  const [enteredBy, setEnteredBy]     = useState("");
  const [notes, setNotes]             = useState("");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("vw_credit_balances").select("*").order("customer_name");
      if (data) setCustomers(data);
    };
    load();
  }, []);

  useEffect(() => {
    setSelected(customers.find((c) => c.credit_customer_id === customerId) ?? null);
  }, [customerId, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setError("Select a customer."); return; }
    const amount = parseFloat(amountUGX);
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("credit_account_transactions").insert({
      credit_customer_id: customerId, station_id: stationId,
      transaction_date: paymentDate, entry_type: "payment",
      amount_ugx: amount, payment_method: paymentMethod,
      payment_reference: paymentRef || null,
      entered_by: enteredBy || null, notes: notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.push("/credit");
  };

  return (
    <>
      <Header title="Record Credit Payment" />
      <div className="p-6 max-w-xl mx-auto space-y-5">
        <Link href="/credit" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Credit Accounts
        </Link>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Payment Details</h2>
            <div>
              <label className="form-label">Customer *</label>
              <select className="form-select" value={customerId}
                onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.credit_customer_id} value={c.credit_customer_id}>{c.customer_name}</option>
                ))}
              </select>
            </div>
            {selectedCustomer && (
              <div className={`rounded-xl p-4 border ${
                selectedCustomer.outstanding_balance_ugx > 0
                  ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Outstanding Balance</p>
                    <p className={`text-2xl font-black ${
                      selectedCustomer.outstanding_balance_ugx > 0 ? "text-amber-700" : "text-green-600"}`}>
                      {formatUGX(selectedCustomer.outstanding_balance_ugx)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Credit Limit</p>
                    <p className="font-bold text-gray-700">{formatUGX(selectedCustomer.credit_limit_ugx)}</p>
                  </div>
                </div>
                {amountUGX && (
                  <p className="text-xs text-gray-500 mt-2">
                    Balance after payment:{" "}
                    <span className="font-semibold text-gray-700">
                      {formatUGX(Math.max(0, selectedCustomer.outstanding_balance_ugx - parseFloat(amountUGX || "0")))}
                    </span>
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="form-label">Station *</label>
              <select className="form-select" value={stationId}
                onChange={(e) => setStationId(e.target.value)} required>
                <option value="">Select...</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Payment Date *</label>
              <input type="date" className="form-input" value={paymentDate}
                onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Amount Paid (UGX) *</label>
              <input type="number" step="0.01" className="form-input text-xl font-bold py-3"
                placeholder="0.00" value={amountUGX}
                onChange={(e) => setAmountUGX(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Payment Method *</label>
              <select className="form-select" value={paymentMethod} onChange={(e) => setMethod(e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div>
              <label className="form-label">Reference (Bank Ref / Cheque No.)</label>
              <input type="text" className="form-input font-mono"
                value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Entered By</label>
              <input type="text" className="form-input"
                value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2}
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}
            <div className="flex justify-end gap-3">
              <Link href="/credit" className="btn-secondary">Cancel</Link>
              <button type="submit" className="btn-primary px-8" disabled={saving}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Recording...</> : "Record Payment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}