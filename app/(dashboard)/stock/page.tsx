"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatLitres, formatDate, formatDateTime, today } from "@/utils";
import {
  Package, Droplets, ArrowDownCircle, TrendingDown,
  AlertTriangle, CheckCircle, Loader2, Plus, FileSpreadsheet,
  FileText, Info, RefreshCw, BarChart2
} from "lucide-react";

type StockTab = "inquiry" | "stock_in" | "movements" | "adjustments" | "dip_readings";

const TABS: { id: StockTab; label: string; icon: any }[] = [
  { id: "inquiry",      label: "Stock Inquiry",        icon: Package },
  { id: "stock_in",     label: "Stock In (Deliveries)", icon: ArrowDownCircle },
  { id: "movements",    label: "Movement Report",       icon: BarChart2 },
  { id: "adjustments",  label: "Adjustments",          icon: TrendingDown },
  { id: "dip_readings", label: "Dip Readings",         icon: Droplets },
];

const MOVEMENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  opening_balance: { label: "Opening Balance", color: "text-blue-700",   bg: "bg-blue-50"   },
  delivery:        { label: "Delivery In",     color: "text-green-700",  bg: "bg-green-50"  },
  sale:            { label: "Sale",            color: "text-red-600",    bg: "bg-red-50"    },
  evaporation:     { label: "Evaporation",     color: "text-amber-600",  bg: "bg-amber-50"  },
  adjustment:      { label: "Adjustment",      color: "text-purple-700", bg: "bg-purple-50" },
  transfer:        { label: "Transfer",        color: "text-gray-700",   bg: "bg-gray-50"   },
};

