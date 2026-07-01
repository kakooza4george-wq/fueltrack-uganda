"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import { CheckCircle, Loader2, Plus } from "lucide-react";

type Tab = "stations"|"omcs"|"products"|"tanks_pumps"|"employees"|"credit_customers";

export default function SetupPage() {
  const [tab, setTab] = useState<Tab>("stations");
  const TABS = [
    { id:"stations",         label:"Stations" },
    { id:"omcs",             label:"OMC Suppliers" },
    { id:"products",         label:"Products" },
    { id:"tanks_pumps",      label:"Tanks & Pumps" },
    { id:"employees",        label:"Employees" },
    { id:"credit_customers", label:"Credit Customers" },
  ];
  return (
    <>
      <Header title="System Setup" />
      <div className="p-6 space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>Setup is done once.</strong> Configure your stations, tanks, pumps and products here before starting daily operations. Come back only when adding a new station or employee.
        </div>
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                ${tab === t.id ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
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

function useFormState<T extends object>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const set = (key: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
      supabase.from("stations").select("*").order("is_main_branch", { ascending:false }).order("name"),
      supabase.from("omcs").select("*").order("brand_name"),
    ]);
    if (sRes.data) setItems(sRes.data);
    if (oRes.data) setOmcs(oRes.data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("stations").insert({
      name: state.name, district: state.district || null, region: state.region || null,
      location: state.location || null, contact_person: state.contactPerson || null,
      contact_phone: state.contactPhone || null, omc_id: state.omcId || null,
      ownership_model: state.ownership || null, is_main_branch: state.isMain === "true",
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
            <input className="form-input" placeholder="e.g. Kampala Road Station" value={state.name} onChange={set("name")} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">District</label>
              <input className="form-input" placeholder="e.g. Kampala" value={state.district} onChange={set("district")} /></div>
            <div><label className="form-label">Region</label>
              <input className="form-input" placeholder="e.g. Central" value={state.region} onChange={set("region")} /></div>
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
                <option value="false">No — Branch Station</option>
                <option value="true">Yes — Main Branch (HQ)</option>
              </select></div>
          </div>
          <SaveBtn saving={saving} saved={saved} label="Add Station" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Stations ({items.length})</div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((s) => (
            <div key={s.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{s.name}
                {s.is_main_branch && <span className="ml-2 badge bg-blue-100 text-blue-700 text-[10px]">Main</span>}
              </p>
              <p className="text-xs text-gray-400">{[s.district, s.region].filter(Boolean).join(", ") || "No location set"}</p>
            </div>
          ))}
          {items.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No stations yet</div>}
        </div>
      </div>
    </div>
  );
}

function OmcsTab() {
  const [items, setItems]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({ name:"", brand:"", contact:"", phone:"", email:"" });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("omcs").select("*").order("brand_name");
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("omcs").insert({
      name: state.name, brand_name: state.brand || null,
      contact_person: state.contact || null, contact_phone: state.phone || null, email: state.email || null,
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add OMC Supplier</h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Full Company Name *</label>
            <input className="form-input" placeholder="e.g. TotalEnergies Marketing Uganda Ltd" value={state.name} onChange={set("name")} required /></div>
          <div><label className="form-label">Brand Name</label>
            <input className="form-input" placeholder="e.g. Total" value={state.brand} onChange={set("brand")} /></div>
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
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">OMCs ({items.length})</div>
        <div className="divide-y divide-gray-50">
          {items.map((o) => (
            <div key={o.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{o.brand_name ?? o.name}</p>
              <p className="text-xs text-gray-400">{o.name}</p>
            </div>
          ))}
          {items.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No OMCs yet</div>}
        </div>
      </div>
    </div>
  );
}

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
    if (!state.name || !state.type) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("products").insert({
      name: state.name, product_code: state.code || null, product_type: state.type, unit: state.unit,
      is_fuel: ["fuel","lpg","adblue"].includes(state.type),
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Product</h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Product Name *</label>
            <input className="form-input" placeholder="e.g. Petrol (ULG)" value={state.name} onChange={set("name")} required /></div>
          <div><label className="form-label">Product Code</label>
            <input className="form-input" placeholder="e.g. ULG, AGO, IK" value={state.code} onChange={set("code")} /></div>
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
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Products ({items.length})</div>
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
          {items.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No products yet</div>}
        </div>
      </div>
    </div>
  );
}

function TanksPumpsTab() {
  const [stations, setStations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tanks, setTanks]       = useState<any[]>([]);
  const [pumps, setPumps]       = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [savingT, setSavingT] = useState(false); const [savedT, setSavedT] = useState(false);
  const [savingP, setSavingP] = useState(false); const [savedP, setSavedP] = useState(false);
  const [savingN, setSavingN] = useState(false); const [savedN, setSavedN] = useState(false);
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
      supabase.from("tanks").select("*, product:products(name)").eq("station_id", selectedStation).order("tank_number"),
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
    await supabase.from("tanks").insert({
      station_id: selectedStation, product_id: t.product,
      tank_name: t.name, tank_number: parseInt(t.num || "1"), capacity_litres: parseFloat(t.cap),
    });
    setSavingT(false); setSavedT(true); resetT(); loadTP();
    setTimeout(() => setSavedT(false), 2000);
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
    await supabase.from("nozzles").insert({
      pump_id: n.pump, station_id: selectedStation,
      product_id: tank?.product_id, tank_id: n.tank,
      nozzle_label: n.label, nozzle_number: parseInt(n.num || "1"),
    });
    setSavingN(false); setSavedN(true); resetN();
    setTimeout(() => setSavedN(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label className="form-label">Select Station to Configure</label>
        <select className="form-select w-80" value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)}>
          <option value="">Choose station...</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {selectedStation && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Underground Tanks ({tanks.length})</h3>
            <form onSubmit={saveTank} className="space-y-2">
              <input className="form-input" placeholder="Tank name e.g. Tank 1 - Diesel" value={t.name} onChange={setT("name")} required />
              <input className="form-input" type="number" placeholder="Tank number (1, 2...)" value={t.num} onChange={setT("num")} />
              <select className="form-select" value={t.product} onChange={setT("product")} required>
                <option value="">Product stored...</option>
                {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
              <input className="form-input" type="number" step="0.01" placeholder="Capacity (litres)" value={t.cap} onChange={setT("cap")} required />
              <button type="submit" className="btn-primary btn-sm w-full justify-center" disabled={savingT}>
                {savedT ? "✓ Saved" : savingT ? "Saving..." : "Add Tank"}
              </button>
            </form>
            <div className="divide-y divide-gray-50 mt-2">
              {tanks.map((tk) => (
                <div key={tk.id} className="py-2">
                  <p className="text-sm font-semibold text-gray-700">{tk.tank_name}</p>
                  <p className="text-xs text-gray-400">{(tk.product as any)?.name} · {tk.capacity_litres?.toLocaleString()} L capacity</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Dispensing Pumps ({pumps.length})</h3>
            <form onSubmit={savePump} className="space-y-2">
              <input className="form-input" placeholder="Pump name e.g. Pump 1" value={p.name} onChange={setP("name")} required />
              <input className="form-input" type="number" placeholder="Pump number" value={p.num} onChange={setP("num")} />
              <input className="form-input" placeholder="Model e.g. Wayne, Tokheim" value={p.model} onChange={setP("model")} />
              <button type="submit" className="btn-primary btn-sm w-full justify-center" disabled={savingP}>
                {savedP ? "✓ Saved" : savingP ? "Saving..." : "Add Pump"}
              </button>
            </form>
            <div className="divide-y divide-gray-50 mt-2">
              {pumps.map((pu) => (
                <div key={pu.id} className="py-2">
                  <p className="text-sm font-semibold text-gray-700">{pu.pump_name}</p>
                  <p className="text-xs text-gray-400">{pu.pump_model ?? "No model specified"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Nozzles (Hoses)</h3>
            <p className="text-xs text-gray-400">Each pump nozzle draws from a specific tank.</p>
            <form onSubmit={saveNozzle} className="space-y-2">
              <select className="form-select" value={n.pump} onChange={setN("pump")} required>
                <option value="">Select pump...</option>
                {pumps.map((pu) => <option key={pu.id} value={pu.id}>{pu.pump_name}</option>)}
              </select>
              <select className="form-select" value={n.tank} onChange={setN("tank")} required>
                <option value="">Tank it draws from...</option>
                {tanks.map((tk) => <option key={tk.id} value={tk.id}>{tk.tank_name}</option>)}
              </select>
              <input className="form-input" placeholder="Nozzle label e.g. A, Diesel side" value={n.label} onChange={setN("label")} required />
              <input className="form-input" type="number" placeholder="Nozzle number (1, 2...)" value={n.num} onChange={setN("num")} />
              <button type="submit" className="btn-primary btn-sm w-full justify-center" disabled={savingN}>
                {savedN ? "✓ Saved" : savingN ? "Saving..." : "Add Nozzle"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeesTab() {
  const [stations, setStations] = useState<any[]>([]);
  const [items, setItems]       = useState<any[]>([]);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const { state, set, reset } = useFormState({
    stationId:"", fullName:"", role:"", phone:"", nationalId:"", salary:"", dateJoined:"",
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
    if (!state.fullName || !state.role || !state.stationId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("employees").insert({
      station_id: state.stationId, full_name: state.fullName, role: state.role,
      phone: state.phone || null, national_id: state.nationalId || null,
      salary_ugx: state.salary ? parseFloat(state.salary) : null,
      date_joined: state.dateJoined || null,
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Employee</h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Station *</label>
            <select className="form-select" value={state.stationId} onChange={set("stationId")} required>
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
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Employees ({items.length})</div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((e) => (
            <div key={e.id} className="px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm text-gray-800">{e.full_name}</p>
                <p className="text-xs text-gray-400 capitalize">{e.role?.replace("_"," ")} · {(e.station as any)?.name}</p>
              </div>
              <span className="badge bg-gray-100 text-gray-600 text-xs capitalize">{e.role?.replace("_"," ")}</span>
            </div>
          ))}
          {items.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No employees yet</div>}
        </div>
      </div>
    </div>
  );
}

function CreditCustomersTab() {
  const [items, setItems]   = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const { state, set, reset } = useFormState({
    name:"", contact:"", phone:"", email:"", address:"", tin:"", limit:"", terms:"30",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("credit_customers").select("*").order("name");
    if (data) setItems(data);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name || !state.limit) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("credit_customers").insert({
      name: state.name, contact_person: state.contact || null, phone: state.phone || null,
      email: state.email || null, address: state.address || null, tin_number: state.tin || null,
      credit_limit_ugx: parseFloat(state.limit), payment_terms_days: parseInt(state.terms || "30"),
    });
    setSaving(false); setSaved(true); reset(); load();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} /> Add Credit Customer</h3>
        <form onSubmit={save} className="space-y-3">
          <div><label className="form-label">Company / Customer Name *</label>
            <input className="form-input" placeholder="e.g. Roofings Group Ltd" value={state.name} onChange={set("name")} required /></div>
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
          <div><label className="form-label">TIN Number (Uganda)</label>
            <input className="form-input" placeholder="e.g. 1234567890" value={state.tin} onChange={set("tin")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">Credit Limit (UGX) *</label>
              <input className="form-input" type="number" placeholder="e.g. 5000000" value={state.limit} onChange={set("limit")} required /></div>
            <div><label className="form-label">Payment Terms (days)</label>
              <input className="form-input" type="number" value={state.terms} onChange={set("terms")} /></div>
          </div>
          <SaveBtn saving={saving} saved={saved} label="Add Customer" />
        </form>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-bold text-gray-700 text-sm">Credit Customers ({items.length})</div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {items.map((c) => (
            <div key={c.id} className="px-4 py-3">
              <p className="font-semibold text-sm text-gray-800">{c.name}</p>
              <p className="text-xs text-gray-400">Limit: {c.credit_limit_ugx?.toLocaleString()} UGX · {c.payment_terms_days} days</p>
            </div>
          ))}
          {items.length === 0 && <div className="px-4 py-6 text-center text-gray-400 text-sm">No customers yet</div>}
        </div>
      </div>
    </div>
  );
}