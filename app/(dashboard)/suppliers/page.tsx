"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatDate, today } from "@/utils";
import {
  Building2, CheckCircle, Loader2, AlertTriangle,
  Plus, ChevronDown, ChevronUp, TrendingDown
} from "lucide-react";

interface OmcBalance {
  omc_id: string;
  omc_name: string;
  station_id: string;
  station_name: string;
  total_deliveries: number;
  total_payments: number;
  current_balance_ugx: number;
}

interface OmcPayment {
  id: string;
  payment_date: string;
  payment_method: string;
  bank_reference: string | null;
  amount_ugx: number;
  entered_by: string | null;
  notes: string | null;
}

export default function SuppliersPage() {
  const { activeStation, stations } = useStation();
  const [balances, setBalances] = useState<OmcBalance[]>([]);
  const [payments, setPayments] = useState<OmcPayment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab]           = useState<"balances" | "pay">("balances");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [omcs, setOmcs]         = useState<any[]>([]);

  // Payment form fields
  const [omcId, setOmcId]         = useState("");
  const [stationId, setStationId] = useState(activeStation?.id ?? "");
  const [paymentDate, setDate]    = useState(today());
  const [amountUGX, setAmountUGX] = useState("");
  const [method, setMethod]       = useState("bank_transfer");
  const [bankRef, setBankRef]     = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [notes, setNotes]         = useState("");

  useEffect(() => {
    if (activeStation) setStationId(activeStation.id);
  }, [activeStation]);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [balRes, omcRes] = await Promise.all([
      supabase
        .from("vw_omc_account_balance")
        .select("*")
        .order("current_balance_ugx", { ascending: false }),
      supabase
        .from("omcs")
        .select("*")
        .eq("is_active", true)
        .order("brand_name"),
    ]);
    if (balRes.data) setBalances(balRes.data as OmcBalance[]);
    if (omcRes.data) setOmcs(omcRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const toggleExpand = async (key: string, oId: string, sId: string) => {
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    const supabase = createClient();
    const { data } = await supabase
      .from("omc_payments")
      .select("*")
      .eq("omc_id", oId)
      .eq("station_id", sId)
      .order("payment_date", { ascending: false })
      .limit(20);
    if (data) setPayments(data as OmcPayment[]);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!omcId)      { setError("Select an OMC supplier.");       return; }
    if (!stationId)  { setError("Select a station.");              return; }
    if (!amountUGX || parseFloat(amountUGX) <= 0) {
      setError("Enter a valid amount greater than zero."); return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: err } = await supabase.from("omc_payments").insert({
      omc_id:          omcId,
      station_id:      stationId,
      payment_date:    paymentDate,
      amount_ugx:      parseFloat(amountUGX),
      payment_method:  method,
      bank_reference:  bankRef || null,
      entered_by:      enteredBy || null,
      notes:           notes || null,
    });

    if (err) {
      setError(`Save failed: ${err.message}`);
      setSaving(false);
      return;
    }

    setSaving(false); setSaved(true);
    setAmountUGX(""); setBankRef(""); setNotes("");
    loadData();
    setTimeout(() => setSaved(false), 2000);
  };

  const totalOwed = balances.reduce((s, b) => s + (b.current_balance_ugx ?? 0), 0);

  return (
    <>
      <Header title="Suppliers (OMCs)" />
      <div className="p-6 space-y-5">

        <div className="flex gap-1 border-b border-gray-200">
          {[
            { id: "balances", label: "Account Balances & Ledger" },
            { id: "pay",      label: "Record Payment to OMC" },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id as "balances" | "pay"); setError(""); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${tab === t.id
                  ? "border-blue-700 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── BALANCES TAB ── */}
        {tab === "balances" && (
          <div className="space-y-4">

            {/* Total owed banner */}
            {!loading && totalOwed > 0 && (
              <div className="card p-4 flex items-center justify-between bg-red-50 border border-red-200">
                <div>
                  <p className="text-sm text-gray-500">Total Outstanding to All OMCs</p>
                  <p className="text-3xl font-black text-red-600">{formatUGX(totalOwed)}</p>
                </div>
                <TrendingDown size={40} className="text-red-200" />
              </div>
            )}

            {/* How it works info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
              Every confirmed fuel delivery adds to the amount you owe the OMC.
              Recording a payment reduces it. Balance = Deliveries received − Payments made.
            </div>

            {loading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : balances.length === 0 ? (
              <div className="card p-12 text-center">
                <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No OMC balances yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Record and confirm a fuel delivery to see the balance owed to that OMC here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => {
                  const key = `${b.omc_id}-${b.station_id}`;
                  const isExpanded = expanded === key;
                  return (
                    <div key={key} className="card overflow-hidden">
                      {/* Header row */}
                      <button
                        onClick={() => toggleExpand(key, b.omc_id, b.station_id)}
                        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left transition-colors">
                        <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 size={20} className="text-blue-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800">{b.omc_name}</p>
                          <p className="text-sm text-gray-500">{b.station_name}</p>
                        </div>
                        <div className="text-right mr-2">
                          <p className={`text-xl font-black ${
                            b.current_balance_ugx > 0 ? "text-red-600" : "text-green-600"}`}>
                            {formatUGX(b.current_balance_ugx)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {b.current_balance_ugx > 0 ? "Outstanding balance" : "Fully settled"}
                          </p>
                        </div>
                        <div>
                          {/* Mini breakdown */}
                          <div className="text-right text-xs text-gray-400 hidden sm:block">
                            <p>Deliveries: {formatUGX(b.total_deliveries)}</p>
                            <p>Paid: {formatUGX(b.total_payments)}</p>
                          </div>
                        </div>
                        <div className="text-gray-400 ml-2 flex-shrink-0">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {/* Expanded payment history */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          <div className="px-5 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Payment History
                          </div>
                          {payments.length === 0 ? (
                            <div className="p-5 text-center text-gray-400 text-sm">
                              No payments recorded yet for this OMC at this station
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Method</th>
                                    <th>Reference</th>
                                    <th className="text-right">Amount</th>
                                    <th>By</th>
                                    <th>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payments.map((p) => (
                                    <tr key={p.id}>
                                      <td className="whitespace-nowrap font-medium">
                                        {formatDate(p.payment_date)}
                                      </td>
                                      <td className="capitalize text-gray-600 text-sm">
                                        {p.payment_method?.replace("_", " ") ?? "—"}
                                      </td>
                                      <td className="font-mono text-xs text-gray-500">
                                        {p.bank_reference ?? "—"}
                                      </td>
                                      <td className="text-right font-bold text-green-700">
                                        {formatUGX(p.amount_ugx)}
                                      </td>
                                      <td className="text-gray-400 text-xs">
                                        {p.entered_by ?? "—"}
                                      </td>
                                      <td className="text-gray-400 text-xs max-w-[120px] truncate">
                                        {p.notes ?? "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                            <button
                              onClick={() => {
                                setOmcId(b.omc_id);
                                setStationId(b.station_id);
                                setTab("pay");
                              }}
                              className="btn-primary btn-sm">
                              <Plus size={14} /> Record Payment to {b.omc_name}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PAY TAB ── */}
        {tab === "pay" && (
          <div className="max-w-lg">
            <div className="card p-5 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Record Payment to OMC</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Record a bank transfer, cheque, or cash payment made to your fuel supplier.
                  This reduces the outstanding balance owed.
                </p>
              </div>

              <form onSubmit={handlePayment} className="space-y-3">
                <div>
                  <label className="form-label">OMC Supplier *</label>
                  <select className="form-select" value={omcId}
                    onChange={(e) => setOmcId(e.target.value)} required>
                    <option value="">Select OMC...</option>
                    {omcs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.brand_name ?? o.name}
                      </option>
                    ))}
                  </select>
                  {omcId && balances.find((b) => b.omc_id === omcId) && (
                    <p className="text-xs text-amber-600 mt-1">
                      Current balance owed:{" "}
                      <span className="font-bold">
                        {formatUGX(
                          balances
                            .filter((b) => b.omc_id === omcId)
                            .reduce((s, b) => s + b.current_balance_ugx, 0)
                        )}
                      </span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="form-label">Station Making Payment *</label>
                  <select className="form-select" value={stationId}
                    onChange={(e) => setStationId(e.target.value)} required>
                    <option value="">Select station...</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Payment Date *</label>
                  <input type="date" className="form-input" value={paymentDate}
                    onChange={(e) => setDate(e.target.value)} required />
                </div>

                <div>
                  <label className="form-label">Amount (UGX) *</label>
                  <input
                    type="number" step="0.01" className="form-input text-lg font-bold"
                    placeholder="0.00" value={amountUGX}
                    onChange={(e) => setAmountUGX(e.target.value)} required />
                </div>

                <div>
                  <label className="form-label">Payment Method *</label>
                  <select className="form-select" value={method}
                    onChange={(e) => setMethod(e.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">
                    {method === "cheque" ? "Cheque Number" :
                     method === "bank_transfer" ? "Bank Transaction Reference" :
                     "Reference Number"}
                  </label>
                  <input type="text" className="form-input font-mono"
                    placeholder="Transaction reference"
                    value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Entered By</label>
                  <input type="text" className="form-input"
                    value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows={2}
                    placeholder="Any additional notes..."
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTab("balances")}
                    className="btn-secondary flex-1 justify-center">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 justify-center"
                    disabled={saving}>
                    {saved
                      ? <><CheckCircle size={16} /> Payment Recorded!</>
                      : saving
                      ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                      : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}