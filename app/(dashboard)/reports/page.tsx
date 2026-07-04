"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatLitres, formatDate, paymentLabel, today } from "@/utils";
import {
  FileSpreadsheet, FileText, ShoppingCart,
  Receipt, Building2, Clock, Users, Package, TrendingUp
} from "lucide-react";

type ReportTab =
  | "sales"
  | "expenses"
  | "suppliers"
  | "shifts"
  | "credit"
  | "stock"
  | "financial";

const TABS: { id: ReportTab; label: string; icon: any }[] = [
  { id: "sales",      label: "Sales Report",          icon: ShoppingCart },
  { id: "expenses",   label: "Expenses Report",        icon: Receipt },
  { id: "suppliers",  label: "Supplier Ledger",        icon: Building2 },
  { id: "shifts",     label: "Shift Reconciliation",   icon: Clock },
  { id: "credit",     label: "Debtors / Credit",       icon: Users },
  { id: "stock",      label: "Stock Report",           icon: Package },
  { id: "financial",  label: "Financial Summary",      icon: TrendingUp },
];

export default function ReportsPage() {
  const { activeStation, stations } = useStation();
  const [tab, setTab]           = useState<ReportTab>("sales");
  const [data, setData]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  // Shared filters
  const [from, setFrom]         = useState(today().slice(0, 7) + "-01");
  const [to, setTo]             = useState(today());
  const [stationFilter, setStationFilter] = useState(activeStation?.id ?? "all");

  useEffect(() => {
    if (activeStation && stationFilter === "") setStationFilter(activeStation.id);
  }, [activeStation]);

  // ── LOAD DATA ────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setData([]);
    const supabase = createClient();

    try {
      if (tab === "sales") {
        let q = supabase
          .from("vw_sales_report")
          .select("*")
          .gte("transaction_date", from)
          .lte("transaction_date", to)
          .order("transaction_date", { ascending: false })
          .order("transaction_time", { ascending: false });
        if (stationFilter !== "all") q = q.eq("station_id", stationFilter);
        const { data: d } = await q.limit(1000);
        if (d) setData(d);
      }

      if (tab === "expenses") {
        let q = supabase
          .from("expenses")
          .select("*, station:stations(name)")
          .gte("expense_date", from)
          .lte("expense_date", to)
          .order("expense_date", { ascending: false });
        if (stationFilter !== "all") q = q.eq("station_id", stationFilter);
        const { data: d } = await q.limit(1000);
        if (d) setData(d);
      }

      if (tab === "suppliers") {
        let q = supabase
          .from("vw_supplier_ledger")
          .select("*")
          .gte("txn_date", from)
          .lte("txn_date", to)
          .order("sort_ts");
        if (stationFilter !== "all") q = q.eq("station_id", stationFilter);
        const { data: d } = await q;
        if (d) setData(d);
      }

      if (tab === "shifts") {
        let q = supabase
          .from("vw_reconciliation_report")
          .select("*")
          .gte("shift_date", from)
          .lte("shift_date", to)
          .order("shift_date", { ascending: false });
        if (stationFilter !== "all") q = q.eq("station_id", stationFilter);
        const { data: d } = await q;
        if (d) setData(d);
      }

      if (tab === "credit") {
        const { data: d } = await supabase
          .from("vw_debtors_report")
          .select("*")
          .order("outstanding_balance", { ascending: false });
        if (d) setData(d);
      }

      if (tab === "stock") {
        let q = supabase
          .from("vw_current_stock")
          .select("*")
          .order("station_name")
          .order("product_name");
        if (stationFilter !== "all") q = q.eq("station_id", stationFilter);
        const { data: d } = await q;
        if (d) setData(d);
      }

      if (tab === "financial") {
        // Combine sales and expenses for P&L
        const [salesRes, expRes] = await Promise.all([
          supabase.from("sales_transactions")
            .select("station_id, transaction_date, net_amount_ugx, amount_entered_ugx")
            .gte("transaction_date", from)
            .lte("transaction_date", to),
          supabase.from("expenses")
            .select("station_id, expense_date, amount_ugx, category")
            .gte("expense_date", from)
            .lte("expense_date", to),
        ]);

        // Group by station
        const byStation: Record<string, any> = {};
        (salesRes.data ?? []).forEach((s: any) => {
          if (!byStation[s.station_id]) byStation[s.station_id] = { revenue: 0, expenses: 0 };
          byStation[s.station_id].revenue += s.amount_entered_ugx ?? s.net_amount_ugx ?? 0;
        });
        (expRes.data ?? []).forEach((e: any) => {
          if (!byStation[e.station_id]) byStation[e.station_id] = { revenue: 0, expenses: 0 };
          byStation[e.station_id].expenses += e.amount_ugx ?? 0;
        });

        // Get station names
        const { data: stationData } = await supabase
          .from("stations").select("id, name");
        const stMap: Record<string, string> = {};
        (stationData ?? []).forEach((s: any) => { stMap[s.id] = s.name; });

        const rows = Object.entries(byStation).map(([sid, vals]: any) => ({
          station_id:    sid,
          station_name:  stMap[sid] ?? "Unknown",
          total_revenue: vals.revenue,
          total_expenses: vals.expenses,
          gross_profit:  vals.revenue - vals.expenses,
          margin_pct:    vals.revenue > 0
            ? ((vals.revenue - vals.expenses) / vals.revenue * 100).toFixed(1)
            : "0.0",
        }));
        setData(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, stationFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── EXCEL EXPORT ────────────────────────────────────
  const exportExcel = async () => {
    if (!data.length) return;
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb   = XLSX.utils.book_new();

      let headers: string[] = [];
      let rows: any[][]     = [];
      let sheetName         = "Report";

      if (tab === "sales") {
        sheetName = "Sales Report";
        headers = ["Date", "Time", "Station", "Product", "Shift", "Qty (L)", "Price/L", "Amount (UGX)", "Payment", "EFD #", "Customer", "Vehicle", "Entered By"];
        rows = data.map((r) => [
          r.transaction_date, r.transaction_time ?? "", r.station_name,
          r.product_name, r.shift_type ?? "", r.quantity,
          r.unit_price_ugx,
          r.amount_ugx, paymentLabel(r.payment_type),
          r.efd_receipt_number ?? "", r.credit_customer_name ?? "",
          r.vehicle_reg ?? "", r.entered_by ?? "",
        ]);
        // Totals
        const totalAmt   = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
        const totalLitres = data.filter((r) => r.product_code).reduce((s, r) => s + (r.quantity ?? 0), 0);
        rows.push([]);
        rows.push(["TOTAL", "", "", "", "", totalLitres, "", totalAmt, "", "", "", "", ""]);
      }

      if (tab === "expenses") {
        sheetName = "Expenses Report";
        headers = ["Date", "Station", "Category", "Description", "Payee", "Payment Method", "Receipt #", "Amount (UGX)", "Approved By", "Entered By"];
        rows = data.map((r) => [
          r.expense_date, r.station?.name ?? "", r.category,
          r.sub_description ?? "", r.payee ?? "",
          r.payment_method ?? "", r.receipt_reference ?? "",
          r.amount_ugx, r.approved_by ?? "", r.entered_by ?? "",
        ]);
        const total = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
        rows.push([]);
        rows.push(["TOTAL", "", "", "", "", "", "", total, "", ""]);
      }

      if (tab === "suppliers") {
        sheetName = "Supplier Ledger";
        headers = ["Date", "OMC", "Station", "Reference", "Description", "Debit (UGX)", "Credit (UGX)", "Running Balance (UGX)"];
        rows = data.map((r) => [
          r.txn_date, r.omc_name, r.station_name, r.reference,
          r.description,
          r.debit_ugx  > 0 ? r.debit_ugx  : "",
          r.credit_ugx > 0 ? r.credit_ugx : "",
          r.running_balance_ugx,
        ]);
      }

      if (tab === "shifts") {
        sheetName = "Shift Reconciliation";
        headers = [
          "Date", "Station", "Shift", "Seq", "Supervisor", "Cashier", "Status",
          "Meters (L)", "Sales Recorded (L)", "Litre Variance",
          "Theoretical Sales", "Cash Collected", "MoMo", "Credit", "Fuel Card", "LPO",
          "Total Collected", "Amount Banked", "Bank Ref",
        ];
        rows = data.map((r) => [
          r.shift_date, r.station_name, r.shift_type, r.shift_sequence ?? 1,
          r.supervisor_name ?? "", r.cashier_name ?? "", r.status,
          r.total_litres_from_meters ?? "", r.total_litres_from_sales ?? "",
          r.litres_variance ?? "",
          r.theoretical_sales_ugx ?? "",
          r.cash_collected_ugx ?? "", r.mtn_momo_ugx ?? "",
          r.credit_sales_ugx ?? "", r.fuel_card_ugx ?? "", r.lpo_sales_ugx ?? "",
          r.total_collected_ugx ?? "", r.amount_banked_ugx ?? "",
          r.bank_deposit_reference ?? "",
        ]);
      }

      if (tab === "credit") {
        sheetName = "Debtors Report";
        headers = [
          "Customer", "Contact", "Phone", "Credit Limit", "Total Charged",
          "Total Paid", "Outstanding", "0-30 Days", "31-60 Days", "61-90 Days", "Over 90 Days",
        ];
        rows = data.map((r) => [
          r.customer_name, r.contact_person ?? "", r.phone ?? "",
          r.credit_limit_ugx, r.total_charged, r.total_paid, r.outstanding_balance,
          r.current_0_30, r.days_31_60, r.days_61_90, r.over_90_days,
        ]);
        const totalOutstanding = data.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0);
        rows.push([]);
        rows.push(["TOTAL", "", "", "", "", "", totalOutstanding, "", "", "", ""]);
      }

      if (tab === "stock") {
        sheetName = "Stock Report";
        headers = [
          "Station", "Product", "Code", "Opening Balance (L)",
          "Delivered (L)", "Sold (L)", "Evaporation (L)",
          "Adjustments (L)", "Current Stock (L)",
        ];
        rows = data.map((r) => [
          r.station_name, r.product_name, r.product_code ?? "",
          r.opening_balance_litres, r.total_delivered_litres,
          r.total_sold_litres, r.total_evaporation_litres,
          r.total_adjustments_litres, r.current_stock_litres,
        ]);
      }

      if (tab === "financial") {
        sheetName = "Financial Summary";
        headers = ["Station", "Total Revenue (UGX)", "Total Expenses (UGX)", "Gross Profit (UGX)", "Margin %"];
        rows = data.map((r) => [
          r.station_name, r.total_revenue, r.total_expenses,
          r.gross_profit, `${r.margin_pct}%`,
        ]);
        const totRev = data.reduce((s, r) => s + r.total_revenue, 0);
        const totExp = data.reduce((s, r) => s + r.total_expenses, 0);
        rows.push([]);
        rows.push(["TOTAL", totRev, totExp, totRev - totExp, ""]);
      }

      const ws = XLSX.utils.aoa_to_sheet([
        [`FuelTrack Uganda — ${TABS.find((t) => t.id === tab)?.label}`],
        [`Period: ${from} to ${to}`],
        [`Generated: ${new Date().toLocaleString("en-UG")}`],
        [],
        headers,
        ...rows,
      ]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `FuelTrack_${sheetName.replace(/ /g, "_")}_${from}_to_${to}.xlsx`);
    } finally { setExporting(null); }
  };

  // ── PDF EXPORT ──────────────────────────────────────
  const exportPDF = async () => {
    if (!data.length) return;
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const reportLabel = TABS.find((t) => t.id === tab)?.label ?? "Report";
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFontSize(16);
      doc.setTextColor(29, 78, 216);
      doc.text(`FuelTrack Uganda — ${reportLabel}`, 14, 16);

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Period: ${from} to ${to}   |   Generated: ${new Date().toLocaleString("en-UG")}`, 14, 23);

      let head: string[][] = [];
      let body: any[][]    = [];

      if (tab === "sales") {
        head = [["Date", "Station", "Product", "Qty (L)", "Amount (UGX)", "Payment", "EFD #", "By"]];
        body = data.map((r) => [
          r.transaction_date, r.station_name, r.product_name,
          formatLitres(r.quantity),
          formatUGX(r.amount_ugx),
          paymentLabel(r.payment_type),
          r.efd_receipt_number ?? "—", r.entered_by ?? "—",
        ]);
        const totalAmt = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
        const totalL   = data.filter((r) => r.product_code).reduce((s, r) => s + (r.quantity ?? 0), 0);
        body.push(["TOTAL", "", "", formatLitres(totalL), formatUGX(totalAmt), "", "", ""]);
      }

      if (tab === "expenses") {
        head = [["Date", "Station", "Category", "Description", "Payee", "Amount (UGX)"]];
        body = data.map((r) => [
          r.expense_date, r.station?.name ?? "", r.category,
          r.sub_description ?? "—", r.payee ?? "—", formatUGX(r.amount_ugx),
        ]);
        const total = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
        body.push(["TOTAL", "", "", "", "", formatUGX(total)]);
      }

      if (tab === "suppliers") {
        head = [["Date", "OMC", "Station", "Description", "Debit", "Credit", "Balance"]];
        body = data.map((r) => [
          formatDate(r.txn_date), r.omc_name, r.station_name,
          r.description,
          r.debit_ugx  > 0 ? formatUGX(r.debit_ugx)  : "—",
          r.credit_ugx > 0 ? formatUGX(r.credit_ugx) : "—",
          formatUGX(r.running_balance_ugx),
        ]);
      }

      if (tab === "shifts") {
        head = [["Date", "Station", "Shift", "Supervisor", "Status", "Meters (L)", "Sales (L)", "Variance", "Theoretical", "Collected"]];
        body = data.map((r) => [
          r.shift_date, r.station_name,
          `${r.shift_type} ${r.shift_sequence > 1 ? `#${r.shift_sequence}` : ""}`.trim(),
          r.supervisor_name ?? "—", r.status,
          formatLitres(r.total_litres_from_meters ?? 0),
          formatLitres(r.total_litres_from_sales ?? 0),
          formatLitres(r.litres_variance ?? 0),
          formatUGX(r.theoretical_sales_ugx ?? 0),
          formatUGX(r.total_collected_ugx ?? 0),
        ]);
      }

      if (tab === "credit") {
        head = [["Customer", "Contact", "Credit Limit", "Total Charged", "Total Paid", "Outstanding", "0-30d", "31-60d", "61-90d", "90d+"]];
        body = data.map((r) => [
          r.customer_name, r.contact_person ?? "—",
          formatUGX(r.credit_limit_ugx),
          formatUGX(r.total_charged),
          formatUGX(r.total_paid),
          formatUGX(r.outstanding_balance),
          formatUGX(r.current_0_30),
          formatUGX(r.days_31_60),
          formatUGX(r.days_61_90),
          formatUGX(r.over_90_days),
        ]);
        const totalOut = data.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0);
        body.push(["TOTAL", "", "", "", "", formatUGX(totalOut), "", "", "", ""]);
      }

      if (tab === "stock") {
        head = [["Station", "Product", "Opening (L)", "Delivered (L)", "Sold (L)", "Evap (L)", "Current Stock (L)"]];
        body = data.map((r) => [
          r.station_name, r.product_name,
          formatLitres(r.opening_balance_litres),
          formatLitres(r.total_delivered_litres),
          formatLitres(r.total_sold_litres),
          formatLitres(r.total_evaporation_litres),
          formatLitres(r.current_stock_litres),
        ]);
      }

      if (tab === "financial") {
        head = [["Station", "Total Revenue (UGX)", "Total Expenses (UGX)", "Gross Profit (UGX)", "Margin %"]];
        body = data.map((r) => [
          r.station_name,
          formatUGX(r.total_revenue),
          formatUGX(r.total_expenses),
          formatUGX(r.gross_profit),
          `${r.margin_pct}%`,
        ]);
        const totRev = data.reduce((s, r) => s + r.total_revenue, 0);
        const totExp = data.reduce((s, r) => s + r.total_expenses, 0);
        body.push(["TOTAL", formatUGX(totRev), formatUGX(totExp), formatUGX(totRev - totExp), ""]);
      }

      autoTable(doc, {
        startY: 28,
        head,
        body,
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        didParseCell: (data) => {
          if (data.section === "body") {
            const isLast = data.row.index === body.length - 1;
            if (isLast && (tab === "sales" || tab === "expenses" || tab === "credit" || tab === "financial")) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [241, 245, 249];
            }
          }
        },
      });

      // Page footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160);
        doc.text(
          `FuelTrack Uganda — ${reportLabel} — Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: "center" }
        );
      }

      doc.save(`FuelTrack_${reportLabel.replace(/ /g, "_")}_${from}_to_${to}.pdf`);
    } finally { setExporting(null); }
  };

  // ── SUMMARY STATS ─────────────────────────────────
  const getSummaryStats = () => {
    if (tab === "sales") {
      const total = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
      const litres = data.filter((r) => r.product_code).reduce((s, r) => s + (r.quantity ?? 0), 0);
      return [
        { label: "Total Revenue", value: formatUGX(total), color: "text-green-700" },
        { label: "Total Litres", value: formatLitres(litres), color: "text-blue-700" },
        { label: "Transactions", value: data.length.toString(), color: "text-purple-700" },
      ];
    }
    if (tab === "expenses") {
      const total = data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0);
      return [{ label: "Total Expenses", value: formatUGX(total), color: "text-red-600" }];
    }
    if (tab === "credit") {
      const total = data.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0);
      return [
        { label: "Total Outstanding", value: formatUGX(total), color: "text-amber-700" },
        { label: "Customers", value: data.length.toString(), color: "text-purple-700" },
      ];
    }
    if (tab === "financial") {
      const rev = data.reduce((s, r) => s + r.total_revenue, 0);
      const exp = data.reduce((s, r) => s + r.total_expenses, 0);
      return [
        { label: "Total Revenue", value: formatUGX(rev), color: "text-green-700" },
        { label: "Total Expenses", value: formatUGX(exp), color: "text-red-600" },
        { label: "Gross Profit", value: formatUGX(rev - exp), color: rev - exp >= 0 ? "text-green-700" : "text-red-600" },
      ];
    }
    return [];
  };

  const summaryStats = getSummaryStats();

  return (
    <>
      <Header title="Reports" />
      <div className="p-6 space-y-5">

        {/* Tab selector */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                  ${tab === t.id
                    ? "border-blue-700 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="card p-4 flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {tab !== "stock" && tab !== "credit" && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">From:</label>
                  <input type="date" className="form-input w-auto" value={from}
                    onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">To:</label>
                  <input type="date" className="form-input w-auto" value={to}
                    onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
            {tab !== "credit" && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Station:</label>
                <select className="form-select w-auto" value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}>
                  <option value="all">All Stations</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Export buttons */}
          {!loading && data.length > 0 && (
            <div className="flex gap-2">
              <button onClick={exportExcel} disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {exporting === "excel"
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Exporting...</>
                  : <><FileSpreadsheet size={15} /> Excel</>}
              </button>
              <button onClick={exportPDF} disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {exporting === "pdf"
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                  : <><FileText size={15} /> PDF</>}
              </button>
            </div>
          )}
        </div>

        {/* Summary stats */}
        {summaryStats.length > 0 && !loading && data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {summaryStats.map((s) => (
              <div key={s.label} className="stat-card">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Loading report...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No data found for the selected period and filters.
            </div>
          ) : (

            // ── SALES TABLE ──
            tab === "sales" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Time</th><th>Station</th>
                      <th>Product</th><th>Shift</th>
                      <th className="text-right">Qty (L)</th>
                      <th className="text-right">Price/L</th>
                      <th className="text-right">Amount (UGX)</th>
                      <th>Payment</th><th>EFD #</th>
                      <th>Customer / Ref</th><th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{r.transaction_date}</td>
                        <td className="text-gray-400 text-xs">{r.transaction_time ?? "—"}</td>
                        <td className="font-medium">{r.station_name}</td>
                        <td>{r.product_name}</td>
                        <td className="text-xs text-gray-500 capitalize">{r.shift_type ?? "—"}</td>
                        <td className="text-right">{formatLitres(r.quantity)}</td>
                        <td className="text-right text-xs text-gray-500">{formatUGX(r.unit_price_ugx)}</td>
                        <td className="text-right font-bold text-green-700">{formatUGX(r.amount_ugx)}</td>
                        <td>
                          <span className="badge bg-blue-50 text-blue-700 text-xs">
                            {paymentLabel(r.payment_type)}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-gray-400">{r.efd_receipt_number ?? "—"}</td>
                        <td className="text-xs text-gray-500">
                          {r.credit_customer_name ?? r.vehicle_reg ?? "—"}
                        </td>
                        <td className="text-xs text-gray-400">{r.entered_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={7} className="px-4 py-3 text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-right font-black text-green-700">
                        {formatUGX(data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0))}
                      </td>
                      <td colSpan={4} className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )

            // ── EXPENSES TABLE ──
            : tab === "expenses" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Station</th><th>Category</th>
                      <th>Description</th><th>Payee</th>
                      <th>Method</th><th>Receipt #</th>
                      <th className="text-right">Amount (UGX)</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{formatDate(r.expense_date)}</td>
                        <td className="font-medium">{r.station?.name ?? "—"}</td>
                        <td>
                          <span className="badge bg-orange-50 text-orange-700 text-xs capitalize">
                            {r.category?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="text-xs text-gray-600">{r.sub_description ?? "—"}</td>
                        <td className="text-xs">{r.payee ?? "—"}</td>
                        <td className="text-xs capitalize">{r.payment_method?.replace("_", " ") ?? "—"}</td>
                        <td className="font-mono text-xs text-gray-400">{r.receipt_reference ?? "—"}</td>
                        <td className="text-right font-bold text-red-600">{formatUGX(r.amount_ugx)}</td>
                        <td className="text-xs text-gray-400">{r.entered_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-3 font-bold text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-right font-black text-red-600">
                        {formatUGX(data.reduce((s, r) => s + (r.amount_ugx ?? 0), 0))}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )

            // ── SUPPLIER LEDGER ──
            : tab === "suppliers" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>OMC</th><th>Station</th>
                      <th>Reference</th><th>Description</th>
                      <th className="text-right text-red-600">Debit (UGX)</th>
                      <th className="text-right text-green-600">Credit (UGX)</th>
                      <th className="text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i} className={r.entry_type === "delivery" ? "bg-red-50/30" : "bg-green-50/30"}>
                        <td className="whitespace-nowrap">{formatDate(r.txn_date)}</td>
                        <td className="font-semibold">{r.omc_name}</td>
                        <td className="text-sm text-gray-600">{r.station_name}</td>
                        <td className="font-mono text-xs text-gray-500">{r.reference}</td>
                        <td className="text-xs text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              r.entry_type === "delivery" ? "bg-red-500" : "bg-green-500"
                            }`} />
                            {r.description}
                          </div>
                        </td>
                        <td className="text-right font-semibold text-red-600">
                          {r.debit_ugx > 0 ? formatUGX(r.debit_ugx) : "—"}
                        </td>
                        <td className="text-right font-semibold text-green-600">
                          {r.credit_ugx > 0 ? formatUGX(r.credit_ugx) : "—"}
                        </td>
                        <td className={`text-right font-black ${
                          r.running_balance_ugx > 0 ? "text-red-700" : "text-green-700"
                        }`}>
                          {formatUGX(r.running_balance_ugx)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

            // ── SHIFTS TABLE ──
            : tab === "shifts" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Station</th><th>Shift</th>
                      <th>Supervisor</th><th>Cashier</th><th>Status</th>
                      <th className="text-right">Meters (L)</th>
                      <th className="text-right">Sales (L)</th>
                      <th className="text-right">Variance</th>
                      <th className="text-right">Theoretical</th>
                      <th className="text-right">Cash</th>
                      <th className="text-right">MoMo</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Total Collected</th>
                      <th>Bank Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{formatDate(r.shift_date)}</td>
                        <td className="font-medium">{r.station_name}</td>
                        <td className="capitalize text-sm">
                          {r.shift_type}
                          {r.shift_sequence > 1 ? ` #${r.shift_sequence}` : ""}
                        </td>
                        <td className="text-xs">{r.supervisor_name ?? "—"}</td>
                        <td className="text-xs">{r.cashier_name ?? "—"}</td>
                        <td>
                          <span className={`badge text-xs ${
                            r.status === "reconciled" ? "bg-blue-100 text-blue-700"
                            : r.status === "closed"   ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="text-right">{formatLitres(r.total_litres_from_meters ?? 0)}</td>
                        <td className="text-right">{formatLitres(r.total_litres_from_sales ?? 0)}</td>
                        <td className={`text-right text-xs font-semibold ${
                          Math.abs(r.litres_variance ?? 0) > 10 ? "text-red-600" : "text-gray-400"
                        }`}>
                          {formatLitres(r.litres_variance ?? 0)}
                        </td>
                        <td className="text-right">{formatUGX(r.theoretical_sales_ugx ?? 0)}</td>
                        <td className="text-right">{formatUGX(r.cash_collected_ugx ?? 0)}</td>
                        <td className="text-right">{formatUGX(r.mtn_momo_ugx ?? 0)}</td>
                        <td className="text-right">{formatUGX(r.credit_sales_ugx ?? 0)}</td>
                        <td className="text-right font-bold text-green-700">{formatUGX(r.total_collected_ugx ?? 0)}</td>
                        <td className="font-mono text-xs text-gray-400">{r.bank_deposit_reference ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

            // ── CREDIT / DEBTORS TABLE ──
            : tab === "credit" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th><th>Contact</th><th>Phone</th>
                      <th className="text-right">Credit Limit</th>
                      <th className="text-right">Total Charged</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right text-amber-700">Outstanding</th>
                      <th className="text-right">0–30 days</th>
                      <th className="text-right">31–60 days</th>
                      <th className="text-right">61–90 days</th>
                      <th className="text-right text-red-600">Over 90 days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="font-bold text-gray-800">{r.customer_name}</td>
                        <td className="text-xs">{r.contact_person ?? "—"}</td>
                        <td className="text-xs">{r.phone ?? "—"}</td>
                        <td className="text-right">{formatUGX(r.credit_limit_ugx)}</td>
                        <td className="text-right">{formatUGX(r.total_charged)}</td>
                        <td className="text-right text-green-600">{formatUGX(r.total_paid)}</td>
                        <td className={`text-right font-black ${r.outstanding_balance > 0 ? "text-amber-700" : "text-green-600"}`}>
                          {formatUGX(r.outstanding_balance)}
                        </td>
                        <td className="text-right text-sm">{formatUGX(r.current_0_30)}</td>
                        <td className="text-right text-sm text-amber-600">{formatUGX(r.days_31_60)}</td>
                        <td className="text-right text-sm text-orange-600">{formatUGX(r.days_61_90)}</td>
                        <td className="text-right text-sm font-semibold text-red-600">{formatUGX(r.over_90_days)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={6} className="px-4 py-3 text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-right font-black text-amber-700">
                        {formatUGX(data.reduce((s, r) => s + (r.outstanding_balance ?? 0), 0))}
                      </td>
                      <td colSpan={4} className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )

            // ── STOCK TABLE ──
            : tab === "stock" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Station</th><th>Product</th><th>Code</th>
                      <th className="text-right">Opening (L)</th>
                      <th className="text-right">Delivered (L)</th>
                      <th className="text-right">Sold (L)</th>
                      <th className="text-right">Evaporation (L)</th>
                      <th className="text-right">Adjustments (L)</th>
                      <th className="text-right font-bold">Current Stock (L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => {
                      const isEmpty = r.current_stock_litres <= 0;
                      const isLow   = r.current_stock_litres < 2000 && !isEmpty;
                      return (
                        <tr key={i}>
                          <td className="font-medium">{r.station_name}</td>
                          <td className="font-bold text-gray-800">{r.product_name}</td>
                          <td className="text-xs text-gray-400">{r.product_code ?? "—"}</td>
                          <td className="text-right">{formatLitres(r.opening_balance_litres)}</td>
                          <td className="text-right text-green-600">+{formatLitres(r.total_delivered_litres)}</td>
                          <td className="text-right text-red-500">−{formatLitres(r.total_sold_litres)}</td>
                          <td className="text-right text-amber-500">−{formatLitres(r.total_evaporation_litres)}</td>
                          <td className={`text-right ${r.total_adjustments_litres >= 0 ? "text-blue-500" : "text-red-500"}`}>
                            {r.total_adjustments_litres >= 0 ? "+" : ""}
                            {formatLitres(r.total_adjustments_litres)}
                          </td>
                          <td className={`text-right font-black ${
                            isEmpty ? "text-red-600" : isLow ? "text-amber-600" : "text-green-700"
                          }`}>
                            {isEmpty ? "EMPTY" : formatLitres(r.current_stock_litres)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )

            // ── FINANCIAL SUMMARY ──
            : tab === "financial" ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th className="text-right">Total Revenue (UGX)</th>
                      <th className="text-right">Total Expenses (UGX)</th>
                      <th className="text-right">Gross Profit (UGX)</th>
                      <th className="text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((r, i) => (
                      <tr key={i}>
                        <td className="font-bold text-gray-800">{r.station_name}</td>
                        <td className="text-right font-bold text-green-700">{formatUGX(r.total_revenue)}</td>
                        <td className="text-right text-red-600">{formatUGX(r.total_expenses)}</td>
                        <td className={`text-right font-black ${r.gross_profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {formatUGX(r.gross_profit)}
                        </td>
                        <td className={`text-right font-semibold ${parseFloat(r.margin_pct) >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {r.margin_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 font-black text-gray-700">TOTAL</td>
                      <td className="px-4 py-3 text-right font-black text-green-700">
                        {formatUGX(data.reduce((s, r) => s + r.total_revenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-red-600">
                        {formatUGX(data.reduce((s, r) => s + r.total_expenses, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-green-700">
                        {formatUGX(
                          data.reduce((s, r) => s + r.total_revenue, 0) -
                          data.reduce((s, r) => s + r.total_expenses, 0)
                        )}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null
          )}
        </div>
      </div>
    </>
  );
}