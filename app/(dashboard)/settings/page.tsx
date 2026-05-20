"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { Omc, Station, Product, Tank, Pump, CreditCustomer } from "@/types/database";
import { Building2, Fuel, Truck, Users, Settings, Plus, Loader2, CheckCircle } from "lucide-react";

type Tab = "stations" | "omcs" | "products" | "infrastructure" | "credit_customers";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("stations");
  const tabs = [
    { id: "stations" as Tab, label: "Stations", icon: Building2 },
    { id: "omcs" as Tab, label: "OMCs", icon: Truck },
    { id: "products" as Tab, label: "Products", icon: Fuel },
    { id: "infrastructure" as Tab, label: "Tanks & Pumps", icon: Settings },
    { id: "credit_customers" as Tab, label: "Credit Customers", icon: Users },
  ];
  return (
    <>
      <Header title="Settings" />
      <div className="p-6 space-y-5">
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <Icon size={15} />{t.label}
              </button>
            );
          })}
        </div>
        {tab === "stations" && <StationsTab />}
        {tab === "omcs" && <OmcsTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "infrastructure" && <InfrastructureTab />}
        {tab === "credit_customers" && <CreditCustomersTab />}
      </div>
    </>
  );
}

// ─── STATIONS ─────────────────────────────────────────
function StationsTab() {
  const [stations, setStations] = useState<Station[]>([]);
  const [omcs, setOmcs] = useState<Omc[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  const load = async () => {
    const supabase = createClient();
    const [sRes, oRes] = await Promise.all([
      supabase.from("stations").select("*").order("is_main_branch", { ascending: false }).order("name"),
      supabase.from("omcs").select("*").order("brand_name"),
    ]);
    if (sRes.data) setStations(sRes.data);
    if (oRes.data) setOmcs(oRes.data);
  };
  useEffect(() => { load(); }, []);

  const onSubmit = async (data: any) => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("stations").insert({
      name: data.name, location: data.location || null, region: data.region || null,
      district: data.district || null, contact_person: data.contact_person || null,
      contact_phone: data.contact_phone || null, omc_id: data.omc_id || null,
      ownership_model: data.ownership_model || null,
      is_main_branch: data.is_main_branch === "true",
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Station</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><label className="form-label">Station Name *</label>
            <input className="form-input" placeholder="e.g. Kampala Road Station" {...register("name", { required: true })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">District</label>
              <input className="form-input" placeholder="e.g. Kampala" {...register("district")} /></div>
            <div><label className="form-label">Region</label>
              <input className="form-input" placeholder="e.g. Central" {...register("region")} /></div>
          </div>
          <div><label className="form-label">Location / Address</label>
            <input className="form-input" {...register("location")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label>
              <input className="form-input" {...register("contact_person")} /></div>
            <div><label className="form-label">Phone</label>
              <input className="form-input" {...register("contact_phone")} /></div>
          </div>
          <div><label className="form-label">OMC Supplier</label>
            <select className="form-select" {...register("omc_id")}>
              <option value="">Select OMC...</option>
              {omcs.map((o) => <option key={o.id} value={o.id}>{o.brand_name ?? o.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Ownership Model</label>
              <select className="form-select" {...register("ownership_model")}>
                <option value="">Select...</option>
                <option value="COCO">COCO</option><option value="CODO">CODO</option>
                <option value="DODO">DODO</option><option value="DOCO">DOCO</option>
              </select></div>
            <div><label className="form-label">Is Main Branch?</label>
              <select className="form-select" {...register("is_main_branch")}>
                <option value="false">No — Branch Station</option>
                <option value="true">Yes — Main Branch (HQ)</option>
              </select></div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Add Station"}
          </button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Registered Stations ({stations.length})</div>
        <div className="divide-y divide-gray-50">
          {stations.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <p className="font-medium text-sm text-gray-800">{s.name}
                {s.is_main_branch && <span className="ml-2 badge bg-blue-100 text-blue-700 text-[10px]">Main</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{[s.district, s.region].filter(Boolean).join(", ") || "No location set"}</p>
            </div>
          ))}
          {stations.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No stations yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── OMCs ──────────────────────────────────────────────
function OmcsTab() {
  const [omcs, setOmcs] = useState<Omc[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();
  const load = async () => { const supabase = createClient(); const { data } = await supabase.from("omcs").select("*").order("brand_name"); if (data) setOmcs(data); };
  useEffect(() => { load(); }, []);
  const onSubmit = async (data: any) => {
    setSaving(true); const supabase = createClient();
    await supabase.from("omcs").insert({ name: data.name, brand_name: data.brand_name || null, contact_person: data.contact_person || null, contact_phone: data.contact_phone || null, email: data.email || null });
    setSaving(false); setSaved(true); reset(); load(); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add OMC</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><label className="form-label">Full Company Name *</label><input className="form-input" placeholder="e.g. TotalEnergies Marketing Uganda Ltd" {...register("name", { required: true })} /></div>
          <div><label className="form-label">Brand Name</label><input className="form-input" placeholder="e.g. Total" {...register("brand_name")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label><input className="form-input" {...register("contact_person")} /></div>
            <div><label className="form-label">Phone</label><input className="form-input" {...register("contact_phone")} /></div>
          </div>
          <div><label className="form-label">Email</label><input className="form-input" type="email" {...register("email")} /></div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <Loader2 size={16} className="animate-spin" /> : "Add OMC"}</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">OMCs ({omcs.length})</div>
        <div className="divide-y divide-gray-50">
          {omcs.map((o) => (<div key={o.id} className="px-4 py-3"><p className="font-medium text-sm">{o.brand_name ?? o.name}</p><p className="text-xs text-gray-400">{o.name}</p></div>))}
          {omcs.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No OMCs yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCTS ──────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();
  const load = async () => { const supabase = createClient(); const { data } = await supabase.from("products").select("*").order("product_type").order("name"); if (data) setProducts(data); };
  useEffect(() => { load(); }, []);
  const onSubmit = async (data: any) => {
    setSaving(true); const supabase = createClient();
    await supabase.from("products").insert({ name: data.name, product_code: data.product_code || null, product_type: data.product_type, unit: data.unit, is_fuel: ["fuel","lpg","adblue"].includes(data.product_type) });
    setSaving(false); setSaved(true); reset(); load(); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Product</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><label className="form-label">Product Name *</label><input className="form-input" placeholder="e.g. Petrol (ULG)" {...register("name", { required: true })} /></div>
          <div><label className="form-label">Product Code</label><input className="form-input" placeholder="e.g. ULG, AGO, IK" {...register("product_code")} /></div>
          <div><label className="form-label">Type *</label>
            <select className="form-select" {...register("product_type", { required: true })}>
              <option value="">Select type...</option>
              <option value="fuel">Fuel (Petrol / Diesel / Kerosene)</option>
              <option value="lubricant">Lubricant / Engine Oil</option>
              <option value="lpg">LPG (Cooking Gas)</option>
              <option value="adblue">AdBlue / DEF</option>
              <option value="car_wash">Car Wash Service</option>
              <option value="shop_item">Shop / Convenience Item</option>
            </select></div>
          <div><label className="form-label">Unit *</label>
            <select className="form-select" {...register("unit", { required: true })}>
              <option value="litres">Litres</option>
              <option value="pieces">Pieces</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="service">Service (flat)</option>
            </select></div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <Loader2 size={16} className="animate-spin" /> : "Add Product"}</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Products ({products.length})</div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {products.map((p) => (<div key={p.id} className="px-4 py-3 flex justify-between items-center"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.product_code} · {p.unit}</p></div><span className="badge bg-gray-100 text-gray-600 text-xs">{p.product_type}</span></div>))}
          {products.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No products yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── TANKS & PUMPS ─────────────────────────────────────
function InfrastructureTab() {
  const [stations, setStations] = useState<Station[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [saving, setSaving] = useState<"tank" | "pump" | "nozzle" | null>(null);
  const [saved, setSaved] = useState<"tank" | "pump" | "nozzle" | null>(null);
  const tankForm = useForm<any>();
  const pumpForm = useForm<any>();
  const nozzleForm = useForm<any>();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [sRes, pRes] = await Promise.all([
        supabase.from("stations").select("*").order("name"),
        supabase.from("products").select("*").eq("is_fuel", true).order("name"),
      ]);
      if (sRes.data) setStations(sRes.data);
      if (pRes.data) setProducts(pRes.data);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedStation) return;
    const load = async () => {
      const supabase = createClient();
      const [tRes, puRes] = await Promise.all([
        supabase.from("tanks").select("*, product:products(name)").eq("station_id", selectedStation).order("tank_number"),
        supabase.from("pumps").select("*").eq("station_id", selectedStation).order("pump_number"),
      ]);
      if (tRes.data) setTanks(tRes.data);
      if (puRes.data) setPumps(puRes.data);
    };
    load();
  }, [selectedStation]);

  const saveTank = async (data: any) => {
    setSaving("tank"); const supabase = createClient();
    await supabase.from("tanks").insert({ station_id: selectedStation, product_id: data.product_id, tank_name: data.tank_name, tank_number: parseInt(data.tank_number), capacity_litres: parseFloat(data.capacity_litres) });
    setSaving(null); setSaved("tank"); tankForm.reset();
    const { data: t } = await supabase.from("tanks").select("*, product:products(name)").eq("station_id", selectedStation).order("tank_number");
    if (t) setTanks(t); setTimeout(() => setSaved(null), 2000);
  };

  const savePump = async (data: any) => {
    setSaving("pump"); const supabase = createClient();
    await supabase.from("pumps").insert({ station_id: selectedStation, pump_name: data.pump_name, pump_number: parseInt(data.pump_number), pump_model: data.pump_model || null });
    setSaving(null); setSaved("pump"); pumpForm.reset();
    const { data: p } = await supabase.from("pumps").select("*").eq("station_id", selectedStation).order("pump_number");
    if (p) setPumps(p); setTimeout(() => setSaved(null), 2000);
  };

  const saveNozzle = async (data: any) => {
    setSaving("nozzle"); const supabase = createClient();
    const tank = tanks.find((t) => t.id === data.tank_id);
    await supabase.from("nozzles").insert({ pump_id: data.pump_id, station_id: selectedStation, product_id: tank?.product_id ?? "", tank_id: data.tank_id, nozzle_label: data.nozzle_label, nozzle_number: parseInt(data.nozzle_number) });
    setSaving(null); setSaved("nozzle"); nozzleForm.reset(); setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label className="form-label">Select Station to Configure</label>
        <select className="form-select w-72" value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
          <option value="">Choose station...</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {selectedStation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-800">Tanks ({tanks.length})</h3>
            <form onSubmit={tankForm.handleSubmit(saveTank)} className="space-y-2">
              <input className="form-input" placeholder="Tank name (e.g. Tank 1 - Diesel)" {...tankForm.register("tank_name", { required: true })} />
              <input className="form-input" type="number" placeholder="Tank number (1, 2, 3...)" {...tankForm.register("tank_number", { required: true })} />
              <select className="form-select" {...tankForm.register("product_id", { required: true })}>
                <option value="">Product in tank...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input className="form-input" type="number" step="0.01" placeholder="Capacity (litres)" {...tankForm.register("capacity_litres", { required: true })} />
              <button type="submit" className="btn-primary btn-sm w-full" disabled={saving === "tank"}>{saved === "tank" ? "✓ Saved" : saving === "tank" ? "Saving..." : "Add Tank"}</button>
            </form>
            <div className="divide-y divide-gray-50">
              {tanks.map((t) => (<div key={t.id} className="py-2"><p className="text-sm font-medium text-gray-700">{t.tank_name}</p><p className="text-xs text-gray-400">{(t.product as any)?.name} · {t.capacity_litres.toLocaleString()} L</p></div>))}
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-800">Pumps ({pumps.length})</h3>
            <form onSubmit={pumpForm.handleSubmit(savePump)} className="space-y-2">
              <input className="form-input" placeholder="Pump name (e.g. Pump 1)" {...pumpForm.register("pump_name", { required: true })} />
              <input className="form-input" type="number" placeholder="Pump number" {...pumpForm.register("pump_number", { required: true })} />
              <input className="form-input" placeholder="Model (e.g. Wayne, Tokheim)" {...pumpForm.register("pump_model")} />
              <button type="submit" className="btn-primary btn-sm w-full" disabled={saving === "pump"}>{saved === "pump" ? "✓ Saved" : saving === "pump" ? "Saving..." : "Add Pump"}</button>
            </form>
            <div className="divide-y divide-gray-50">
              {pumps.map((p) => (<div key={p.id} className="py-2"><p className="text-sm font-medium text-gray-700">{p.pump_name}</p><p className="text-xs text-gray-400">{p.pump_model ?? "No model"}</p></div>))}
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-gray-800">Nozzles</h3>
            <form onSubmit={nozzleForm.handleSubmit(saveNozzle)} className="space-y-2">
              <select className="form-select" {...nozzleForm.register("pump_id", { required: true })}>
                <option value="">Select pump...</option>
                {pumps.map((p) => <option key={p.id} value={p.id}>{p.pump_name}</option>)}
              </select>
              <select className="form-select" {...nozzleForm.register("tank_id", { required: true })}>
                <option value="">Tank it draws from...</option>
                {tanks.map((t) => <option key={t.id} value={t.id}>{t.tank_name}</option>)}
              </select>
              <input className="form-input" placeholder="Nozzle label (e.g. A, Diesel)" {...nozzleForm.register("nozzle_label", { required: true })} />
              <input className="form-input" type="number" placeholder="Nozzle number (1, 2...)" {...nozzleForm.register("nozzle_number", { required: true })} />
              <button type="submit" className="btn-primary btn-sm w-full" disabled={saving === "nozzle"}>{saved === "nozzle" ? "✓ Saved" : saving === "nozzle" ? "Saving..." : "Add Nozzle"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CREDIT CUSTOMERS ──────────────────────────────────
function CreditCustomersTab() {
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();
  const load = async () => { const supabase = createClient(); const { data } = await supabase.from("credit_customers").select("*").order("name"); if (data) setCustomers(data); };
  useEffect(() => { load(); }, []);
  const onSubmit = async (data: any) => {
    setSaving(true); const supabase = createClient();
    await supabase.from("credit_customers").insert({ name: data.name, contact_person: data.contact_person || null, phone: data.phone || null, email: data.email || null, address: data.address || null, tin_number: data.tin_number || null, credit_limit_ugx: parseFloat(data.credit_limit_ugx || "0"), payment_terms_days: parseInt(data.payment_terms_days || "30") });
    setSaving(false); setSaved(true); reset(); load(); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Credit Customer</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><label className="form-label">Company / Customer Name *</label><input className="form-input" placeholder="e.g. Roofings Group Ltd" {...register("name", { required: true })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label><input className="form-input" {...register("contact_person")} /></div>
            <div><label className="form-label">Phone</label><input className="form-input" {...register("phone")} /></div>
          </div>
          <div><label className="form-label">Email</label><input className="form-input" type="email" {...register("email")} /></div>
          <div><label className="form-label">Address</label><input className="form-input" {...register("address")} /></div>
          <div><label className="form-label">TIN Number</label><input className="form-input" placeholder="e.g. 1234567890" {...register("tin_number")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Credit Limit (UGX) *</label><input className="form-input" type="number" placeholder="e.g. 5000000" {...register("credit_limit_ugx", { required: true })} /></div>
            <div><label className="form-label">Payment Terms (days)</label><input className="form-input" type="number" defaultValue="30" {...register("payment_terms_days")} /></div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saved ? <><CheckCircle size={16} /> Saved!</> : saving ? <Loader2 size={16} className="animate-spin" /> : "Add Customer"}</button>
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">Credit Customers ({customers.length})</div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {customers.map((c) => (<div key={c.id} className="px-4 py-3"><p className="font-medium text-sm text-gray-800">{c.name}</p><p className="text-xs text-gray-400">Limit: {c.credit_limit_ugx.toLocaleString()} UGX · {c.payment_terms_days} days</p></div>))}
          {customers.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No credit customers yet</div>}
        </div>
      </div>
    </div>
  );
}