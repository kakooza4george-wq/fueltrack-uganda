"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { useStation } from "@/hooks/useStation";
import { formatUGX, formatDate, today } from "@/utils";
import { TrendingUp, CheckCircle, Loader2, AlertTriangle } from "lucide-react";

interface PriceRecord {
  id: string;
  product_id: string;
  product_name: string;
  station_name: string;
  effective_date: string;
  pump_price_ugx: number;
  cost_price_ugx: number | null;
  dealer_margin: number | null;
  notes: string | null;
  changed_by: string | null;
}

interface Product { id: string; name: string; }

export default function PricesPage() {
  const { activeStation, stations } = useStation();
  const [prices, setPrices] = useState<PriceRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, watch, setValue, reset } = useForm<any>({
    defaultValues: { station_id: activeStation?.id ?? "", effective_date: today() },
  });

  const watchedProductId = watch("product_id");
  const pumpPrice = parseFloat(watch("pump_price_ugx") || "0");
  const costPrice = parseFloat(watch("cost_price_ugx") || "0");
  const margin = pumpPrice > 0 && costPrice > 0 ? pumpPrice - costPrice : null;

  useEffect(() => { if (activeStation) setValue("station_id", activeStation.id); }, [activeStation, setValue]);

  const loadData = async () => {
    if (!activeStation) return;
    setLoading(true);
    const supabase = createClient();
    const [priceRes, prodRes] = await Promise.all([
      supabase.from("product_prices")
        .select("*, product:products(name), station:stations(name)")
        .eq("station_id", activeStation.id)
        .order("effective_date", { ascending: false }).limit(60),
      supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (priceRes.data) {
      setPrices(priceRes.data.map((p: any) => ({
        ...p, product_name: p.product?.name ?? "—", station_name: p.station?.name ?? "—",
      })));
    }
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeStation]);

  // Auto-fill last known price when product selected
  useEffect(() => {
    if (!watchedProductId || !activeStation) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("product_prices")
        .select("pump_price_ugx, cost_price_ugx")
        .eq("product_id", watchedProductId).eq("station_id", activeStation.id)
        .order("effective_date", { ascending: false }).limit(1).single();
      if (data) {
        setValue("pump_price_ugx", data.pump_price_ugx?.toString() ?? "");
        setValue("cost_price_ugx", data.cost_price_ugx?.toString() ?? "");
      }
    };
    load();
  }, [watchedProductId, activeStation, setValue]);

  const onSubmit = async (data: any) => {
    setSaving(true); setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("product_prices").insert({
      product_id: data.product_id,
      station_id: data.station_id,
      effective_date: data.effective_date,
      pump_price_ugx: parseFloat(data.pump_price_ugx),
      cost_price_ugx: data.cost_price_ugx ? parseFloat(data.cost_price_ugx) : null,
      changed_by: data.changed_by || null,
      notes: data.notes || null,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setSaved(true);
    reset({ station_id: activeStation?.id ?? "", effective_date: today() });
    loadData();
    setTimeout(() => setSaved(false), 2000);
  };

  // Latest price per product
  const latestByProduct = products.map((prod) => ({
    product: prod,
    price: prices.find((p) => p.product_id === prod.id) ?? null,
  })).filter((x) => x.price !== null);

  return (
    <>
      <Header title="Pump Prices" />
      <div className="p-6 space-y-6">

        {/* Current prices banner */}
        {!loading && latestByProduct.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-600" />
              Current Prices — {activeStation?.name}
            </p>
            <div className="flex flex-wrap gap-3">
              {latestByProduct.map(({ product, price }) => price && (
                <div key={product.id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 min-w-[160px]">
                  <p className="text-xs text-blue-500 font-medium">{product.name}</p>
                  <p className="text-xl font-black text-blue-800 mt-0.5">
                    {formatUGX(price.pump_price_ugx)}
                    <span className="text-xs font-normal text-blue-400">/L</span>
                  </p>
                  {price.dealer_margin != null && (
                    <p className="text-xs text-green-600 mt-1">Margin: {formatUGX(price.dealer_margin)}/L</p>
                  )}
                  <p className="text-[10px] text-blue-400 mt-1">Since {formatDate(price.effective_date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Set price form */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-800">Set or Update Price</h2>
              <p className="text-xs text-gray-400 mt-1">
                Update whenever ERA publishes new prices (usually 1st of each month) or when your OMC cost changes. All history is kept.
              </p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="form-label">Station *</label>
                <select className="form-select" {...register("station_id", { required: true })}>
                  <option value="">Select...</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Product *</label>
                <select className="form-select" {...register("product_id", { required: true })}>
                  <option value="">Select product...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Effective Date *</label>
                <input type="date" className="form-input" {...register("effective_date", { required: true })} />
                <p className="text-xs text-gray-400 mt-1">The date this price takes effect at the pump</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Pump Price (UGX/L) *</label>
                  <input type="number" step="0.01" className="form-input"
                    placeholder="Selling price" {...register("pump_price_ugx", { required: true })} />
                </div>
                <div>
                  <label className="form-label">OMC Cost (UGX/L)</label>
                  <input type="number" step="0.0001" className="form-input"
                    placeholder="What you pay OMC" {...register("cost_price_ugx")} />
                </div>
              </div>
              {margin !== null && !isNaN(margin) && (
                <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${margin > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
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
                  {...register("notes")} />
              </div>
              <div>
                <label className="form-label">Updated By</label>
                <input type="text" className="form-input" {...register("changed_by")} />
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

          {/* Price history */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Price History</h2>
              <p className="text-xs text-gray-400 mt-0.5">{activeStation?.name}</p>
            </div>
            {loading ? (
              <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
            ) : prices.length === 0 ? (
              <div className="p-10 text-center">
                <TrendingUp size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">No prices set yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th className="text-right">Pump Price</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Margin</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-gray-600 text-xs">{formatDate(p.effective_date)}</td>
                        <td className="font-medium text-gray-800">{p.product_name}</td>
                        <td className="text-right font-semibold text-blue-700">{formatUGX(p.pump_price_ugx)}</td>
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