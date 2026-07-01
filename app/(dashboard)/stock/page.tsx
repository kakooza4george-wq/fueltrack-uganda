"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatLitres, today } from "@/utils";
import { Package, CheckCircle, Loader2, AlertTriangle, Droplets, Plus } from "lucide-react";

export default function StockPage() {
  const { activeStation } = useStation();
  const [stock, setStock]   = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab] = useState<"levels"|"opening"|"evaporation"|"adjustment">("levels");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  const [productId, setProductId] = useState("");
  const [qty, setQty]             = useState("");
  const [moveDate, setMoveDate]   = useState(today());
  const [direction, setDirection] = useState("out");
  const [moveNotes, setMoveNotes] = useState("");
  const [enteredBy, setEnteredBy] = useState("");

  const loadStock = async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();
    const [sRes, pRes] = await Promise.all([
      supabase.from("vw_current_stock").select("*").eq("station_id", activeStation.id),
      supabase.from("products").select("id,name").eq("is_fuel", true).eq("is_active", true).order("name"),
    ]);
    if (sRes.data) setStock(sRes.data);
    if (pRes.data) setProducts(pRes.data);
    setLoading(false);
  };

  useEffect(() => { loadStock(); }, [activeStation]);

  const getColors = (litres: number) => {
    if (litres <= 0)   return { bar:"bg-red-500",   text:"text-red-700",   border:"border-red-300",   bg:"bg-red-50" };
    if (litres < 2000) return { bar:"bg-amber-500", text:"text-amber-700", border:"border-amber-300", bg:"bg-amber-50" };
    return               { bar:"bg-green-500", text:"text-green-700", border:"border-green-300", bg:"bg-green-50" };
  };

  const saveMovement = async (type: "opening_balance"|"evaporation"|"adjustment") => {
    if (!activeStation || !productId || !qty) { setError("Fill in all required fields."); return; }
    setSaving(true); setError("");
    const supabase = createClient();

    if (type === "opening_balance") {
      const { data: existing } = await supabase.from("fuel_stock_movements")
        .select("id").eq("station_id", activeStation.id)
        .eq("product_id", productId).eq("movement_type", "opening_balance").single();
      if (existing) {
        setError("Opening balance already set for this product. Use Manual Adjustment to correct stock.");
        setSaving(false); return;
      }
    }

    const quantity =
      type === "adjustment" && direction === "out" ? -Math.abs(parseFloat(qty)) :
      type === "evaporation"                       ? -Math.abs(parseFloat(qty)) :
                                                      Math.abs(parseFloat(qty));

    const { error: err } = await supabase.from("fuel_stock_movements").insert({
      station_id: activeStation.id, product_id: productId,
      movement_date: moveDate, movement_type: type,
      quantity_litres: quantity, notes: moveNotes || null, entered_by: enteredBy || null,
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true);
    setProductId(""); setQty(""); setMoveNotes("");
    loadStock(); setTimeout(() => setSaved(false), 2000);
  };

  const SaveBtn = ({ type }: { type: "opening_balance"|"evaporation"|"adjustment" }) => (
    <button type="button" onClick={() => saveMovement(type)}
      className="btn-primary w-full justify-center" disabled={saving || !activeStation}>
      {saved ? <><CheckCircle size={16} /> Saved!</>
        : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
        : type === "opening_balance" ? "Set Opening Balance"
        : type === "evaporation"     ? "Record Evaporation Loss"
        : "Save Adjustment"}
    </button>
  );

  const FormFields = () => (
    <div className="space-y-3">
      <div>
        <label className="form-label">Product *</label>
        <select className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select fuel product...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">
          {tab === "opening" ? "Current Litres in Tank *" :
           tab === "evaporation" ? "Evaporation Loss (litres) *" :
           "Quantity (litres) *"}
        </label>
        <input type="number" step="0.001" min="0" className="form-input"
          placeholder="e.g. 8500.000" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      {tab === "adjustment" && (
        <div>
          <label className="form-label">Direction *</label>
          <select className="form-select" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="in">Add to Stock (+)</option>
            <option value="out">Remove from Stock (−)</option>
          </select>
        </div>
      )}
      <div>
        <label className="form-label">Date</label>
        <input type="date" className="form-input" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
      </div>
      <div>
        <label className="form-label">
          {tab === "adjustment" ? "Reason / Notes *" : "Notes"}
        </label>
        <input type="text" className="form-input"
          placeholder={tab === "adjustment" ? "Explain why this adjustment is needed..." : "Optional notes"}
          value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} />
      </div>
      <div>
        <label className="form-label">Entered By</label>
        <input type="text" className="form-input" value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} />
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
    </div>
  );

  return (
    <>
      <Header title="Stock & Tanks" />
      <div className="p-6 space-y-5">
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {[
            { id:"levels",       label:"Live Stock Levels" },
            { id:"opening",      label:"Set Opening Balance" },
            { id:"evaporation",  label:"Record Evaporation" },
            { id:"adjustment",   label:"Manual Adjustment" },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id as any); setError(""); setSaved(false); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${tab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "levels" && (
          <div className="space-y-4">
            {!activeStation ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Select a station.</div>
            ) : loading ? (
              <div className="card p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : stock.length === 0 ? (
              <div className="card p-12 text-center">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-semibold">No stock data yet</p>
                <p className="text-sm text-gray-400 mt-1">Set opening balances or record a confirmed delivery</p>
                <button onClick={() => setTab("opening")} className="btn-primary inline-flex mt-4">
                  <Plus size={16} /> Set Opening Balance
                </button>
              </div>
            ) : (
              <>
                {stock.some((s) => s.current_stock_litres <= 0) && (
                  <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm font-semibold">
                      Empty: {stock.filter((s) => s.current_stock_litres <= 0).map((s) => s.product_name).join(", ")}.
                      Sales blocked until a delivery is confirmed.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stock.map((s) => {
                    const c = getColors(s.current_stock_litres);
                    const max = s.opening_balance_litres + s.total_delivered_litres;
                    const pct = max > 0 ? Math.min((s.current_stock_litres / max) * 100, 100) : 0;
                    return (
                      <div key={`${s.station_id}-${s.product_id}`}
                        className={`card p-5 border-2 ${c.border} ${c.bg}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-gray-800">{s.product_name}</p>
                            <p className="text-xs text-gray-400">{s.product_code}</p>
                          </div>
                          <p className={`text-2xl font-black ${c.text}`}>
                            {s.current_stock_litres <= 0 ? "EMPTY" : `${Math.round(s.current_stock_litres).toLocaleString()}L`}
                          </p>
                        </div>
                        <div className="bg-white/60 rounded-full h-2.5 mb-4">
                          <div className={`h-2.5 rounded-full ${c.bar}`} style={{ width:`${pct}%` }} />
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
                            <span className="font-medium text-red-600">−{formatLitres(s.total_sold_litres)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Evaporation:</span>
                            <span className="font-medium text-amber-600">−{formatLitres(s.total_evaporation_litres)}</span>
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
                        <div className={`mt-3 pt-3 border-t ${c.border} flex justify-between`}>
                          <span className="text-xs text-gray-500">Current Stock</span>
                          <span className={`font-black text-sm ${c.text}`}>{formatLitres(s.current_stock_litres)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "opening" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-bold text-gray-800">Set Opening Stock Balance</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Do this once per product when first setting up the system. Take a physical dip rod reading and convert to litres using the tank calibration chart.
                </p>
              </div>
              <FormFields />
              <SaveBtn type="opening_balance" />
            </div>
          </div>
        )}

        {tab === "evaporation" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Droplets size={18} className="text-blue-500" /> Record Daily Evaporation Loss
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Fuel evaporates naturally — especially petrol on hot days. Record this daily to keep stock figures accurate. Industry standard is 0.1% to 0.5% of total stock per day.
                </p>
              </div>
              <FormFields />
              <SaveBtn type="evaporation" />
            </div>
          </div>
        )}

        {tab === "adjustment" && (
          <div className="max-w-lg">
            <div className="card p-6 space-y-4">
              <div>
                <h3 className="font-bold text-gray-800">Manual Stock Adjustment</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Use for corrections, spillage write-offs, or calibration fixes. Every adjustment is permanently logged with the reason.
                </p>
              </div>
              <FormFields />
              <SaveBtn type="adjustment" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}