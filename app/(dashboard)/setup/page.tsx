"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import {
  CheckCircle, Loader2, Plus, AlertTriangle,
  Pencil, Save, X, ShieldAlert, ShieldCheck
} from "lucide-react";

type Tab =
  | "stations"
  | "omcs"
  | "products"
  | "tanks_pumps"
  | "employees"
  | "credit_customers"
  | "integrity";

export default function SetupPage() {
  const [tab, setTab] = useState<Tab>("integrity");

  const TABS = [
    { id: "integrity",        label: "🔍 Integrity Check", highlight: true },
    { id: "stations",         label: "Stations" },
    { id: "omcs",             label: "OMC Suppliers" },
    { id: "products",         label: "Products" },
    { id: "tanks_pumps",      label: "Tanks & Pumps" },
    { id: "employees",        label: "Employees" },
    { id: "credit_customers", label: "Credit Customers" },
  ];

  return (
    <>
      <Header title="System Setup" />
      <div className="p-6 space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>Tip:</strong> Start with the <strong>Integrity Check</strong> tab to see if
          anything needs attention. Then configure Stations → OMC Suppliers → Products →
          Tanks & Pumps in that order.
        </div>

        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${tab === t.id
                  ? "border-blue-700 text-blue-700"
                  : t.highlight
                  ? "border-transparent text-amber-600 hover:text-amber-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "integrity"        && <IntegrityTab />}
        {tab === "stations"         && <StationsTab />}
        {tab === "omcs"             && <OmcsTab />}
        {tab === "products"         && <ProductsTab />}
        {tab === "tanks_pumps"      && <TanksPumpsTab />}
        {tab === "employees"        && <EmployeesTab />}
        {tab === "credit_customers" && <CreditCustomersTab />}
      </div>
    </>
  );
}

// ── INTEGRITY CHECK TAB ────────────────────────────────
function IntegrityTab() {
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: d } = await supabase
        .from("vw_stock_integrity_check")
        .select("*")
        .order("station_name")
        .order("tank_number");
      if (d) setData(d);
      setLoading(false);
    };
    load();
  }, []);

  const issues  = data.filter((d) => d.integrity_status !== "OK");
  const ok      = data.filter((d) => d.integrity_status === "OK");

  if (loading) return (
    <div className="card p-10 text-center text-gray-400 text-sm">Checking system...</div>
  );

  const statusConfig: Record<string, { label: string; bg: string; border: string; text: string; icon: any }> = {
    OVER_CAPACITY:  { label: "Over Capacity",  bg: "bg-red-50",    border: "border-red-300",    text: "text-red-700",    icon: ShieldAlert   },
    NEGATIVE_STOCK: { label: "Negative Stock", bg: "bg-red-50",    border: "border-red-300",    text: "text-red-700",    icon: ShieldAlert   },
    CRITICAL_LOW:   { label: "Critical Low",   bg: "bg-red-50",    border: "border-red-200",    text: "text-red-600",    icon: AlertTriangle },
    LOW:            { label: "Low Stock",      bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  icon: AlertTriangle },
    EMPTY:          { label: "Empty",          bg: "bg-gray-50",   border: "border-gray-200",   text: "text-gray-600",   icon: AlertTriangle },
    OK:             { label: "OK",             bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  icon: ShieldCheck   },
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Tanks",   value: data.length,                                          color: "text-gray-800"  },
          { label: "Issues Found",  value: issues.length,                                        color: issues.length > 0 ? "text-red-600" : "text-green-600" },
          { label: "Missing Price", value: data.filter((d) => d.missing_price).length,           color: data.filter((d) => d.missing_price).length > 0 ? "text-amber-600" : "text-green-600" },
          { label: "No Nozzles",    value: data.filter((d) => d.missing_nozzles).length,         color: data.filter((d) => d.missing_nozzles).length > 0 ? "text-amber-600" : "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {issues.length === 0 && (
        <div className="card p-5 flex items-center gap-3 bg-green-50 border border-green-200">
          <ShieldCheck size={28} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-800">All systems healthy</p>
            <p className="text-green-600 text-sm">
              All tanks are within capacity and have no data integrity issues.
            </p>
          </div>
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-800 text-lg">Issues Requiring Action</h3>
          {issues.map((d, i) => {
            const cfg = statusConfig[d.integrity_status] ?? statusConfig.OK;
            const Icon = cfg.icon;
            return (
              <div key={i} className={`card p-4 border-l-4 ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={20} className={`${cfg.text} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <p className={`font-bold ${cfg.text}`}>
                      {cfg.label}: {d.tank_name} — {d.station_name}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Product: {d.product_name} ·
                      Capacity: {Number(d.capacity_litres).toLocaleString()} L ·
                      Current stock: {Number(d.current_stock_litres).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} L
                      ({d.fill_pct}% full)
                    </p>
                    {d.integrity_status === "OVER_CAPACITY" && (
                      <div className="mt-2 text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">
                        <p className="font-semibold">This tank is holding more fuel than its capacity.</p>
                        <p className="mt-1 text-xs">
                          Overflow: {Number(d.current_stock_litres - d.capacity_litres).toFixed(0)} L over limit.
                          <br />Fix options:
                          <br />• If the tank is actually larger — update its capacity in the Tanks &amp; Pumps tab
                          <br />• If deliveries were recorded to the wrong tank — contact your administrator to reassign them in the database
                        </p>
                      </div>
                    )}
                    {d.integrity_status === "NEGATIVE_STOCK" && (
                      <div className="mt-2 text-sm text-red-700 bg-red-100 rounded-lg px-3 py-2">
                        <p className="font-semibold">Negative stock indicates a data error.</p>
                        <p className="text-xs mt-1">
                          More fuel was recorded as sold than was ever in the tank.
                          Use Stock Adjustments to correct this.
                        </p>
                      </div>
                    )}
                    {d.missing_nozzles && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block">
                        ⚠ No nozzles — this tank cannot be used in shifts or sales until a nozzle is added
                      </p>
                    )}
                    {d.missing_price && (
                      <p className="mt-1 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block">
                        ⚠ No pump price set — sales of {d.product_name} are not properly priced
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All tanks status table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">All Tanks Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Tank</th>
                <th>Product</th>
                <th className="text-right">Capacity (L)</th>
                <th className="text-right">Current Stock (L)</th>
                <th className="text-right">Fill %</th>
                <th>Nozzles</th>
                <th>Price Set</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const cfg = statusConfig[d.integrity_status] ?? statusConfig.OK;
                return (
                  <tr key={i}>
                    <td className="font-medium">{d.station_name}</td>
                    <td className="font-semibold text-gray-800">
                      T{d.tank_number} — {d.tank_name}
                    </td>
                    <td>{d.product_name}</td>
                    <td className="text-right">{Number(d.capacity_litres).toLocaleString()}</td>
                    <td className={`text-right font-bold ${
                      d.integrity_status === "OVER_CAPACITY" || d.integrity_status === "NEGATIVE_STOCK"
                        ? "text-red-600" : "text-gray-800"}`}>
                      {Number(d.current_stock_litres).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </td>
                    <td className="text-right">{d.fill_pct}%</td>
                    <td>
                      {d.missing_nozzles
                        ? <span className="badge bg-red-100 text-red-600 text-xs">None</span>
                        : <span className="badge bg-green-100 text-green-700 text-xs">{d.nozzle_count}</span>}
                    </td>
                    <td>
                      {d.missing_price
                        ? <span className="badge bg-amber-100 text-amber-700 text-xs">Missing</span>
                        : <span className="badge bg-green-100 text-green-700 text-xs">✓ Set</span>}
                    </td>
                    <td>
                      <span className={`badge text-xs ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── HELPER: simple form state hook ────────────────────
function useFormState<T extends object>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const set = (key: keyof T) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setState((prev) => ({ ...prev, [key]: e.target.value }));
  const reset = () => setState(initial);
  return { state, set, reset };
}

function SaveBtn({ saving, saved, label }: { saving: boolean; saved: boolean; label: string }) {
  return (
    <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
      {saved ? <><CheckCircle size={16} /> Saved!</>
        : saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
        : label}
    </button>
  );
}

// ── STATIONS TAB ────────────────────────────────────
function StationsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [omcs, setOmcs]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({
    name:"", district:"", region:"", location:"",
    contactPerson:"", contactPhone:"", omcId:"", ownership:"", isMain:"false",
  });

  const load = async () => {
    const supabase = createClient();
    const [sRes, oRes] = await Promise.all([
      supabase.from("stations").select("*").order("is_main_branch", { ascending: false }).order("name"),
      supabase.from("omcs").select("*").order("brand_name"),
    ]);
    if (sRes.data) setItems(sRes.data);
    if (oRes.data) setOmcs(oRes.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("stations").insert({
      name: state.name, district: state.district || null,
      region: state.region || null, location: state.location || null,
      contact_person: state.contactPerson || null,
      contact_phone: state.contactPhone || null,
      omc_id: state.omcId || null,
      ownership_model: state.ownership || null,
      is_main_branch: state.isMain === "true",
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Station</h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Station Name *</label>
            <input className="form-input" placeholder="e.g. Kampala Road Station"
              value={state.name} onChange={set("name")} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">District</label>
              <input className="form-input" placeholder="e.g. Kampala"
                value={state.district} onChange={set("district")} /></div>
            <div><label className="form-label">Region</label>
              <input className="form-input" placeholder="e.g. Central"
                value={state.region} onChange={set("region")} /></div>
          </div>
          <div><label className="form-label">Address / Location</label>
            <input className="form-input" value={state.location} onChange={set("location")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label>
              <input className="form-input" value={state.contactPerson} onChange={set("contactPerson")} /></div>
            <div><label className="form-label">Phone</label>
              <input className="form-input" value={state.contactPhone} onChange={set("contactPhone")} /></div>
          </div>
          <div><label className="form-label">OMC Supplier</label>
            <select className="form-select" value={state.omcId} onChange={set("omcId")}>
              <option value="">Select OMC...</option>
              {omcs.map((o) => <option key={o.id} value={o.id}>{o.brand_name ?? o.name}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Ownership Model</label>
              <select className="form-select" value={state.ownership} onChange={set("ownership")}>
                <option value="">Select...</option>
                <option value="COCO">COCO</option><option value="CODO">CODO</option>
                <option value="DODO">DODO</option><option value="DOCO">DOCO</option>
              </select></div>
            <div><label className="form-label">Is Main Branch?</label>
              <select className="form-select" value={state.isMain} onChange={set("isMain")}>
                <option value="false">No — Branch</option>
                <option value="true">Yes — Main Branch</option>
              </select></div>
          </div>
          <SaveBtn saving={saving} saved={saved} label="Add Station" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
          Stations ({items.length})
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{s.name}
                {s.is_main_branch && <span className="ml-2 badge bg-blue-100 text-blue-700 text-[10px]">Main</span>}
              </p>
              <p className="text-xs text-gray-400">
                {[s.district, s.region].filter(Boolean).join(", ") || "No location set"}
              </p>
            </div>
          ))}
          {items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No stations yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── OMCS TAB ────────────────────────────────────────
function OmcsTab() {
  const [items, setItems]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({
    name:"", brand:"", contact:"", phone:"", email:"",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("omcs").select("*").order("brand_name");
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("omcs").insert({
      name: state.name, brand_name: state.brand || null,
      contact_person: state.contact || null,
      contact_phone: state.phone || null, email: state.email || null,
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus size={16} /> Add OMC Supplier
        </h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Full Company Name *</label>
            <input className="form-input" placeholder="e.g. TotalEnergies Marketing Uganda Ltd"
              value={state.name} onChange={set("name")} required /></div>
          <div><label className="form-label">Brand Name</label>
            <input className="form-input" placeholder="e.g. Total"
              value={state.brand} onChange={set("brand")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label>
              <input className="form-input" value={state.contact} onChange={set("contact")} /></div>
            <div><label className="form-label">Phone</label>
              <input className="form-input" value={state.phone} onChange={set("phone")} /></div>
          </div>
          <div><label className="form-label">Email</label>
            <input className="form-input" type="email" value={state.email} onChange={set("email")} /></div>
          <SaveBtn saving={saving} saved={saved} label="Add OMC" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
          OMCs ({items.length})
        </div>
        <div className="divide-y divide-gray-50">
          {items.map((o) => (
            <div key={o.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{o.brand_name ?? o.name}</p>
              <p className="text-xs text-gray-400">{o.name}</p>
            </div>
          ))}
          {items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No OMCs yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── PRODUCTS TAB ────────────────────────────────────
function ProductsTab() {
  const [items, setItems]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({ name:"", code:"", type:"", unit:"litres" });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("products").select("*").order("product_type").order("name");
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("products").insert({
      name: state.name, product_code: state.code || null,
      product_type: state.type, unit: state.unit,
      is_fuel: ["fuel","lpg","adblue"].includes(state.type),
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus size={16} /> Add Product
        </h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Product Name *</label>
            <input className="form-input" placeholder="e.g. Petrol (ULG)"
              value={state.name} onChange={set("name")} required /></div>
          <div><label className="form-label">Product Code</label>
            <input className="form-input" placeholder="e.g. ULG, AGO, IK"
              value={state.code} onChange={set("code")} /></div>
          <div><label className="form-label">Type *</label>
            <select className="form-select" value={state.type} onChange={set("type")} required>
              <option value="">Select type...</option>
              <option value="fuel">Fuel (Petrol / Diesel / Kerosene)</option>
              <option value="lubricant">Lubricant / Engine Oil</option>
              <option value="lpg">LPG (Cooking Gas)</option>
              <option value="adblue">AdBlue / DEF</option>
              <option value="car_wash">Car Wash Service</option>
              <option value="shop_item">Shop / Convenience Item</option>
            </select></div>
          <div><label className="form-label">Unit *</label>
            <select className="form-select" value={state.unit} onChange={set("unit")}>
              <option value="litres">Litres</option>
              <option value="pieces">Pieces</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="service">Service (flat)</option>
            </select></div>
          <SaveBtn saving={saving} saved={saved} label="Add Product" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
          Products ({items.length})
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((p) => (
            <div key={p.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400">{p.product_code} · {p.unit}</p>
              </div>
              <span className="badge bg-gray-100 text-gray-600 text-xs">{p.product_type}</span>
            </div>
          ))}
          {items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No products yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── TANKS & PUMPS TAB (with edit) ───────────────────
function TanksPumpsTab() {
  const [stations, setStations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tanks, setTanks]       = useState<any[]>([]);
  const [pumps, setPumps]       = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [editingTank, setEditingTank]         = useState<any | null>(null);

  const [savingT, setSavingT] = useState(false); const [savedT, setSavedT] = useState(false);
  const [savingP, setSavingP] = useState(false); const [savedP, setSavedP] = useState(false);
  const [savingN, setSavingN] = useState(false); const [savedN, setSavedN] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const { state:t, set:setT, reset:resetT } = useFormState({ name:"", num:"", product:"", cap:"" });
  const { state:p, set:setP, reset:resetP } = useFormState({ name:"", num:"", model:"" });
  const { state:n, set:setN, reset:resetN } = useFormState({ pump:"", tank:"", label:"", num:"" });

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

  const loadTP = async () => {
    if (!selectedStation) return;
    const supabase = createClient();
    const [tRes, puRes] = await Promise.all([
      supabase.from("tanks").select("*, product:products(id,name)").eq("station_id", selectedStation).order("tank_number"),
      supabase.from("pumps").select("*").eq("station_id", selectedStation).order("pump_number"),
    ]);
    if (tRes.data) setTanks(tRes.data);
    if (puRes.data) setPumps(puRes.data);
  };
  useEffect(() => { loadTP(); }, [selectedStation]);

  const saveTank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!t.name || !t.product || !t.cap || !selectedStation) return;
    setSavingT(true);
    const supabase = createClient();
    const { error } = await supabase.from("tanks").insert({
      station_id: selectedStation, product_id: t.product,
      tank_name: t.name, tank_number: parseInt(t.num || "1"),
      capacity_litres: parseFloat(t.cap),
    });
    if (!error) { setSavingT(false); setSavedT(true); resetT(); loadTP(); setTimeout(() => setSavedT(false), 2000); }
    else { setSavingT(false); }
  };

  const saveEditTank = async () => {
    if (!editingTank) return;
    setEditError(""); setEditSaving(true);
    const supabase = createClient();

    // Capacity can only increase if there's stock in the tank
    const { data: stockData } = await supabase
      .rpc("get_tank_stock_litres", { p_tank_id: editingTank.id });
    const currentStock = stockData ?? 0;

    if (parseFloat(editingTank.capacity_litres) < currentStock) {
      setEditError(
        `Cannot reduce capacity below current stock (${currentStock.toFixed(0)} L). ` +
        `Minimum capacity is ${Math.ceil(currentStock)} L.`
      );
      setEditSaving(false); return;
    }

    const { error } = await supabase.from("tanks").update({
      tank_name: editingTank.tank_name,
      capacity_litres: parseFloat(editingTank.capacity_litres),
    }).eq("id", editingTank.id);

    if (error) { setEditError(error.message); setEditSaving(false); return; }
    setEditSaving(false);
    setEditingTank(null);
    loadTP();
  };

  const savePump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!p.name || !selectedStation) return;
    setSavingP(true);
    const supabase = createClient();
    await supabase.from("pumps").insert({
      station_id: selectedStation, pump_name: p.name,
      pump_number: parseInt(p.num || "1"), pump_model: p.model || null,
    });
    setSavingP(false); setSavedP(true); resetP(); loadTP();
    setTimeout(() => setSavedP(false), 2000);
  };

  const saveNozzle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!n.pump || !n.tank || !n.label || !selectedStation) return;
    setSavingN(true);
    const supabase = createClient();
    const tank = tanks.find((tk) => tk.id === n.tank);
    const { error } = await supabase.from("nozzles").insert({
      pump_id: n.pump, station_id: selectedStation,
      product_id: tank?.product?.id,
      tank_id: n.tank, nozzle_label: n.label,
      nozzle_number: parseInt(n.num || "1"),
    });
    if (error) {
      if (error.message.includes("PRODUCT_MISMATCH")) {
        alert("Product mismatch: the nozzle product must match the tank's product.");
      }
    } else {
      setSavedN(true); resetN();
    }
    setSavingN(false);
    setTimeout(() => setSavedN(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label className="form-label">Select Station to Configure</label>
        <select className="form-select w-80" value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}>
          <option value="">Choose station...</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedStation && (
        <div className="space-y-5">
          {/* Existing tanks with edit */}
          {tanks.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
                Existing Tanks — {tanks.length} configured
              </div>
              <div className="divide-y divide-gray-50">
                {tanks.map((tk) => (
                  <div key={tk.id} className="px-5 py-3">
                    {editingTank?.id === tk.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="form-label">Tank Name</label>
                            <input className="form-input" value={editingTank.tank_name}
                              onChange={(e) => setEditingTank({ ...editingTank, tank_name: e.target.value })} />
                          </div>
                          <div>
                            <label className="form-label">Capacity (litres)</label>
                            <input type="number" step="0.01" className="form-input"
                              value={editingTank.capacity_litres}
                              onChange={(e) => setEditingTank({ ...editingTank, capacity_litres: e.target.value })} />
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠ Cannot reduce below current stock level
                            </p>
                          </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                          Note: You cannot change the product assigned to a tank after it has been
                          used. To change product, deactivate this tank and create a new one.
                        </div>
                        {editError && (
                          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {editError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={saveEditTank}
                            className="btn-primary btn-sm flex items-center gap-1.5"
                            disabled={editSaving}>
                            {editSaving
                              ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                              : <><Save size={13} /> Save Changes</>}
                          </button>
                          <button onClick={() => { setEditingTank(null); setEditError(""); }}
                            className="btn-secondary btn-sm flex items-center gap-1.5">
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            T{tk.tank_number} — {tk.tank_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {tk.product?.name} ·
                            Capacity: {Number(tk.capacity_litres).toLocaleString()} L
                          </p>
                        </div>
                        <button onClick={() => { setEditingTank({ ...tk }); setEditError(""); }}
                          className="btn-secondary btn-sm flex items-center gap-1.5">
                          <Pencil size={12} /> Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Add tank */}
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add Underground Tank
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-600">
                Each tank stores one product. The product cannot be changed after the tank has stock.
              </div>
              <form onSubmit={saveTank} className="space-y-2">
                <input className="form-input" placeholder="Tank name e.g. Tank 1 — Diesel"
                  value={t.name} onChange={setT("name")} required />
                <input className="form-input" type="number" placeholder="Tank number (1, 2...)"
                  value={t.num} onChange={setT("num")} />
                <select className="form-select" value={t.product} onChange={setT("product")} required>
                  <option value="">Product stored...</option>
                  {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                </select>
                <input className="form-input" type="number" step="0.01"
                  placeholder="Capacity in litres e.g. 5000"
                  value={t.cap} onChange={setT("cap")} required />
                <button type="submit" className="btn-primary btn-sm w-full justify-center"
                  disabled={savingT}>
                  {savedT ? "✓ Tank Added" : savingT ? "Adding..." : "Add Tank"}
                </button>
              </form>
            </div>

            {/* Add pump */}
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add Dispensing Pump
              </h3>
              <form onSubmit={savePump} className="space-y-2">
                <input className="form-input" placeholder="Pump name e.g. Pump 1"
                  value={p.name} onChange={setP("name")} required />
                <input className="form-input" type="number" placeholder="Pump number"
                  value={p.num} onChange={setP("num")} />
                <input className="form-input" placeholder="Model e.g. Wayne, Tokheim"
                  value={p.model} onChange={setP("model")} />
                <button type="submit" className="btn-primary btn-sm w-full justify-center"
                  disabled={savingP}>
                  {savedP ? "✓ Pump Added" : savingP ? "Adding..." : "Add Pump"}
                </button>
              </form>
              <div className="divide-y divide-gray-50 mt-2">
                {pumps.map((pu) => (
                  <div key={pu.id} className="py-2">
                    <p className="text-sm font-semibold text-gray-700">{pu.pump_name}</p>
                    <p className="text-xs text-gray-400">{pu.pump_model ?? "No model"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Add nozzle */}
            <div className="card p-5 space-y-3">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add Nozzle (Hose)
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                A nozzle connects a pump to a specific tank. The nozzle's product must match the tank's product — the system will block mismatches.
              </div>
              <form onSubmit={saveNozzle} className="space-y-2">
                <select className="form-select" value={n.pump} onChange={setN("pump")} required>
                  <option value="">Select pump...</option>
                  {pumps.map((pu) => <option key={pu.id} value={pu.id}>{pu.pump_name}</option>)}
                </select>
                <select className="form-select" value={n.tank} onChange={setN("tank")} required>
                  <option value="">Tank it draws from...</option>
                  {tanks.map((tk) => (
                    <option key={tk.id} value={tk.id}>
                      T{tk.tank_number} — {tk.tank_name} ({tk.product?.name})
                    </option>
                  ))}
                </select>
                <input className="form-input" placeholder="Nozzle label e.g. Diesel Side, A"
                  value={n.label} onChange={setN("label")} required />
                <input className="form-input" type="number" placeholder="Nozzle number (1, 2...)"
                  value={n.num} onChange={setN("num")} />
                <button type="submit" className="btn-primary btn-sm w-full justify-center"
                  disabled={savingN}>
                  {savedN ? "✓ Nozzle Added" : savingN ? "Adding..." : "Add Nozzle"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EMPLOYEES TAB ────────────────────────────────────
function EmployeesTab() {
  const [stations, setStations] = useState<any[]>([]);
  const [items, setItems]       = useState<any[]>([]);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const { state, set, reset } = useFormState({
    stationId:"", fullName:"", role:"", phone:"",
    nationalId:"", salary:"", dateJoined:"",
  });

  const load = async () => {
    const supabase = createClient();
    const [sRes, eRes] = await Promise.all([
      supabase.from("stations").select("*").order("name"),
      supabase.from("employees").select("*, station:stations(name)").eq("is_active", true).order("full_name"),
    ]);
    if (sRes.data) setStations(sRes.data);
    if (eRes.data) setItems(eRes.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("employees").insert({
      station_id: state.stationId, full_name: state.fullName,
      role: state.role, phone: state.phone || null,
      national_id: state.nationalId || null,
      salary_ugx: state.salary ? parseFloat(state.salary) : null,
      date_joined: state.dateJoined || null,
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus size={16} /> Add Employee
        </h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Station *</label>
            <select className="form-select" value={state.stationId}
              onChange={set("stationId")} required>
              <option value="">Select station...</option>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="form-label">Full Name *</label>
            <input className="form-input" value={state.fullName} onChange={set("fullName")} required /></div>
          <div><label className="form-label">Role *</label>
            <select className="form-select" value={state.role} onChange={set("role")} required>
              <option value="">Select role...</option>
              <option value="manager">Station Manager</option>
              <option value="assistant_manager">Assistant Manager</option>
              <option value="shift_supervisor">Shift Supervisor</option>
              <option value="cashier">Cashier</option>
              <option value="pump_attendant">Pump Attendant</option>
              <option value="security">Security Guard</option>
              <option value="cleaner">Cleaner</option>
              <option value="other">Other</option>
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Phone</label>
              <input className="form-input" value={state.phone} onChange={set("phone")} /></div>
            <div><label className="form-label">National ID</label>
              <input className="form-input" value={state.nationalId} onChange={set("nationalId")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Monthly Salary (UGX)</label>
              <input className="form-input" type="number" value={state.salary} onChange={set("salary")} /></div>
            <div><label className="form-label">Date Joined</label>
              <input className="form-input" type="date" value={state.dateJoined} onChange={set("dateJoined")} /></div>
          </div>
          <SaveBtn saving={saving} saved={saved} label="Add Employee" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
          Employees ({items.length})
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((e) => (
            <div key={e.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm text-gray-800">{e.full_name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {e.role?.replace("_"," ")} · {(e.station as any)?.name}
                </p>
              </div>
              <span className="badge bg-gray-100 text-gray-600 text-xs capitalize">
                {e.role?.replace("_"," ")}
              </span>
            </div>
          ))}
          {items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No employees yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── CREDIT CUSTOMERS TAB ─────────────────────────────
function CreditCustomersTab() {
  const [items, setItems]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({
    name:"", contact:"", phone:"", email:"",
    address:"", tin:"", limit:"", terms:"30",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("credit_customers").select("*").order("name");
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    await supabase.from("credit_customers").insert({
      name: state.name, contact_person: state.contact || null,
      phone: state.phone || null, email: state.email || null,
      address: state.address || null, tin_number: state.tin || null,
      credit_limit_ugx: parseFloat(state.limit),
      payment_terms_days: parseInt(state.terms || "30"),
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Plus size={16} /> Add Credit Customer
        </h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Company / Customer Name *</label>
            <input className="form-input" placeholder="e.g. Roofings Group Ltd"
              value={state.name} onChange={set("name")} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Contact Person</label>
              <input className="form-input" value={state.contact} onChange={set("contact")} /></div>
            <div><label className="form-label">Phone</label>
              <input className="form-input" value={state.phone} onChange={set("phone")} /></div>
          </div>
          <div><label className="form-label">Email</label>
            <input className="form-input" type="email" value={state.email} onChange={set("email")} /></div>
          <div><label className="form-label">Address</label>
            <input className="form-input" value={state.address} onChange={set("address")} /></div>
          <div><label className="form-label">TIN Number</label>
            <input className="form-input" placeholder="e.g. 1234567890"
              value={state.tin} onChange={set("tin")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Credit Limit (UGX) *</label>
              <input className="form-input" type="number"
                placeholder="e.g. 5000000"
                value={state.limit} onChange={set("limit")} required /></div>
            <div><label className="form-label">Payment Terms (days)</label>
              <input className="form-input" type="number"
                value={state.terms} onChange={set("terms")} /></div>
          </div>
          <SaveBtn saving={saving} saved={saved} label="Add Customer" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">
          Credit Customers ({items.length})
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-400">
                Limit: {c.credit_limit_ugx?.toLocaleString()} UGX · {c.payment_terms_days} days
              </p>
            </div>
          ))}
          {items.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No customers yet</div>}
        </div>
      </div>
    </div>
  );
}