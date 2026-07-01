"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatDate, today } from "@/utils";
import { TrendingUp, CheckCircle, Loader2, AlertTriangle } from "lucide-react";

export default function PricesPage() {
  const { activeStation, stations } = useStation();
  const [prices, setPrices]     = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  const [stationId, setStationId] = useState(activeStation?.id ?? "");
  const [productId, setProductId] = useState("");
  const [effectiveDate, setDate]  = useState(today());
  const [pumpPrice, setPumpPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [changedBy, setChangedBy] = useState("");
  const [notes, setNotes]         = useState("");

  const margin = pumpPrice && costPrice
    ? parseFloat(pumpPrice) - parseFloat(costPrice) : null;

  useEffect(() => { if (activeStation) setStationId(activeStation.id); }, [activeStation]);

  const loadData = async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();
    const [pRes, prodRes] = await Promise.all([
      supabase.from("product_prices")
        .select("*, product:products(name), station:stations(name)")
        .eq("station_id", activeStation.id)
        .order("effective_date", { ascending: false }).limit(60),
      supabase.from("products").select("id,name").eq("is_active", true).order("name"),
    ]);
    if (pRes.data) setPrices(pRes.data.map((p: any) => ({ ...p, product_name: p.product?.name ?? "—" })));
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeStation]);

  useEffect(() => {
    if (!productId || !stationId) return;
    const fill = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("product_prices")
        .select("pump_price_ugx, cost_price_ugx")
        .eq("product_id", productId).eq("station_id", stationId)
        .order("effective_date", { ascending: false }).limit(1).single();
      if (data) {
        setPumpPrice(data.pump_price_ugx?.toString() ?? "");
        setCostPrice(data.cost_price_ugx?.toString() ?? "");
      }
    };
    fill();
  }, [productId, stationId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("product_prices").insert({
      product_id: productId, station_id: stationId,
      effective_date: effectiveDate,
      pump_price_ugx: parseFloat(pumpPrice),
      cost_price_ugx: costPrice ? parseFloat(costPrice) : null,
      changed_by: changedBy || null, notes: notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true);
    setProductId(""); setPumpPrice(""); setCostPrice(""); setNotes("");
    loadData(); setTimeout(() => setSaved(false), 2000);
  };

  const latestPrices = products.map((prod) => ({
    product: prod, price: prices.find((p) => p.product_id === prod.id),
  })).filter((x) => x.price);

  return (
    <>
      <Header title="Pump Prices" />
      <div className="p-6 space-y-6">

        {!loading && latestPrices.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-bold text-gray-600 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Current Prices — {activeStation?.name}
            </p>
            <div className="flex flex-wrap gap-3">
              {latestPrices.map(({ product, price }) => (
                <div key={product.id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 min-w-[150px]">
                  <p className="text-xs text-blue-500 font-semibold">{product.name}</p>
                  <p className="text-2xl font-black text-blue-800 mt-0.5">
                    {formatUGX(price.pump_price_ugx)}<span className="text-xs font-normal text-blue-400">/L</span>
                  </p>
                  {price.dealer_margin != null && (
                    <p className="text-xs text-green-600 mt-1">Margin: {formatUGX(price.dealer_margin)}/L</p>
                  )}
                  <p className="text-[10px] text-blue-400 mt-0.5">Since {formatDate(price.effective_date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Set / Update Price</h2>
              <p className="text-xs text-gray-400 mt-1">
                Update when ERA publishes new prices (usually 1st of month) or when OMC cost changes. Full history is always kept.
              </p>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" value={stationId}
                  onChange={(e) => setStationId(e.target.value)} required>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Product *</label>
                <select className="form-select" value={productId}
                  onChange={(e) => setProductId(e.target.value)} required>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Effective Date *</label>
                <input type="date" className="form-input" value={effectiveDate}
                  onChange={(e) => setDate(e.target.value)} required />
                <p className="text-xs text-gray-400 mt-1">The date this price takes effect at the pump</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Pump Price (UGX/L) *</label>
                  <input type="number" step="0.01" className="form-input"
                    placeholder="Selling price" value={pumpPrice}
                    onChange={(e) => setPumpPrice(e.target.value)} required />
                </div>
                <div>
                  <label className="form-label">OMC Cost (UGX/L)</label>
                  <input type="number" step="0.0001" className="form-input"
                    placeholder="What you pay OMC" value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)} />
                </div>
              </div>
              {margin !== null && !isNaN(margin) && (
                <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                  margin > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <span className="text-sm text-gray-600 font-medium">Your dealer margin</span>
                  <span className={`font-black text-xl ${margin > 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatUGX(margin)}/L
                  </span>
                </div>
              )}
              <div>
                <label className="form-label">Reason for Change</label>
                <input type="text" className="form-input"
                  placeholder="e.g. ERA price change effective 1 June 2025"
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Updated By</label>
                <input type="text" className="form-input"
                  value={changedBy} onChange={(e) => setChangedBy(e.target.value)} />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg flex gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}
              <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
                {saved ? <><CheckCircle size={16} /> Price Saved!</>
                  : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                  : "Save Price"}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Price History</h2>
              <p className="text-xs text-gray-400 mt-0.5">{activeStation?.name}</p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : prices.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No prices set yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Product</th>
                      <th className="text-right">Pump Price</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Margin</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.id}>
                        <td className="text-xs text-gray-500 whitespace-nowrap">{formatDate(p.effective_date)}</td>
                        <td className="font-medium text-gray-800">{p.product_name}</td>
                        <td className="text-right font-bold text-blue-700">{formatUGX(p.pump_price_ugx)}</td>
                        <td className="text-right text-gray-500 text-xs">{p.cost_price_ugx ? formatUGX(p.cost_price_ugx) : "—"}</td>
                        <td className="text-right text-green-700 font-medium text-xs">{p.dealer_margin ? formatUGX(p.dealer_margin) : "—"}</td>
                        <td className="text-gray-400 text-xs">{p.changed_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}