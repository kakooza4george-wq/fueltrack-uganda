"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatDate, today } from "@/utils";
import {
  Building2, CheckCircle, Loader2, AlertTriangle,
  Plus, ChevronDown, ChevronUp, FileSpreadsheet, FileText
} from "lucide-react";

interface LedgerEntry {
  txn_date: string;
  omc_id: string;
  omc_name: string;
  station_id: string;
  station_name: string;
  reference: string;
  description: string;
  debit_ugx: number;
  credit_ugx: number;
  entry_type: string;
  running_balance_ugx: number;
}

interface OmcBalance {
  omc_id: string;
  omc_name: string;
  station_id: string;
  station_name: string;
  total_deliveries: number;
  total_payments: number;
  current_balance_ugx: number;
}

export default function SuppliersPage() {
  const { activeStation, stations } = useStation();
  const [balances, setBalances]     = useState<OmcBalance[]>([]);
  const [ledger, setLedger]         = useState<LedgerEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [tab, setTab]               = useState<"balances" | "pay">("balances");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");
  const [omcs, setOmcs]             = useState<any[]>([]);
  const [exporting, setExporting]   = useState<"pdf" | "excel" | null>(null);

  // Filter state for ledger
  const [filterOmc, setFilterOmc]       = useState("");
  const [filterStation, setFilterStation] = useState("");

  // Payment form
  const [omcId, setOmcId]         = useState("");
  const [stationId, setStationId] = useState(activeStation?.id ?? "");
  const [paymentDate, setDate]    = useState(today());
  const [amountUGX, setAmountUGX] = useState("");
  const [method, setMethod]       = useState("bank_transfer");
  const [bankRef, setBankRef]     = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [notes, setNotes]         = useState("");

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [balRes, omcRes] = await Promise.all([
      supabase.from("vw_omc_account_balance").select("*").order("current_balance_ugx", { ascending: false }),
      supabase.from("omcs").select("*").eq("is_active", true).order("brand_name"),
    ]);
    if (balRes.data) setBalances(balRes.data as OmcBalance[]);
    if (omcRes.data) setOmcs(omcRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const loadLedger = async (oId: string, sId: string) => {
    setLedgerLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("vw_supplier_ledger")
      .select("*")
      .eq("omc_id", oId)
      .eq("station_id", sId)
      .order("sort_ts");
    if (data) setLedger(data as LedgerEntry[]);
    setLedgerLoading(false);
  };

  const toggleExpand = async (key: string, oId: string, sId: string) => {
    if (expanded === key) { setExpanded(null); setLedger([]); return; }
    setExpanded(key);
    setFilterOmc(oId);
    setFilterStation(sId);
    await loadLedger(oId, sId);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!omcId)    { setError("Select an OMC supplier."); return; }
    if (!stationId){ setError("Select a station."); return; }
    if (!amountUGX || parseFloat(amountUGX) <= 0) {
      setError("Enter a valid amount."); return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("omc_payments").insert({
      omc_id: omcId, station_id: stationId,
      payment_date: paymentDate, amount_ugx: parseFloat(amountUGX),
      payment_method: method, bank_reference: bankRef || null,
      entered_by: enteredBy || null, notes: notes || null,
    });
    if (err) { setError(`Save failed: ${err.message}`); setSaving(false); return; }
    setSaving(false); setSaved(true);
    setAmountUGX(""); setBankRef(""); setNotes("");
    loadData();
    if (filterOmc && filterStation) await loadLedger(filterOmc, filterStation);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalOwed = balances.reduce((s, b) => s + (b.current_balance_ugx ?? 0), 0);

  // ── EXCEL EXPORT ────────────────────────────────────
  const exportExcel = async () => {
    if (!ledger.length) return;
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const omc  = ledger[0]?.omc_name ?? "OMC";
      const sta  = ledger[0]?.station_name ?? "Station";

      // Ledger sheet
      const rows = [
        [`Supplier Ledger — ${omc} at ${sta}`],
        [`Generated: ${new Date().toLocaleString("en-UG")}`],
        [],
        ["Date", "Reference", "Description", "Debit (UGX)", "Credit (UGX)", "Running Balance (UGX)"],
        ...ledger.map((e) => [
          e.txn_date,
          e.reference,
          e.description,
          e.debit_ugx > 0 ? e.debit_ugx : "",
          e.credit_ugx > 0 ? e.credit_ugx : "",
          e.running_balance_ugx,
        ]),
        [],
        ["CLOSING BALANCE", "", "", "", "", ledger[ledger.length - 1]?.running_balance_ugx ?? 0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, { wch: 18 }, { wch: 45 },
        { wch: 18 }, { wch: 18 }, { wch: 22 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Supplier Ledger");

      // Summary sheet
      const summaryRows = [
        ["Supplier Account Summary"],
        [],
        ["OMC", "Station", "Total Deliveries", "Total Payments", "Balance Owed"],
        ...balances.map((b) => [
          b.omc_name, b.station_name,
          b.total_deliveries, b.total_payments, b.current_balance_ugx,
        ]),
        [],
        ["TOTAL OWED", "", "", "", totalOwed],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
      ws2["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Account Summary");

      XLSX.writeFile(wb, `FuelTrack_Supplier_Ledger_${omc}_${today()}.xlsx`);
    } finally { setExporting(null); }
  };

  // ── PDF EXPORT ──────────────────────────────────────
  const exportPDF = async () => {
    if (!ledger.length) return;
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const omc = ledger[0]?.omc_name ?? "OMC";
      const sta = ledger[0]?.station_name ?? "Station";
      const closing = ledger[ledger.length - 1]?.running_balance_ugx ?? 0;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(16);
      doc.setTextColor(29, 78, 216);
      doc.text("FuelTrack Uganda — Supplier Ledger", 14, 16);

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`OMC: ${omc}   |   Station: ${sta}`, 14, 24);
      doc.text(`Generated: ${new Date().toLocaleString("en-UG")}`, 14, 30);

      // Summary boxes
      const totalDel = balances.find((b) => b.omc_id === filterOmc && b.station_id === filterStation)?.total_deliveries ?? 0;
      const totalPay = balances.find((b) => b.omc_id === filterOmc && b.station_id === filterStation)?.total_payments ?? 0;

      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(`Total Deliveries (Debit): ${formatUGX(totalDel)}`, 14, 40);
      doc.text(`Total Payments (Credit): ${formatUGX(totalPay)}`, 90, 40);
      doc.text(`Closing Balance: ${formatUGX(closing)}`, 180, 40);

      // Ledger table
      autoTable(doc, {
        startY: 46,
        head: [["Date", "Reference", "Description", "Debit (UGX)", "Credit (UGX)", "Balance (UGX)"]],
        body: ledger.map((e) => [
          formatDate(e.txn_date),
          e.reference,
          e.description,
          e.debit_ugx  > 0 ? formatUGX(e.debit_ugx)  : "—",
          e.credit_ugx > 0 ? formatUGX(e.credit_ugx) : "—",
          formatUGX(e.running_balance_ugx),
        ]),
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 75 },
          3: { halign: "right", cellWidth: 32 },
          4: { halign: "right", cellWidth: 32 },
          5: { halign: "right", cellWidth: 32, fontStyle: "bold" },
        },
        didParseCell: (data) => {
          // Colour debit rows red, credit rows green
          if (data.section === "body") {
            const entry = ledger[data.row.index];
            if (entry?.entry_type === "delivery" && data.column.index === 3) {
              data.cell.styles.textColor = [220, 38, 38];
            }
            if (entry?.entry_type === "payment" && data.column.index === 4) {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        },
      });

      // Closing balance row
      const finalY = (doc as any).lastAutoTable.finalY + 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, finalY, 267, 8, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("CLOSING BALANCE", 16, finalY + 5.5);
      doc.text(
        formatUGX(closing),
        doc.internal.pageSize.getWidth() - 16,
        finalY + 5.5,
        { align: "right" }
      );

      // Page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `FuelTrack Uganda — Supplier Ledger — Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: "center" }
        );
      }

      doc.save(`FuelTrack_Supplier_Ledger_${omc}_${today()}.pdf`);
    } finally { setExporting(null); }
  };

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
                ${tab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── BALANCES & LEDGER TAB ── */}
        {tab === "balances" && (
          <div className="space-y-4">

            {!loading && totalOwed > 0 && (
              <div className="card p-4 flex items-center justify-between bg-red-50 border border-red-200">
                <div>
                  <p className="text-sm text-gray-500">Total Outstanding to All OMCs</p>
                  <p className="text-3xl font-black text-red-600">{formatUGX(totalOwed)}</p>
                </div>
                <p className="text-xs text-red-400 max-w-[200px] text-right">
                  Deliveries received but not yet paid for
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
              Click any row to expand the full debit / credit ledger with running balance.
              Every confirmed delivery creates a debit. Every payment creates a credit.
            </div>

            {loading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : balances.length === 0 ? (
              <div className="card p-12 text-center">
                <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No OMC balances yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Confirm a fuel delivery to see the balance owed to that OMC.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => {
                  const key = `${b.omc_id}-${b.station_id}`;
                  const isExpanded = expanded === key;
                  const closingBal = ledger.length > 0 && isExpanded
                    ? ledger[ledger.length - 1].running_balance_ugx
                    : b.current_balance_ugx;

                  return (
                    <div key={key} className="card overflow-hidden">
                      {/* Summary row */}
                      <button
                        onClick={() => toggleExpand(key, b.omc_id, b.station_id)}
                        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left transition-colors">
                        <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 size={20} className="text-blue-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-base">{b.omc_name}</p>
                          <p className="text-sm text-gray-500">{b.station_name}</p>
                        </div>
                        {/* Three columns: debits, credits, balance */}
                        <div className="hidden md:flex gap-6 text-right mr-4">
                          <div>
                            <p className="text-xs text-gray-400">Total Deliveries</p>
                            <p className="font-semibold text-red-600">{formatUGX(b.total_deliveries)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Total Paid</p>
                            <p className="font-semibold text-green-600">{formatUGX(b.total_payments)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Balance Owed</p>
                            <p className={`font-black text-lg ${b.current_balance_ugx > 0 ? "text-red-600" : "text-green-600"}`}>
                              {formatUGX(b.current_balance_ugx)}
                            </p>
                          </div>
                        </div>
                        {/* Mobile: just balance */}
                        <div className="md:hidden text-right mr-2">
                          <p className={`font-black text-lg ${b.current_balance_ugx > 0 ? "text-red-600" : "text-green-600"}`}>
                            {formatUGX(b.current_balance_ugx)}
                          </p>
                          <p className="text-xs text-gray-400">balance owed</p>
                        </div>
                        <div className="text-gray-400 flex-shrink-0">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {/* Full ledger */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {/* Ledger header with export buttons */}
                          <div className="px-5 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                              Full Supplier Ledger — {b.omc_name} / {b.station_name}
                            </p>
                            <div className="flex gap-2">
                              <button onClick={exportExcel} disabled={exporting !== null || ledgerLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                                {exporting === "excel"
                                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Exporting...</>
                                  : <><FileSpreadsheet size={13} /> Excel</>}
                              </button>
                              <button onClick={exportPDF} disabled={exporting !== null || ledgerLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                                {exporting === "pdf"
                                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                                  : <><FileText size={13} /> PDF</>}
                              </button>
                              <button
                                onClick={() => {
                                  setOmcId(b.omc_id);
                                  setStationId(b.station_id);
                                  setTab("pay");
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                <Plus size={12} /> Record Payment
                              </button>
                            </div>
                          </div>

                          {ledgerLoading ? (
                            <div className="p-8 text-center text-gray-400 text-sm">
                              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                              Loading ledger...
                            </div>
                          ) : ledger.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                              No transactions found for this account.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th>Description</th>
                                    <th className="text-right text-red-600">Debit (UGX)</th>
                                    <th className="text-right text-green-600">Credit (UGX)</th>
                                    <th className="text-right">Running Balance</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ledger.map((entry, idx) => (
                                    <tr key={idx}
                                      className={entry.entry_type === "delivery" ? "bg-red-50/40" : "bg-green-50/40"}>
                                      <td className="whitespace-nowrap font-medium text-sm">
                                        {formatDate(entry.txn_date)}
                                      </td>
                                      <td className="font-mono text-xs text-gray-500">
                                        {entry.reference}
                                      </td>
                                      <td className="text-gray-700 text-xs max-w-[300px]">
                                        <div className="flex items-center gap-2">
                                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                            entry.entry_type === "delivery" ? "bg-red-500" : "bg-green-500"
                                          }`} />
                                          {entry.description}
                                        </div>
                                      </td>
                                      <td className="text-right font-semibold text-red-600">
                                        {entry.debit_ugx > 0 ? formatUGX(entry.debit_ugx) : "—"}
                                      </td>
                                      <td className="text-right font-semibold text-green-600">
                                        {entry.credit_ugx > 0 ? formatUGX(entry.credit_ugx) : "—"}
                                      </td>
                                      <td className={`text-right font-black ${
                                        entry.running_balance_ugx > 0 ? "text-red-700" : "text-green-700"
                                      }`}>
                                        {formatUGX(entry.running_balance_ugx)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                                    <td colSpan={3} className="px-4 py-3 font-black text-gray-700 text-sm">
                                      CLOSING BALANCE
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-red-600">
                                      {formatUGX(ledger.reduce((s, e) => s + e.debit_ugx, 0))}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-green-600">
                                      {formatUGX(ledger.reduce((s, e) => s + e.credit_ugx, 0))}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-black text-lg ${
                                      ledger[ledger.length - 1]?.running_balance_ugx > 0
                                        ? "text-red-700" : "text-green-700"
                                    }`}>
                                      {formatUGX(ledger[ledger.length - 1]?.running_balance_ugx ?? 0)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
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
                  Record a payment made to your fuel supplier. This creates a credit
                  entry in the supplier ledger and reduces the outstanding balance.
                </p>
              </div>
              <form onSubmit={handlePayment} className="space-y-3">
                <div>
                  <label className="form-label">OMC Supplier *</label>
                  <select className="form-select" value={omcId}
                    onChange={(e) => setOmcId(e.target.value)} required>
                    <option value="">Select OMC...</option>
                    {omcs.map((o) => (
                      <option key={o.id} value={o.id}>{o.brand_name ?? o.name}</option>
                    ))}
                  </select>
                  {omcId && (
                    <p className="text-xs text-amber-600 mt-1">
                      Balance owed:{" "}
                      <span className="font-bold">
                        {formatUGX(
                          balances.filter((b) => b.omc_id === omcId)
                            .reduce((s, b) => s + b.current_balance_ugx, 0)
                        )}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label">Station *</label>
                  <select className="form-select" value={stationId}
                    onChange={(e) => setStationId(e.target.value)} required>
                    <option value="">Select...</option>
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
                  <input type="number" step="0.01" className="form-input text-lg font-bold"
                    placeholder="0.00" value={amountUGX}
                    onChange={(e) => setAmountUGX(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">Payment Method *</label>
                  <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Reference Number</label>
                  <input type="text" className="form-input font-mono"
                    placeholder="Bank ref / cheque number"
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
                    value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex gap-2">
                    <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setTab("balances")} className="btn-secondary flex-1 justify-center">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                    {saved
                      ? <><CheckCircle size={16} /> Recorded!</>
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