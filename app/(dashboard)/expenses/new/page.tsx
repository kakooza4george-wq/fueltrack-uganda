"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today } from "@/utils";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";

const GROUPED_CATEGORIES = {
  "HR & Tax": [
    { value: "salaries",         label: "Staff Salaries" },
    { value: "nssf",             label: "NSSF Contributions" },
    { value: "paye",             label: "PAYE (URA)" },
    { value: "withholding_tax",  label: "Withholding Tax (URA)" },
    { value: "income_tax",       label: "Income Tax (URA)" },
  ],
  "Fixed Monthly Costs": [
    { value: "rent",             label: "Site Rent / Lease" },
    { value: "electricity",      label: "Electricity (UMEME)" },
    { value: "water",            label: "Water (NWSC)" },
    { value: "internet_airtime", label: "Internet & Airtime" },
    { value: "security",         label: "Security Services" },
    { value: "insurance",        label: "Insurance" },
  ],
  "Operations": [
    { value: "generator_fuel",   label: "Generator Fuel" },
    { value: "maintenance_pumps",label: "Pump Maintenance & Repair" },
    { value: "maintenance_other",label: "Other Maintenance / Repairs" },
  ],
  "Stock Purchases": [
    { value: "lubricant_purchase",label: "Lubricant Purchase (for resale)" },
    { value: "shop_stock",        label: "Shop / Convenience Items" },
    { value: "car_wash_supplies", label: "Car Wash Supplies" },
  ],
  "Admin & Compliance": [
    { value: "uniforms",          label: "Staff Uniforms" },
    { value: "stationery",        label: "Stationery & EFD Receipt Rolls" },
    { value: "banking_charges",   label: "Banking & MoMo Charges" },
    { value: "licence_fees",      label: "Licence Fees (Trading / UNBS / PSD)" },
    { value: "transport",         label: "Transport" },
    { value: "cleaning",          label: "Cleaning Supplies" },
    { value: "advertising",       label: "Advertising / Marketing" },
  ],
  "Other": [
    { value: "other",             label: "Other" },
  ],
};

export default function NewExpensePage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [addAnother, setAddAnother] = useState(false);

  const [stationId, setStationId]       = useState(activeStation?.id ?? "");
  const [expenseDate, setExpenseDate]   = useState(today());
  const [category, setCategory]         = useState("");
  const [subDesc, setSubDesc]           = useState("");
  const [amountUGX, setAmountUGX]       = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [payee, setPayee]               = useState("");
  const [receiptRef, setReceiptRef]     = useState("");
  const [enteredBy, setEnteredBy]       = useState("");
  const [approvedBy, setApprovedBy]     = useState("");
  const [notes, setNotes]               = useState("");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  const resetForm = () => {
    setCategory(""); setSubDesc(""); setAmountUGX("");
    setPayee(""); setReceiptRef(""); setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    const supabase = createClient();

    const { error: err } = await supabase.from("expenses").insert({
      station_id: stationId,
      expense_date: expenseDate,
      category,
      sub_description: subDesc || null,
      amount_ugx: parseFloat(amountUGX),
      payment_method: paymentMethod as any,
      payee: payee || null,
      receipt_reference: receiptRef || null,
      entered_by: enteredBy || null,
      approved_by: approvedBy || null,
      notes: notes || null,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);

    if (addAnother) {
      setSaved(true); resetForm();
      setTimeout(() => setSaved(false), 2000);
    } else {
      router.push("/expenses");
    }
  };

  return (
    <>
      <Header title="Add Expense" />
      <div className="p-6 max-w-xl mx-auto space-y-5">
        <Link href="/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Expenses
        </Link>

        {saved && (
          <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 flex items-center gap-2 text-green-700 font-semibold">
            <CheckCircle size={18} /> Expense saved — form ready for next entry
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-800 text-lg">Expense Details</h2>
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
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)} required />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Category *</label>
                <select className="form-select" value={category}
                  onChange={(e) => setCategory(e.target.value)} required>
                  <option value="">Select category...</option>
                  {Object.entries(GROUPED_CATEGORIES).map(([group, cats]) => (
                    <optgroup key={group} label={group}>
                      {cats.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Description</label>
                <input type="text" className="form-input"
                  placeholder="More detail about this expense"
                  value={subDesc} onChange={(e) => setSubDesc(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Amount (UGX) *</label>
                <input type="number" step="0.01" className="form-input text-lg font-bold"
                  placeholder="0.00" value={amountUGX}
                  onChange={(e) => setAmountUGX(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="form-label">Paid To (Payee)</label>
                <input type="text" className="form-input"
                  placeholder="Name of person or company paid"
                  value={payee} onChange={(e) => setPayee(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Receipt / Invoice #</label>
                <input type="text" className="form-input font-mono"
                  value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input"
                  value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Approved By</label>
                <input type="text" className="form-input"
                  value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="rounded" checked={addAnother}
                onChange={(e) => setAddAnother(e.target.checked)} />
              Save and add another
            </label>
            <div className="flex gap-3">
              <Link href="/expenses" className="btn-secondary">Cancel</Link>
              <button type="submit" className="btn-primary px-8" disabled={saving}>
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : "Save Expense"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}