export default function StockPage() {
  const { activeStation, stations } = useStation();
  const [tab, setTab]               = useState<StockTab>("inquiry");

  // ── shared data ──
  const [tankLevels, setTankLevels]   = useState<any[]>([]);
  const [tanks, setTanks]             = useState<any[]>([]);
  const [products, setProducts]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState<"pdf"|"excel"|null>(null);

  // ── movements tab ──
  const [movements, setMovements]     = useState<any[]>([]);
  const [movLoading, setMovLoading]   = useState(false);
  const [movFrom, setMovFrom]         = useState(today().slice(0,7)+"-01");
  const [movTo, setMovTo]             = useState(today());
  const [movTankFilter, setMovTankFilter] = useState("all");

  // ── deliveries tab ──
  const [deliveries, setDeliveries]   = useState<any[]>([]);
  const [delLoading, setDelLoading]   = useState(false);

  // ── adjustment form ──
  const [adjTankId, setAdjTankId]     = useState("");
  const [adjType, setAdjType]         = useState<"evaporation"|"spillage"|"calibration"|"theft"|"measurement_error"|"other">("evaporation");
  const [adjQty, setAdjQty]           = useState("");
  const [adjDir, setAdjDir]           = useState<"out"|"in">("out");
  const [adjDate, setAdjDate]         = useState(today());
  const [adjReason, setAdjReason]     = useState("");
  const [adjAuth, setAdjAuth]         = useState("");
  const [adjBy, setAdjBy]             = useState("");
  const [adjSaving, setAdjSaving]     = useState(false);
  const [adjSaved, setAdjSaved]       = useState(false);
  const [adjError, setAdjError]       = useState("");
  const [adjHistory, setAdjHistory]   = useState<any[]>([]);

  // ── dip readings form ──
  const [dipTankId, setDipTankId]     = useState("");
  const [dipDate, setDipDate]         = useState(today());
  const [dipCm, setDipCm]             = useState("");
  const [dipVolume, setDipVolume]     = useState("");
  const [dipType, setDipType]         = useState("daily");
  const [dipNotes, setDipNotes]       = useState("");
  const [dipBy, setDipBy]             = useState("");
  const [dipSaving, setDipSaving]     = useState(false);
  const [dipSaved, setDipSaved]       = useState(false);
  const [dipError, setDipError]       = useState("");
  const [dipHistory, setDipHistory]   = useState<any[]>([]);

  // ── load tank levels ──────────────────────────────
  const loadTankLevels = useCallback(async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();
    const [levRes, tankRes, prodRes] = await Promise.all([
      supabase.from("vw_tank_stock_levels")
        .select("*")
        .eq("station_id", activeStation.id)
        .order("tank_number"),
      supabase.from("tanks")
        .select("id, tank_name, tank_number, capacity_litres, product:products(id,name)")
        .eq("station_id", activeStation.id)
        .eq("is_active", true)
        .order("tank_number"),
      supabase.from("products")
        .select("id, name")
        .eq("is_fuel", true)
        .eq("is_active", true),
    ]);
    if (levRes.data)  setTankLevels(levRes.data);
    if (tankRes.data) setTanks(tankRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  }, [activeStation]);

  // ── load movements ────────────────────────────────
  const loadMovements = useCallback(async () => {
    if (!activeStation) return;
    setMovLoading(true);
    const supabase = createClient();
    let q = supabase.from("vw_stock_movement_report")
      .select("*")
      .eq("station_id", activeStation.id)
      .gte("movement_date", movFrom)
      .lte("movement_date", movTo)
      .order("movement_date", { ascending: false })
      .order("sort_ts", { ascending: false });
    if (movTankFilter !== "all") q = q.eq("tank_id", movTankFilter);
    const { data } = await q.limit(500);
    if (data) setMovements(data);
    setMovLoading(false);
  }, [activeStation, movFrom, movTo, movTankFilter]);

  // ── load deliveries ───────────────────────────────
  const loadDeliveries = useCallback(async () => {
    if (!activeStation) return;
    setDelLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("fuel_deliveries")
      .select(`
        id, delivery_date, delivery_time, status,
        waybill_number, quantity_on_waybill, quantity_received,
        unit_cost_ugx, notes, entered_by,
        omc:omcs(brand_name, name),
        product:products(name, product_code),
        tank:tanks(tank_name, tank_number)
      `)
      .eq("station_id", activeStation.id)
      .order("delivery_date", { ascending: false })
      .limit(100);
    if (data) setDeliveries(data);
    setDelLoading(false);
  }, [activeStation]);

  // ── load adjustments history ──────────────────────
  const loadAdjHistory = useCallback(async () => {
    if (!activeStation) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("vw_stock_movement_report")
      .select("*")
      .eq("station_id", activeStation.id)
      .in("movement_type", ["adjustment","evaporation"])
      .order("movement_date", { ascending: false })
      .limit(100);
    if (data) setAdjHistory(data);
  }, [activeStation]);

  // ── load dip history ──────────────────────────────
  const loadDipHistory = useCallback(async () => {
    if (!activeStation) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("dip_readings")
      .select("*, tank:tanks(tank_name, tank_number)")
      .eq("station_id", activeStation.id)
      .order("reading_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setDipHistory(data);
  }, [activeStation]);

  useEffect(() => { loadTankLevels(); }, [loadTankLevels]);

  useEffect(() => {
    if (tab === "movements")    loadMovements();
    if (tab === "stock_in")     loadDeliveries();
    if (tab === "adjustments")  loadAdjHistory();
    if (tab === "dip_readings") loadDipHistory();
  }, [tab, loadMovements, loadDeliveries, loadAdjHistory, loadDipHistory]);

  useEffect(() => { if (tab === "movements") loadMovements(); }, [movFrom, movTo, movTankFilter]);

  // ── SAVE ADJUSTMENT ───────────────────────────────
  const saveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjTankId) { setAdjError("Select a tank."); return; }
    if (!adjQty || parseFloat(adjQty) <= 0) { setAdjError("Enter a valid quantity."); return; }
    if (!adjReason) { setAdjError("Reason is required for all adjustments."); return; }
    setAdjSaving(true); setAdjError("");
    const supabase = createClient();

    const selectedTank = tanks.find((t) => t.id === adjTankId);
    const quantity = adjDir === "out"
      ? -Math.abs(parseFloat(adjQty))
      :  Math.abs(parseFloat(adjQty));

    const { error } = await supabase.from("fuel_stock_movements").insert({
      station_id:    activeStation!.id,
      product_id:    selectedTank?.product?.id,
      tank_id:       adjTankId,
      movement_date: adjDate,
      movement_type: adjType === "evaporation" ? "evaporation" : "adjustment",
      quantity_litres: quantity,
      notes:  `[${adjType.toUpperCase()}] ${adjReason} | Auth: ${adjAuth || "N/A"}`,
      entered_by: adjBy || null,
    });

    if (error) { setAdjError(error.message); setAdjSaving(false); return; }
    setAdjSaving(false); setAdjSaved(true);
    setAdjTankId(""); setAdjQty(""); setAdjReason(""); setAdjAuth(""); setAdjBy("");
    loadTankLevels(); loadAdjHistory();
    setTimeout(() => setAdjSaved(false), 2000);
  };

  // ── SAVE DIP READING ──────────────────────────────
  const saveDipReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dipTankId) { setDipError("Select a tank."); return; }
    if (!dipVolume && !dipCm) { setDipError("Enter either dip depth (cm) or volume (litres)."); return; }
    setDipSaving(true); setDipError("");
    const supabase = createClient();

    const { error } = await supabase.from("dip_readings").insert({
      station_id:   activeStation!.id,
      tank_id:      dipTankId,
      reading_date: dipDate,
      reading_type: dipType,
      dip_cm:       dipCm ? parseFloat(dipCm) : null,
      volume_litres: dipVolume ? parseFloat(dipVolume) : null,
      notes:        dipNotes || null,
      entered_by:   dipBy || null,
    });

    if (error) { setDipError(error.message); setDipSaving(false); return; }
    setDipSaving(false); setDipSaved(true);
    setDipTankId(""); setDipCm(""); setDipVolume(""); setDipNotes("");
    loadTankLevels(); loadDipHistory();
    setTimeout(() => setDipSaved(false), 2000);
  };

  // ── SELECTED TANK STOCK (for dip variance preview) ──
  const selectedDipTank = tankLevels.find((t) => t.tank_id === dipTankId);
  const dipVariance = selectedDipTank && dipVolume
    ? selectedDipTank.current_stock_litres - parseFloat(dipVolume)
    : null;

  // ── EXCEL EXPORT ──────────────────────────────────
  const exportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb   = XLSX.utils.book_new();

      if (tab === "inquiry") {
        const rows = [
          ["FuelTrack Uganda — Stock Inquiry"],
          [`Station: ${activeStation?.name}  |  Generated: ${new Date().toLocaleString("en-UG")}`],
          [],
          ["Tank", "Product", "Code", "Capacity (L)", "Opening (L)", "In (L)", "Out (L)",
           "Adjustments (L)", "Current Stock (L)", "Fill %",
           "Last Dip (L)", "Last Dip Date", "System vs Dip Variance"],
          ...tankLevels.map((t) => [
            t.tank_name, t.product_name, t.product_code ?? "",
            t.capacity_litres, t.opening_balance_litres,
            t.total_in_litres, t.total_out_litres, t.total_adjustments_litres,
            t.current_stock_litres, `${t.fill_percentage}%`,
            t.last_dip_litres ?? "", t.last_dip_date ?? "",
            t.system_vs_dip_variance ?? "",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [
          {wch:20},{wch:15},{wch:8},{wch:14},{wch:14},
          {wch:12},{wch:12},{wch:16},{wch:18},{wch:8},
          {wch:14},{wch:14},{wch:20},
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Stock Inquiry");
      }

      if (tab === "movements") {
        const rows = [
          ["FuelTrack Uganda — Stock Movement Report"],
          [`Period: ${movFrom} to ${movTo}  |  Generated: ${new Date().toLocaleString("en-UG")}`],
          [],
          ["Date", "Tank", "Product", "Movement Type", "In (L)", "Out (L)", "Running Balance (L)", "Notes", "Entered By"],
          ...movements.map((m) => [
            m.movement_date, m.tank_name, m.product_name,
            MOVEMENT_LABELS[m.movement_type]?.label ?? m.movement_type,
            m.quantity_in_litres > 0 ? m.quantity_in_litres : "",
            m.quantity_out_litres > 0 ? m.quantity_out_litres : "",
            m.running_balance_litres,
            m.notes ?? "", m.entered_by ?? "",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [
          {wch:12},{wch:18},{wch:14},{wch:18},
          {wch:12},{wch:12},{wch:22},{wch:40},{wch:15},
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Stock Movements");
      }

      if (tab === "adjustments") {
        const rows = [
          ["FuelTrack Uganda — Stock Adjustments"],
          [`Generated: ${new Date().toLocaleString("en-UG")}`],
          [],
          ["Date", "Tank", "Product", "Type", "Direction", "Quantity (L)", "Notes", "By"],
          ...adjHistory.map((m) => [
            m.movement_date, m.tank_name, m.product_name,
            m.movement_type,
            m.quantity_in_litres > 0 ? "IN +" : "OUT −",
            m.quantity_in_litres > 0 ? m.quantity_in_litres : m.quantity_out_litres,
            m.notes ?? "", m.entered_by ?? "",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Adjustments");
      }

      if (tab === "dip_readings") {
        const rows = [
          ["FuelTrack Uganda — Dip Readings"],
          [`Generated: ${new Date().toLocaleString("en-UG")}`],
          [],
          ["Date", "Tank", "Reading Type", "Dip Depth (cm)", "Volume (L)", "Notes", "Entered By"],
          ...dipHistory.map((d) => [
            d.reading_date,
            (d.tank as any)?.tank_name ?? "—",
            d.reading_type,
            d.dip_cm ?? "",
            d.volume_litres ?? "",
            d.notes ?? "", d.entered_by ?? "",
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Dip Readings");
      }

      if (tab === "stock_in") {
        const rows = [
          ["FuelTrack Uganda — Stock In (Deliveries)"],
          [`Generated: ${new Date().toLocaleString("en-UG")}`],
          [],
          ["Date", "OMC", "Product", "Tank", "Waybill #", "Waybill Qty (L)", "Received (L)", "Variance (L)", "Unit Cost", "Status"],
          ...deliveries.map((d: any) => [
            d.delivery_date,
            d.omc?.brand_name ?? d.omc?.name ?? "—",
            d.product?.name ?? "—",
            d.tank?.tank_name ?? "—",
            d.waybill_number ?? "—",
            d.quantity_on_waybill,
            d.quantity_received ?? "",
            d.quantity_received != null
              ? (d.quantity_received - d.quantity_on_waybill) : "",
            d.unit_cost_ugx ?? "", d.status,
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Deliveries");
      }

      XLSX.writeFile(wb, `FuelTrack_Stock_${tab}_${today()}.xlsx`);
    } finally { setExporting(null); }
  };

  // ── PDF EXPORT ────────────────────────────────────
  const exportPDF = async () => {
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const tabLabel = TABS.find((t) => t.id === tab)?.label ?? "Stock";

      doc.setFontSize(15);
      doc.setTextColor(29, 78, 216);
      doc.text(`FuelTrack Uganda — ${tabLabel}`, 14, 15);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Station: ${activeStation?.name}  |  Generated: ${new Date().toLocaleString("en-UG")}`,
        14, 21
      );

      let head: string[][] = [];
      let body: any[][]    = [];
      let startY           = 26;

      if (tab === "inquiry") {
        head = [["Tank","Product","Capacity","Opening","In","Out","Adj","Current Stock","Fill%","Last Dip","Sys/Dip Var"]];
        body = tankLevels.map((t) => [
          t.tank_name, t.product_name,
          formatLitres(t.capacity_litres),
          formatLitres(t.opening_balance_litres),
          formatLitres(t.total_in_litres),
          formatLitres(t.total_out_litres),
          formatLitres(t.total_adjustments_litres),
          formatLitres(t.current_stock_litres),
          `${t.fill_percentage}%`,
          t.last_dip_litres ? formatLitres(t.last_dip_litres) : "—",
          t.system_vs_dip_variance != null ? formatLitres(t.system_vs_dip_variance) : "—",
        ]);
      }

      if (tab === "movements") {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Period: ${movFrom} to ${movTo}`, 14, 25);
        startY = 29;
        head = [["Date","Tank","Product","Type","In (L)","Out (L)","Balance (L)","Notes"]];
        body = movements.map((m) => [
          m.movement_date, m.tank_name, m.product_name,
          MOVEMENT_LABELS[m.movement_type]?.label ?? m.movement_type,
          m.quantity_in_litres  > 0 ? formatLitres(m.quantity_in_litres)  : "—",
          m.quantity_out_litres > 0 ? formatLitres(m.quantity_out_litres) : "—",
          formatLitres(m.running_balance_litres),
          (m.notes ?? "").slice(0, 40),
        ]);
      }

      if (tab === "adjustments") {
        head = [["Date","Tank","Product","Type","Direction","Quantity (L)","Notes","By"]];
        body = adjHistory.map((m) => [
          m.movement_date, m.tank_name, m.product_name,
          m.movement_type,
          m.quantity_in_litres > 0 ? "IN +" : "OUT −",
          formatLitres(m.quantity_in_litres > 0 ? m.quantity_in_litres : m.quantity_out_litres),
          (m.notes ?? "").slice(0, 40), m.entered_by ?? "—",
        ]);
      }

      if (tab === "dip_readings") {
        head = [["Date","Tank","Reading Type","Dip (cm)","Volume (L)","Notes","By"]];
        body = dipHistory.map((d) => [
          d.reading_date,
          (d.tank as any)?.tank_name ?? "—",
          d.reading_type,
          d.dip_cm ?? "—",
          d.volume_litres ? formatLitres(d.volume_litres) : "—",
          d.notes ?? "—", d.entered_by ?? "—",
        ]);
      }

      if (tab === "stock_in") {
        head = [["Date","OMC","Product","Tank","Waybill#","Waybill Qty","Received","Variance","Status"]];
        body = deliveries.map((d: any) => [
          d.delivery_date,
          d.omc?.brand_name ?? d.omc?.name ?? "—",
          d.product?.name ?? "—",
          d.tank?.tank_name ?? "—",
          d.waybill_number ?? "—",
          formatLitres(d.quantity_on_waybill),
          d.quantity_received ? formatLitres(d.quantity_received) : "—",
          d.quantity_received != null
            ? formatLitres(d.quantity_received - d.quantity_on_waybill) : "—",
          d.status,
        ]);
      }

      autoTable(doc, {
        startY,
        head,
        body,
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 7.5, cellPadding: 2 },
        didParseCell: (data) => {
          if (tab === "movements" && data.section === "body") {
            const m = movements[data.row.index];
            if (m?.movement_type === "delivery" && data.column.index === 4)
              data.cell.styles.textColor = [22, 163, 74];
            if ((m?.movement_type === "sale" || m?.movement_type === "evaporation") && data.column.index === 5)
              data.cell.styles.textColor = [220, 38, 38];
          }
        },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(160);
        doc.text(
          `FuelTrack Uganda — ${tabLabel} — Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 5,
          { align: "center" }
        );
      }
      doc.save(`FuelTrack_Stock_${tab}_${today()}.pdf`);
    } finally { setExporting(null); }
  };

  const hasExportData = () => {
    if (tab === "inquiry")      return tankLevels.length > 0;
    if (tab === "movements")    return movements.length > 0;
    if (tab === "adjustments")  return adjHistory.length > 0;
    if (tab === "dip_readings") return dipHistory.length > 0;
    if (tab === "stock_in")     return deliveries.length > 0;
    return false;
  };

  return (
    <>
      <Header title="Stock Management" />
      <div className="p-6 space-y-5">

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                  ${tab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Export bar — shown on all tabs when there is data */}
        {hasExportData() && (
          <div className="flex justify-end gap-2">
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

        {/* ═══════════════════════════════════════════════
            TAB 1 — STOCK INQUIRY
        ═══════════════════════════════════════════════ */}
        {tab === "inquiry" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Real-time stock level per tank — {activeStation?.name}.
                System stock is calculated from all confirmed movements.
                Dip reading is the last physical measurement taken.
              </p>
              <button onClick={loadTankLevels}
                className="btn-secondary btn-sm flex items-center gap-1.5">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading tanks...</div>
            ) : tankLevels.length === 0 ? (
              <div className="card p-12 text-center">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No tanks found</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add tanks in System Setup, then set opening balances below.
                </p>
                <Link href="/setup" className="btn-primary inline-flex mt-4">
                  Go to Setup
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {tankLevels.map((t) => {
                  const pct    = Math.min(Math.max(t.fill_percentage ?? 0, 0), 100);
                  const isEmpty = t.current_stock_litres <= 0;
                  const isLow   = !isEmpty && t.current_stock_litres < 2000;
                  const hasVar  = t.system_vs_dip_variance != null
                    && Math.abs(t.system_vs_dip_variance) > 50;

                  const barColor = isEmpty ? "bg-red-500"
                    : isLow     ? "bg-amber-500"
                    : pct >= 80 ? "bg-green-500" : "bg-blue-500";

                  return (
                    <div key={t.tank_id} className={`card overflow-hidden border-l-4 ${
                      isEmpty ? "border-red-500"
                      : isLow ? "border-amber-400"
                      : "border-green-500"}`}>
                      <div className="p-5">
                        {/* Tank header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-black text-white text-sm ${
                              isEmpty ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-blue-600"}`}>
                              T{t.tank_number}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-lg">{t.tank_name}</p>
                              <p className="text-sm text-gray-500">
                                {t.product_name}
                                {t.product_code ? ` (${t.product_code})` : ""}
                                &nbsp;·&nbsp;Capacity: {t.capacity_litres.toLocaleString()} L
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-black ${
                              isEmpty ? "text-red-600" : isLow ? "text-amber-600" : "text-green-700"}`}>
                              {isEmpty ? "EMPTY" : formatLitres(t.current_stock_litres)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% full</p>
                          </div>
                        </div>

                        {/* Fill bar */}
                        <div className="bg-gray-100 rounded-full h-3 mb-4 relative overflow-hidden">
                          <div
                            className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${pct}%` }} />
                          {[25, 50, 75].map((mark) => (
                            <div key={mark} style={{ left: `${mark}%` }}
                              className="absolute top-0 bottom-0 w-px bg-white/50" />
                          ))}
                        </div>

                        {/* Stock breakdown */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            { label: "Opening Balance",  value: formatLitres(t.opening_balance_litres),    color: "text-blue-700"  },
                            { label: "Total Delivered",   value: `+${formatLitres(t.total_in_litres)}`,    color: "text-green-600" },
                            { label: "Total Sold",        value: `-${formatLitres(t.total_out_litres)}`,   color: "text-red-500"   },
                            { label: "Adjustments",       value: formatLitres(t.total_adjustments_litres), color: "text-purple-600"},
                            { label: "Current Stock",     value: formatLitres(t.current_stock_litres),     color: isEmpty ? "text-red-600" : "text-gray-800" },
                          ].map((s) => (
                            <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs text-gray-400">{s.label}</p>
                              <p className={`font-bold text-sm mt-0.5 ${s.color}`}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Dip reading comparison */}
                        {t.last_dip_litres != null && (
                          <div className={`mt-3 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                            hasVar ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                            <Droplets size={16} className={hasVar ? "text-red-500" : "text-green-500"} />
                            <div className="flex-1">
                              <p className="text-xs text-gray-600">
                                Last dip reading ({formatDate(t.last_dip_date)}):
                                <span className="font-bold ml-1">{formatLitres(t.last_dip_litres)}</span>
                                <span className="text-gray-400 ml-2">vs system:</span>
                                <span className="font-bold ml-1">{formatLitres(t.current_stock_litres)}</span>
                              </p>
                            </div>
                            <span className={`font-bold text-sm ${hasVar ? "text-red-600" : "text-green-600"}`}>
                              {t.system_vs_dip_variance > 0 ? "+" : ""}
                              {formatLitres(t.system_vs_dip_variance)} variance
                            </span>
                            {hasVar && (
                              <AlertTriangle size={15} className="text-red-500" />
                            )}
                          </div>
                        )}

                        {/* Alerts */}
                        {isEmpty && (
                          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <AlertTriangle size={15} className="text-red-500" />
                            <p className="text-red-700 text-sm font-semibold">
                              Tank is empty — fuel sales blocked until a delivery is received.
                            </p>
                            <Link href="/deliveries/new" className="ml-auto btn-danger btn-sm">
                              Record Delivery
                            </Link>
                          </div>
                        )}
                        {isLow && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <AlertTriangle size={15} className="text-amber-500" />
                            <p className="text-amber-700 text-sm">
                              Low stock warning — only {formatLitres(t.current_stock_litres)} remaining.
                            </p>
                          </div>
                        )}

                        {/* Last movement */}
                        {t.last_movement_date && (
                          <p className="text-xs text-gray-400 mt-2">
                            Last movement: {formatDate(t.last_movement_date)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 2 — STOCK IN (DELIVERIES)
        ═══════════════════════════════════════════════ */}
        {tab === "stock_in" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Every delivery is directed to a specific tank and automatically
                  updates that tank's stock when confirmed as received.
                </p>
              </div>
              <Link href="/deliveries/new" className="btn-primary">
                <Plus size={15} /> Record New Delivery
              </Link>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-blue-700">
              <Info size={15} className="flex-shrink-0 mt-0.5" />
              Deliveries with status <strong>Pending</strong> do not affect stock.
              Only <strong>Received</strong> deliveries update stock levels.
              <strong>Disputed</strong> deliveries are held until resolved.
            </div>

            {delLoading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : deliveries.length === 0 ? (
              <div className="card p-12 text-center">
                <ArrowDownCircle size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No deliveries recorded yet</p>
                <Link href="/deliveries/new" className="btn-primary inline-flex mt-4">
                  Record First Delivery
                </Link>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>OMC</th><th>Product</th>
                        <th>Tank Received Into</th>
                        <th>Waybill #</th>
                        <th className="text-right">Waybill Qty</th>
                        <th className="text-right">Qty Received</th>
                        <th className="text-right">Variance</th>
                        <th className="text-right">Unit Cost</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d: any) => {
                        const variance = d.quantity_received != null
                          ? d.quantity_received - d.quantity_on_waybill : null;
                        return (
                          <tr key={d.id}>
                            <td className="whitespace-nowrap font-medium">
                              {formatDate(d.delivery_date)}
                              {d.delivery_time
                                ? <span className="text-gray-400 text-xs ml-1">{d.delivery_time.slice(0,5)}</span>
                                : null}
                            </td>
                            <td className="font-semibold">{d.omc?.brand_name ?? d.omc?.name ?? "—"}</td>
                            <td>{d.product?.name ?? "—"}</td>
                            <td>
                              {d.tank ? (
                                <span className="badge bg-blue-50 text-blue-700 text-xs">
                                  T{d.tank.tank_number} — {d.tank.tank_name}
                                </span>
                              ) : (
                                <span className="badge bg-red-50 text-red-600 text-xs">
                                  No tank assigned
                                </span>
                              )}
                            </td>
                            <td className="font-mono text-xs text-gray-500">{d.waybill_number ?? "—"}</td>
                            <td className="text-right">{formatLitres(d.quantity_on_waybill)}</td>
                            <td className="text-right font-semibold">
                              {d.quantity_received ? formatLitres(d.quantity_received) : "—"}
                            </td>
                            <td className={`text-right text-xs font-semibold ${
                              variance == null ? "text-gray-300"
                              : variance < -20  ? "text-red-600"
                              : variance > 20   ? "text-blue-600"
                              : "text-green-600"}`}>
                              {variance != null
                                ? `${variance >= 0 ? "+" : ""}${formatLitres(variance)}`
                                : "—"}
                            </td>
                            <td className="text-right text-xs">
                              {d.unit_cost_ugx ? `UGX ${Number(d.unit_cost_ugx).toLocaleString()}/L` : "—"}
                            </td>
                            <td>
                              <span className={`badge text-xs ${
                                d.status === "received" ? "bg-green-100 text-green-700"
                                : d.status === "pending" ? "bg-yellow-100 text-yellow-700"
                                : d.status === "disputed" ? "bg-red-100 text-red-600"
                                : "bg-gray-100 text-gray-600"}`}>
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 3 — MOVEMENT REPORT
        ═══════════════════════════════════════════════ */}
        {tab === "movements" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="card p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">From:</label>
                <input type="date" className="form-input w-auto" value={movFrom}
                  onChange={(e) => setMovFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">To:</label>
                <input type="date" className="form-input w-auto" value={movTo}
                  onChange={(e) => setMovTo(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Tank:</label>
                <select className="form-select w-auto" value={movTankFilter}
                  onChange={(e) => setMovTankFilter(e.target.value)}>
                  <option value="all">All Tanks</option>
                  {tanks.map((t) => (
                    <option key={t.id} value={t.id}>
                      T{t.tank_number} — {t.tank_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {movLoading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading movements...</div>
            ) : movements.length === 0 ? (
              <div className="card p-10 text-center text-gray-400 text-sm">
                No movements found for the selected period and tank.
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Tank</th>
                        <th>Product</th>
                        <th>Movement Type</th>
                        <th className="text-right text-green-600">Stock In (L)</th>
                        <th className="text-right text-red-500">Stock Out (L)</th>
                        <th className="text-right font-bold">Running Balance (L)</th>
                        <th>Notes</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m, i) => {
                        const ml = MOVEMENT_LABELS[m.movement_type] ?? {
                          label: m.movement_type, color: "text-gray-700", bg: "bg-gray-50"
                        };
                        return (
                          <tr key={m.id ?? i}>
                            <td className="whitespace-nowrap text-sm font-medium">
                              {formatDate(m.movement_date)}
                            </td>
                            <td>
                              <span className="badge bg-blue-50 text-blue-700 text-xs">
                                T{m.tank_number} {m.tank_name}
                              </span>
                            </td>
                            <td className="text-sm">{m.product_name}</td>
                            <td>
                              <span className={`badge text-xs ${ml.bg} ${ml.color}`}>
                                {ml.label}
                              </span>
                            </td>
                            <td className="text-right font-semibold text-green-600">
                              {m.quantity_in_litres > 0
                                ? `+${formatLitres(m.quantity_in_litres)}` : "—"}
                            </td>
                            <td className="text-right font-semibold text-red-500">
                              {m.quantity_out_litres > 0
                                ? `-${formatLitres(m.quantity_out_litres)}` : "—"}
                            </td>
                            <td className={`text-right font-black ${
                              m.running_balance_litres <= 0 ? "text-red-600"
                              : m.running_balance_litres < 2000 ? "text-amber-600"
                              : "text-gray-800"}`}>
                              {formatLitres(m.running_balance_litres)}
                            </td>
                            <td className="text-xs text-gray-500 max-w-[180px] truncate">
                              {m.notes ?? "—"}
                            </td>
                            <td className="text-xs text-gray-400">{m.entered_by ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 4 — ADJUSTMENTS
        ═══════════════════════════════════════════════ */}
        {tab === "adjustments" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Form */}
            <div className="card p-5 space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Record Stock Adjustment</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Every adjustment is permanently logged with the reason and authorization.
                  Use this for evaporation, spillage, calibration corrections, or measurement errors.
                </p>
              </div>

              <form onSubmit={saveAdjustment} className="space-y-3">
                <div>
                  <label className="form-label">Tank *</label>
                  <select className="form-select" value={adjTankId}
                    onChange={(e) => setAdjTankId(e.target.value)} required>
                    <option value="">Select tank...</option>
                    {tankLevels.map((t) => (
                      <option key={t.tank_id} value={t.tank_id}>
                        T{t.tank_number} — {t.tank_name} ({t.product_name})
                        &nbsp;| Current: {Math.round(t.current_stock_litres).toLocaleString()} L
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Adjustment Type *</label>
                  <select className="form-select" value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}>
                    <option value="evaporation">Evaporation Loss</option>
                    <option value="spillage">Spillage / Overflow</option>
                    <option value="calibration">Meter Calibration Correction</option>
                    <option value="theft">Theft / Unexplained Loss</option>
                    <option value="measurement_error">Measurement / Dip Error Correction</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Direction *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: "out", label: "Remove from Stock (−)", desc: "Loss, evaporation, sale correction" },
                      { val: "in",  label: "Add to Stock (+)",      desc: "Correction, found stock" },
                    ].map((opt) => (
                      <label key={opt.val}
                        className={`flex items-start gap-2 p-3 rounded-xl border-2 cursor-pointer ${
                          adjDir === opt.val ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                        <input type="radio" className="hidden"
                          checked={adjDir === opt.val as any}
                          onChange={() => setAdjDir(opt.val as any)} />
                        <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                          adjDir === opt.val ? "border-blue-500 bg-blue-500" : "border-gray-300"}`} />
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{opt.label}</p>
                          <p className="text-xs text-gray-400">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Quantity (litres) *</label>
                    <input type="number" step="0.001" min="0" className="form-input"
                      placeholder="e.g. 45.000" value={adjQty}
                      onChange={(e) => setAdjQty(e.target.value)} required />
                  </div>
                  <div>
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={adjDate}
                      onChange={(e) => setAdjDate(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="form-label">Reason / Explanation *</label>
                  <textarea className="form-input" rows={2}
                    placeholder="Explain why this adjustment is needed — this is a permanent record"
                    value={adjReason} onChange={(e) => setAdjReason(e.target.value)} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Authorized By *</label>
                    <input type="text" className="form-input"
                      placeholder="Name of person authorizing"
                      value={adjAuth} onChange={(e) => setAdjAuth(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Entered By</label>
                    <input type="text" className="form-input"
                      placeholder="Your name"
                      value={adjBy} onChange={(e) => setAdjBy(e.target.value)} />
                  </div>
                </div>

                {adjError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                    {adjError}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full justify-center" disabled={adjSaving}>
                  {adjSaved
                    ? <><CheckCircle size={16} /> Adjustment Saved</>
                    : adjSaving
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : "Save Adjustment"}
                </button>
              </form>
            </div>

            {/* History */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Adjustment History</p>
                <p className="text-xs text-gray-400 mt-0.5">All evaporation records and manual adjustments</p>
              </div>
              {adjHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No adjustments recorded yet</div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Tank</th><th>Type</th>
                        <th className="text-right">Qty (L)</th><th>Notes</th><th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjHistory.map((m, i) => (
                        <tr key={m.id ?? i}>
                          <td className="whitespace-nowrap text-sm">{formatDate(m.movement_date)}</td>
                          <td className="text-xs">{m.tank_name}</td>
                          <td>
                            <span className={`badge text-xs ${
                              MOVEMENT_LABELS[m.movement_type]?.bg ?? "bg-gray-50"
                            } ${MOVEMENT_LABELS[m.movement_type]?.color ?? "text-gray-700"}`}>
                              {m.movement_type}
                            </span>
                          </td>
                          <td className={`text-right font-semibold text-sm ${
                            m.quantity_in_litres > 0 ? "text-green-600" : "text-red-500"}`}>
                            {m.quantity_in_litres > 0
                              ? `+${formatLitres(m.quantity_in_litres)}`
                              : `-${formatLitres(m.quantity_out_litres)}`}
                          </td>
                          <td className="text-xs text-gray-500 max-w-[150px] truncate">
                            {m.notes ?? "—"}
                          </td>
                          <td className="text-xs text-gray-400">{m.entered_by ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            TAB 5 — DIP READINGS
        ═══════════════════════════════════════════════ */}
        {tab === "dip_readings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Form */}
            <div className="card p-5 space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Record Dip Reading</h3>
                <p className="text-sm text-gray-500 mt-1">
                  A dip reading is a physical measurement of fuel depth in the tank
                  using a dip rod. Take a reading for each tank at the start and end
                  of every day and compare against the system stock to detect variances.
                </p>
              </div>

              <form onSubmit={saveDipReading} className="space-y-3">
                <div>
                  <label className="form-label">Tank *</label>
                  <select className="form-select" value={dipTankId}
                    onChange={(e) => setDipTankId(e.target.value)} required>
                    <option value="">Select tank...</option>
                    {tankLevels.map((t) => (
                      <option key={t.tank_id} value={t.tank_id}>
                        T{t.tank_number} — {t.tank_name} ({t.product_name})
                        &nbsp;| System: {Math.round(t.current_stock_litres).toLocaleString()} L
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Reading Date</label>
                    <input type="date" className="form-input" value={dipDate}
                      onChange={(e) => setDipDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Reading Type</label>
                    <select className="form-select" value={dipType}
                      onChange={(e) => setDipType(e.target.value)}>
                      <option value="daily">Daily Measurement</option>
                      <option value="pre_delivery">Pre-Delivery Dip</option>
                      <option value="post_delivery">Post-Delivery Dip</option>
                      <option value="opening">Shift Opening Dip</option>
                      <option value="closing">Shift Closing Dip</option>
                      <option value="audit">Audit / Spot Check</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Dip Depth (cm)</label>
                    <input type="number" step="0.1" min="0" className="form-input"
                      placeholder="Physical depth in cm"
                      value={dipCm} onChange={(e) => setDipCm(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">
                      Use your tank calibration chart to convert to litres
                    </p>
                  </div>
                  <div>
                    <label className="form-label">Volume (litres) *</label>
                    <input type="number" step="0.001" min="0" className="form-input"
                      placeholder="Litres from chart"
                      value={dipVolume} onChange={(e) => setDipVolume(e.target.value)} />
                    <p className="text-xs text-gray-400 mt-1">
                      Converted volume from calibration chart
                    </p>
                  </div>
                </div>

                {/* Live variance preview */}
                {dipVariance !== null && (
                  <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
                    Math.abs(dipVariance) > 100
                      ? "bg-red-50 border-red-200"
                      : Math.abs(dipVariance) > 20
                      ? "bg-amber-50 border-amber-200"
                      : "bg-green-50 border-green-200"}`}>
                    {Math.abs(dipVariance) > 20
                      ? <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                      : <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
                    <div>
                      <p className={`text-sm font-semibold ${
                        Math.abs(dipVariance) > 100 ? "text-red-700"
                        : Math.abs(dipVariance) > 20 ? "text-amber-700"
                        : "text-green-700"}`}>
                        Variance: {dipVariance > 0 ? "+" : ""}{formatLitres(dipVariance)}
                      </p>
                      <p className="text-xs text-gray-500">
                        System stock: {formatLitres(selectedDipTank?.current_stock_litres ?? 0)} ·
                        Dip reading: {formatLitres(parseFloat(dipVolume))}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label">Notes</label>
                  <input type="text" className="form-input"
                    placeholder="Any observations, conditions at time of dip..."
                    value={dipNotes} onChange={(e) => setDipNotes(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Dip Taken By</label>
                  <input type="text" className="form-input"
                    value={dipBy} onChange={(e) => setDipBy(e.target.value)} />
                </div>

                {dipError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                    {dipError}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2 text-xs text-blue-600">
                  <Info size={13} className="flex-shrink-0 mt-0.5" />
                  A dip reading does not change system stock. It is for verification only.
                  If a significant variance is found, use Stock Adjustments to correct the system.
                </div>

                <button type="submit" className="btn-primary w-full justify-center" disabled={dipSaving}>
                  {dipSaved
                    ? <><CheckCircle size={16} /> Dip Reading Saved</>
                    : dipSaving
                    ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : "Save Dip Reading"}
                </button>
              </form>
            </div>

            {/* Dip history */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="font-bold text-gray-800">Dip Reading History</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Physical tank measurements — compare against system stock to detect losses
                </p>
              </div>
              {dipHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  No dip readings recorded yet
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Tank</th><th>Type</th>
                        <th className="text-right">Dip (cm)</th>
                        <th className="text-right">Volume (L)</th>
                        <th>Notes</th><th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dipHistory.map((d, i) => (
                        <tr key={d.id ?? i}>
                          <td className="whitespace-nowrap text-sm font-medium">
                            {formatDate(d.reading_date)}
                          </td>
                          <td className="text-xs font-semibold text-gray-700">
                            {(d.tank as any)?.tank_name ?? "—"}
                          </td>
                          <td>
                            <span className="badge bg-blue-50 text-blue-700 text-xs capitalize">
                              {d.reading_type?.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="text-right text-gray-600 text-sm">
                            {d.dip_cm != null ? `${d.dip_cm} cm` : "—"}
                          </td>
                          <td className="text-right font-semibold text-gray-800 text-sm">
                            {d.volume_litres ? formatLitres(d.volume_litres) : "—"}
                          </td>
                          <td className="text-xs text-gray-500 max-w-[120px] truncate">
                            {d.notes ?? "—"}
                          </td>
                          <td className="text-xs text-gray-400">{d.entered_by ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}