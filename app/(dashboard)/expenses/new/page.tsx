"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { today } from "@/utils";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface ExpenseForm {
  station_id: string;
  expense_date: string;
  category: string;
  sub_description: string;
  amount_ugx: string;
  payment_method: string;
  payee: string;
  receipt_reference: string;
  entered_by: string;
  approved_by: string;
  notes: string;
}

const GROUPED_CATEGORIES = {
  "HR & Tax": [
    { value: "salaries", label: "Staff Salaries" },
    { value: "nssf", label: "NSSF Contributions" },
    { value: "paye", label: "PAYE (URA)" },
    { value: "withholding_tax", label: "Withholding Tax (URA)" },
    { value: "income_tax", label: "Income Tax (URA)" },
  ],
  "Fixed Costs": [
    { value: "rent", label: "Site Rent / Lease" },
    { value: "electricity", label: "Electricity (UMEME)" },
    { value: "water", label: "Water (NWSC)" },
    { value: "internet_airtime", label: "Internet & Airtime" },
    { value: "security", label: "Security Services" },
    { value: "insurance", label: "Insurance" },
  ],
  "Operations": [
    { value: "generator_fuel", label: "Generator Fuel" },
    { value: "maintenance_pumps", label: "Pump Maintenance & Repair" },
    { value: "maintenance_other", label: "Other Maintenance" },
  ],
  "Stock": [
    { value: "lubricant_purchase", label: "Lubricant Purchase (for resale)" },
    { value: "shop_stock", label: "Shop / Mini-Mart Stock" },
    { value: "car_wash_supplies", label: "Car Wash Supplies" },
  ],
  "Admin": [
    { value: "uniforms", label: "Staff Uniforms" },
    { value: "stationery", label: "Stationery & EFD Rolls" },
    { value: "banking_charges", label: "Banking & MoMo Charges" },
    { value: "licence_fees", label: "Licence Fees (Trading / UNBS / PSD)" },
    { value: "transport", label: "Transport" },
    { value: "cleaning", label: "Cleaning Supplies" },
    { value: "advertising", label: "Advertising / Marketing" },
  ],
  "Other": [{ value: "other", label: "Other" }],
};

export default function NewExpensePage() {
  const router = useRouter();
  const { stations, activeStation } = useStation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue } = useForm<ExpenseForm>({
    defaultValues: {
      station_id: activeStation?.id ?? "",
      expense_date: today(),
      payment_method: "cash",
    },
  });

  useEffect(() => {
    if (activeStation) setValue("station_id", activeStation.id);
  }, [activeStation, setValue]);

  const onSubmit = async (data: ExpenseForm) => {
    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      const { error: err } = await supabase.from("expenses").insert({
        station_id: data.station_id,
        expense_date: data.expense_date,
        category: data.category,
        sub_description: data.sub_description || null,
        amount_ugx: parseFloat(data.amount_ugx),
        payment_method: data.payment_method || "cash",
        payee: data.payee || null,
        receipt_reference: data.receipt_reference || null,
        entered_by: data.entered_by || null,
        approved_by: data.approved_by || null,
        notes: data.notes || null,
      });

      if (err) {
        console.error("Supabase error:", err);
        setError(err.message);
        setSaving(false);
        return;
      }

      // Successful save
      router.push("/expenses");
      router.refresh(); // Ensure the list page gets fresh data
    } catch (e: any) {
      console.error("Catch error:", e);
      setError(e.message || "An unexpected error occurred");
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Add Expense" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Link href="/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Back to Expenses
        </Link>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 text-lg">Expense Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input type="date" className="form-input" {...register("expense_date", { required: true })} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Category *</label>
                <select className="form-select" {...register("category", { required: true })}>
                  <option value="">Select category...</option>
                  {Object.entries(GROUPED_CATEGORIES).map(([group, cats]) => (
                    <optgroup key={group} label={group}>
                      {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Description / Details</label>
                <input type="text" className="form-input" placeholder="e.g. June electricity bill"
                  {...register("sub_description")} />
              </div>
              <div>
                <label className="form-label">Amount (UGX) *</label>
                <input type="number" step="1" className="form-input font-bold" placeholder="0"
                  {...register("amount_ugx", { required: true })} />
              </div>
              <div>
                <label className="form-label">Payment Method</label>
                <select className="form-select" {...register("payment_method")}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="form-label">Payee (Who was paid)</label>
                <input type="text" className="form-input" placeholder="e.g. UMEME" {...register("payee")} />
              </div>
              <div>
                <label className="form-label">Receipt / Invoice #</label>
                <input type="text" className="form-input" placeholder="e.g. REC-12345" {...register("receipt_reference")} />
              </div>
              <div>
                <label className="form-label">Entered By</label>
                <input type="text" className="form-input" placeholder="Your name" {...register("entered_by")} />
              </div>
              <div>
                <label className="form-label">Approved By</label>
                <input type="text" className="form-input" placeholder="Manager name" {...register("approved_by")} />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Internal Notes</label>
                <textarea className="form-textarea" rows={2} placeholder="Any extra details..." {...register("notes")} />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/expenses" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <><Loader2 size={18} className="animate-spin mr-2" /> Saving...</>
              ) : (
                "Save Expense"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}