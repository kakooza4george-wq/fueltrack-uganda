"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { formatUGX, formatLitres, today } from "@/utils";
import { BarChart3, Download, FileSpreadsheet, FileText } from "lucide-react";

interface StationSummary {
  name: string;
  revenue: number;
  litres: number;
  cash: number;
  momo: number;
  credit: number;
  lpo: number;
}

export default function ReportsPage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo]     = useState(today());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("vw_daily_station_summary")
        .select("*")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      if (data) setSummary(data);
      setLoading(false);
    };
    load();
  }, [from, to]);

  // Build station summary map
  const byStation: Record<string, StationSummary> = {};
  summary.forEach((row) => {
    if (!byStation[row.station_id]) {
      byStation[row.station_id] = {
        name: row.station_name,
        revenue: 0, litres: 0, cash: 0, momo: 0, credit: 0, lpo: 0,
      };
    }
    byStation[row.station_id].revenue += row.total_revenue_ugx ?? 0;
    byStation[row.station_id].litres  += row.total_litres_sold ?? 0;
    byStation[row.station_id].cash    += row.cash_revenue ?? 0;
    byStation[row.station_id].momo    += (row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0);
    byStation[row.station_id].credit  += row.credit_revenue ?? 0;
    byStation[row.station_id].lpo     += row.lpo_revenue ?? 0;
  });

  const stationList = Object.values(byStation);
  const grandRevenue = stationList.reduce((s, r) => s + r.revenue, 0);
  const grandLitres  = stationList.reduce((s, r) => s + r.litres, 0);
  const days = new Set(summary.map((r) => r.transaction_date as string)).size;

  // ── EXCEL EXPORT ────────────────────────────────────
  const exportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Station Comparison
      const stationData = [
        ["Station", "Litres Sold", "Revenue (UGX)", "Cash", "MoMo", "Credit", "LPO"],
        ...stationList.map((s) => [
          s.name,
          s.litres,
          s.revenue,
          s.cash,
          s.momo,
          s.credit,
          s.lpo,
        ]),
        ["TOTAL", grandLitres, grandRevenue, "", "", "", ""],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(stationData);
      ws1["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Station Comparison");

      // Sheet 2: Daily Breakdown
      const dailyData = [
        ["Date", "Station", "Litres Sold", "Revenue (UGX)", "Cash", "MoMo", "Credit"],
        ...summary.map((row) => [
          row.transaction_date,
          row.station_name,
          row.total_litres_sold ?? 0,
          row.total_revenue_ugx ?? 0,
          row.cash_revenue ?? 0,
          (row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0),
          row.credit_revenue ?? 0,
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(dailyData);
      ws2["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Daily Breakdown");

      XLSX.writeFile(wb, `FuelTrack_Report_${from}_to_${to}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  // ── PDF EXPORT ──────────────────────────────────────
  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // Title
      doc.setFontSize(18);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text("FuelTrack Uganda — Sales Report", 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // gray-500
      doc.text(`Period: ${from} to ${to}`, 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString("en-UG")}`, 14, 31);

      // Summary stats
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(`Total Revenue: ${formatUGX(grandRevenue)}`, 14, 40);
      doc.text(`Total Litres Sold: ${formatLitres(grandLitres)}`, 80, 40);
      doc.text(`Stations: ${stationList.length}`, 160, 40);
      doc.text(`Days: ${days}`, 210, 40);

      // Station Comparison Table
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text("Station Comparison", 14, 52);

      autoTable(doc, {
        startY: 55,
        head: [["Station", "Litres Sold", "Revenue (UGX)", "Cash", "MoMo", "Credit", "LPO"]],
        body: [
          ...stationList.map((s) => [
            s.name,
            formatLitres(s.litres),
            formatUGX(s.revenue),
            formatUGX(s.cash),
            formatUGX(s.momo),
            formatUGX(s.credit),
            formatUGX(s.lpo),
          ]),
          ["TOTAL", formatLitres(grandLitres), formatUGX(grandRevenue), "", "", "", ""],
        ],
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "right" },
          2: { halign: "right", fontStyle: "bold" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
      });

      // Daily Breakdown Table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.text("Daily Breakdown", 14, finalY);

      autoTable(doc, {
        startY: finalY + 3,
        head: [["Date", "Station", "Litres", "Revenue", "Cash", "MoMo", "Credit"]],
        body: summary.map((row) => [
          row.transaction_date,
          row.station_name,
          formatLitres(row.total_litres_sold),
          formatUGX(row.total_revenue_ugx),
          formatUGX(row.cash_revenue),
          formatUGX((row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0)),
          formatUGX(row.credit_revenue),
        ]),
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 50, fontStyle: "bold" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `FuelTrack Uganda — Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: "center" }
        );
      }

      doc.save(`FuelTrack_Report_${from}_to_${to}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <Header title="Reports" />
      <div className="p-6 space-y-6">

        {/* Filter + Export bar */}
        <div className="card p-4 flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <BarChart3 size={18} className="text-blue-600" />
            <span className="text-sm text-gray-600 font-semibold">Period:</span>
            <input type="date" className="form-input w-auto" value={from}
              onChange={(e) => setFrom(e.target.value)} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" className="form-input w-auto" value={to}
              onChange={(e) => setTo(e.target.value)} />
          </div>

          {/* Export buttons */}
          {!loading && summary.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportExcel}
                disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {exporting === "excel"
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Exporting...</>
                  : <><FileSpreadsheet size={16} /> Export Excel</>}
              </button>
              <button
                onClick={exportPDF}
                disabled={exporting !== null}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {exporting === "pdf"
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                  : <><FileText size={16} /> Export PDF</>}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue",     value: formatUGX(grandRevenue),    color: "text-green-700" },
            { label: "Total Litres Sold", value: formatLitres(grandLitres),  color: "text-blue-700" },
            { label: "Stations Active",   value: String(stationList.length), color: "text-purple-700" },
            { label: "Days in Period",    value: String(days),               color: "text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Station Comparison */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Station Comparison</h2>
            <Download size={15} className="text-gray-300" />
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : stationList.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Station</th>
                    <th className="text-right">Litres Sold</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">MoMo</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">LPO</th>
                  </tr>
                </thead>
                <tbody>
                  {stationList.map((s) => (
                    <tr key={s.name}>
                      <td className="font-bold text-gray-800">{s.name}</td>
                      <td className="text-right">{formatLitres(s.litres)}</td>
                      <td className="text-right font-black text-green-700">{formatUGX(s.revenue)}</td>
                      <td className="text-right">{formatUGX(s.cash)}</td>
                      <td className="text-right">{formatUGX(s.momo)}</td>
                      <td className="text-right text-amber-700">{formatUGX(s.credit)}</td>
                      <td className="text-right">{formatUGX(s.lpo)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-black text-gray-700">TOTAL</td>
                    <td className="px-4 py-3 text-right font-black text-blue-700">
                      {formatLitres(grandLitres)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-green-700">
                      {formatUGX(grandRevenue)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Daily Breakdown */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Daily Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : summary.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                No sales in this period.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th className="text-right">Litres</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Cash</th>
                    <th className="text-right">MoMo</th>
                    <th className="text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={`${row.station_id as string}-${row.transaction_date as string}`}>
                      <td className="text-gray-500 whitespace-nowrap text-sm">
                        {row.transaction_date}
                      </td>
                      <td className="font-semibold text-gray-800">{row.station_name}</td>
                      <td className="text-right">{formatLitres(row.total_litres_sold)}</td>
                      <td className="text-right font-bold text-green-700">
                        {formatUGX(row.total_revenue_ugx)}
                      </td>
                      <td className="text-right text-gray-600">{formatUGX(row.cash_revenue)}</td>
                      <td className="text-right text-gray-600">
                        {formatUGX((row.momo_revenue ?? 0) + (row.airtel_revenue ?? 0))}
                      </td>
                      <td className="text-right text-amber-700">
                        {formatUGX(row.credit_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}