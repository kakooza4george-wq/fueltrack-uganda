"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatLitres, formatDate, today } from "@/utils";
import { Package, CheckCircle, Loader2, AlertTriangle, Droplets } from "lucide-react";

interface StockLevel {
  station_id: string;
  station_name: string;
  product_id: string;
  product_name: string;
  product_code: string;
  is_fuel: boolean;
  opening_balance_litres: number;
  total_delivered_litres: number;
  total_sold_litres: number;
  total_evaporation_litres: number;
  total_adjustments_litres: number;
  current_stock_litres: number;
}

interface Product { id: string; name: string; product_code: string | null; }

export default function StockPage() {
  const { activeStation } = useStation();
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"levels" | "opening" | "evaporation" | "adjustment">("levels");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const openingForm = useForm<any>();
  const evapForm = useForm<any>();
  const adjustForm = useForm<any>();

  const loadStock = async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();
    const [stockRes, prodRes] = await Promise.all([
      supabase.from("vw_current_stock").select("*").eq("station_id", activeStation.id),
      supabase.from("products").select("id, name, product_code, is_fuel").eq("is_fuel", true).order("name"),
    ]);
    if (stockRes.data) setStock(stockRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { loadStock(); }, [activeStation]);

  const getColors = (litres: number) => {
    if (litres <= 0) return { bar: "bg-red-500", text: "text-red-700", border: "border-red-200", bg: "bg-red-50" };
    if (litres < 2000) return { bar: "bg-amber-500", text: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" };
    return { bar: "bg-green-500", text: "text-green-700", border: "border-green-200", bg: "bg-green-50" };
  };

  const saveOpening = async (data: any) => {
    if (!activeStation) return;
    setSaving(true); setError("");
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("fuel_stock_movements").select("id")
      .eq("station_id", activeStation.id).eq("product_id", data.product_id)
      .eq("movement_type", "opening_balance").single();
    if (existing) {
      setError("Opening balance already set for this product. Use Manual Adjustment instead.");
      setSaving(false); return;
    }
    const { error: err } = await supabase.from("fuel_stock_movements").insert({
      station_id: activeStation.id,
      product_id: data.product_id,
      movement_date: data.movement_date || today(),
      movement_type: "opening_balance",
      quantity_litres: parseFloat(data.quantity_litres),
      notes: data.notes || "Opening balance — system setup",
      entered_by: data.entered_by || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true); openingForm.reset(); loadStock();
    setTimeout(() => setSaved(false), 2000);
  };

  const saveEvaporation = async (data: any) => {
    if (!activeStation) return;
    setSaving(true); setError("");
    const supabase = createClient();
    const qty = parseFloat(data.quantity_litres);
    const { data: current } = await supabase
      .from("vw_current_stock").select("current_stock_litres")
      .eq("station_id", activeStation.id).eq("product_id", data.product_id).single();
    if (current && current.current_stock_litres < qty) {
      setError(`Only ${current.current_stock_litres.toFixed(2)}L available. Cannot record more than current stock.`);
      setSaving(false); return;
    }
    const { error: err } = await supabase.from("fuel_stock_movements").insert({
      station_id: activeStation.id,
      product_id: data.product_id,
      movement_date: data.movement_date || today(),
      movement_type: "evaporation",
      quantity_litres: -qty,
      notes: data.notes || "Daily evaporation loss",
      entered_by: data.entered_by || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true); evapForm.reset(); loadStock();
    setTimeout(() => setSaved(false), 2000);
  };

  const saveAdjustment = async (data: any) => {
    if (!activeStation) return;
    setSaving(true); setError("");
    const supabase = createClient();
    const qty = parseFloat(data.quantity_litres);
    const finalQty = data.direction === "in" ? qty : -qty;
    const { error: err } = await supabase.from("fuel_stock_movements").insert({
      station_id: activeStation.id,
      product_id: data.product_id,
      movement_date: data.movement_date || today(),
      movement_type: "adjustment",
      quantity_litres: finalQty,
      notes: `Manual adjustment (${data.direction === "in" ? "+" : "-"}): ${data.notes || ""}`,
      entered_by: data.entered_by || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true); adjustForm.reset(); loadStock();
    setTimeout(() => setSaved(false), 2000);
  };

  const TABS = [
    { id: "levels" as const,     label: "Current Stock Levels" },
    { id: "opening" as const,    label: "Set Opening Balance" },
    { id: "evaporation" as const,label: "Record Evaporation" },
    { id: "adjustment" as const, label: "Manual Adjustment" },
  ];

  return (
    <>
      <Header title="Fuel Stock Management" />
      <div className="p-6 space-y-5">

        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setError(""); setSaved(false); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${activeTab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* STOCK LEVELS */}
        {activeTab === "levels" && (
          <div className="space-y-4">
            {!activeStation ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Select a station from the top bar.</div>
            ) : loading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading stock...</div>
            ) : stock.length === 0 ? (
              <div className="card p-10 text-center">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No stock data yet</p>
                <p className="text-sm text-gray-400 mt-1">Set opening balances first, or record and confirm a fuel delivery</p>
                <button onClick={() => setActiveTab("opening")} className="btn-primary mt-4 inline-flex">
                  Set Opening Balance
                </button>
              </div>
            ) : (
              <>
                {stock.some((s) => s.current_stock_litres <= 0) && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm font-medium">
                      Stock depleted for: {stock.filter((s) => s.current_stock_litres <= 0).map((s) => s.product_name).join(", ")}.
                      Sales for these products are blocked until a delivery is received and confirmed.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stock.map((s) => {
                    const c = getColors(s.current_stock_litres);
                    const maxStock = s.opening_balance_litres + s.total_delivered_litres;
                    const fillPct = maxStock > 0 ? Math.min((s.current_stock_litres / maxStock) * 100, 100) : 0;
                    return (
                      <div key={`${s.station_id}-${s.product_id}`}
                        className={`card p-5 border-2 ${c.border} ${c.bg}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-gray-800">{s.product_name}</p>
                            <p className="text-xs text-gray-400">{s.product_code}</p>
                          </div>
                          <span className={`text-2xl font-black ${c.text}`}>
                            {s.current_stock_litres <= 0 ? "EMPTY" : `${Math.round(s.current_stock_litres)}L`}
                          </span>
                        </div>
                        <div className="bg-white/60 rounded-full h-2.5 mb-4">
                          <div className={`h-2.5 rounded-full transition-all ${c.bar}`}
                            style={{ width: `${fillPct}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Opening:</span>
                            <span className="font-medium">{formatLitres(s.opening_balance_litres)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Delivered:</span>
                            <span className="font-medium text-green-700">+{formatLitres(s.total_delivered_litres)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Sold:</span>
                            <span className="font-medium text-red-600">-{formatLitres(s.total_sold_litres)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Evaporation:</span>
                            <span className="font-medium text-amber-600">-{formatLitres(s.total_evaporation_litres)}</span>
                          </div>
                          {s.total_adjustments_litres !== 0 && (
                            <div className="flex justify-between col-span-2">
                              <span className="text-gray-500">Adjustments:</span>
                              <span className={`font-medium ${s.total_adjustments_litres > 0 ? "text-blue-600" : "text-red-600"}`}>
                                {s.total_adjustments_litres > 0 ? "+" : ""}{formatLitres(s.total_adjustments_litres)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={`mt-3 pt-3 border-t ${c.border} flex justify-between items-center`}>
                          <span className="text-xs text-gray-500">Current Stock</span>
                          <span className={`font-bold text-sm ${c.text}`}>{formatLitres(s.current_stock_litres)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* OPENING BALANCE */}
        {activeTab === "opening" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800">Set Opening Stock Balance</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Do this once per product when first setting up the station. Enter how many litres are physically in the tank right now using a dip rod reading.
                </p>
              </div>
              <form onSubmit={openingForm.handleSubmit(saveOpening)} className="space-y-4">
                <div>
                  <label className="form-label">Station</label>
                  <input className="form-input bg-gray-50 cursor-not-allowed" value={activeStation?.name ?? "—"} disabled />
                </div>
                <div>
                  <label className="form-label">Product *</label>
                  <select className="form-select" {...openingForm.register("product_id", { required: true })}>
                    <option value="">Select fuel product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Current Litres in Tank *</label>
                  <input type="number" step="0.001" min="0" className="form-input"
                    placeholder="e.g. 8500.000" {...openingForm.register("quantity_litres", { required: true })} />
                  <p className="text-xs text-gray-400 mt-1">Use a dip rod reading converted with the tank calibration chart</p>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" defaultValue={today()} {...openingForm.register("movement_date")} />
                </div>
                <div>
                  <label className="form-label">Entered By</label>
                  <input type="text" className="form-input" {...openingForm.register("entered_by")} />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" className="btn-primary w-full justify-center" disabled={saving || !activeStation}>
                  {saved ? <><CheckCircle size={16} /> Saved!</>
                    : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : "Set Opening Balance"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* EVAPORATION */}
        {activeTab === "evaporation" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Droplets size={18} className="text-blue-500" /> Record Daily Evaporation Loss
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Fuel evaporates naturally, especially on hot days. Industry standard is 0.1 to 0.5 percent of total stock per day. Record this daily to keep stock figures accurate.
                </p>
              </div>
              <form onSubmit={evapForm.handleSubmit(saveEvaporation)} className="space-y-4">
                <div>
                  <label className="form-label">Product *</label>
                  <select className="form-select" {...evapForm.register("product_id", { required: true })}>
                    <option value="">Select fuel product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Evaporation Loss (litres) *</label>
                  <input type="number" step="0.001" min="0" className="form-input"
                    placeholder="e.g. 12.500" {...evapForm.register("quantity_litres", { required: true })} />
                </div>
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" defaultValue={today()} {...evapForm.register("movement_date")} />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <input type="text" className="form-input" placeholder="e.g. Daily reading — very hot day"
                    {...evapForm.register("notes")} />
                </div>
                <div>
                  <label className="form-label">Entered By</label>
                  <input type="text" className="form-input" {...evapForm.register("entered_by")} />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" className="btn-primary w-full justify-center" disabled={saving || !activeStation}>
                  {saved ? <><CheckCircle size={16} /> Recorded!</>
                    : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : "Record Evaporation Loss"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADJUSTMENT */}
        {activeTab === "adjustment" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-800">Manual Stock Adjustment</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Use for corrections, spillage write-offs, calibration corrections, or any other special case.
                  Every adjustment is permanently logged with the reason.
                </p>
              </div>
              <form onSubmit={adjustForm.handleSubmit(saveAdjustment)} className="space-y-4">
                <div>
                  <label className="form-label">Product *</label>
                  <select className="form-select" {...adjustForm.register("product_id", { required: true })}>
                    <option value="">Select fuel product...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Direction *</label>
                  <select className="form-select" {...adjustForm.register("direction", { required: true })}>
                    <option value="in">Add to Stock (+)</option>
                    <option value="out">Remove from Stock (−)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Quantity (litres) *</label>
                  <input type="number" step="0.001" min="0" className="form-input"
                    placeholder="e.g. 50.000" {...adjustForm.register("quantity_litres", { required: true })} />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" defaultValue={today()} {...adjustForm.register("movement_date")} />
                </div>
                <div>
                  <label className="form-label">Reason / Notes *</label>
                  <textarea className="form-input" rows={2}
                    placeholder="Explain why this adjustment is needed..."
                    {...adjustForm.register("notes", { required: true })} />
                </div>
                <div>
                  <label className="form-label">Entered By</label>
                  <input type="text" className="form-input" {...adjustForm.register("entered_by")} />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" className="btn-primary w-full justify-center" disabled={saving || !activeStation}>
                  {saved ? <><CheckCircle size={16} /> Saved!</>
                    : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                    : "Save Adjustment"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}