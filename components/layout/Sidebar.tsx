"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ListChecks, Clock, Truck, ShoppingCart,
  Receipt, Package, TrendingUp, Users, Building2,
  BarChart3, Settings, Fuel, ChevronRight,
} from "lucide-react";
import { cn } from "@/utils";

const NAV_SECTIONS = [
  {
    title: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Today's Workflow", href: "/workflow", icon: ListChecks },
    ],
  },
  {
    title: "Daily Operations",
    items: [
      { label: "Shifts", href: "/shifts", icon: Clock },
      { label: "Fuel Deliveries", href: "/deliveries", icon: Truck },
      { label: "Sales", href: "/sales", icon: ShoppingCart },
      { label: "Expenses", href: "/expenses", icon: Receipt },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Stock & Tanks", href: "/stock", icon: Package },
      { label: "Pump Prices", href: "/prices", icon: TrendingUp },
      { label: "Credit Accounts", href: "/credit", icon: Users },
      { label: "Suppliers (OMCs)", href: "/suppliers", icon: Building2 },
    ],
  },
  {
    title: "Reports & Setup",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "System Setup", href: "/setup", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-blue-950 flex flex-col z-30">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-900">
        <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
          <Fuel size={22} className="text-blue-950" />
        </div>
        <div>
          <p className="text-white font-bold leading-tight">FuelTrack</p>
          <p className="text-blue-400 text-xs">Uganda — Main Branch</p>
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="mb-1">
            {section.title && (
              <p className="text-blue-500 text-[10px] font-bold uppercase tracking-widest px-5 py-2">
                {section.title}
              </p>
            )}
            <ul className="px-2 space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-blue-300 hover:bg-blue-900 hover:text-white"
                      )}
                    >
                      <Icon size={17} className="flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <ChevronRight size={13} className="text-blue-300" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 py-3 border-t border-blue-900">
        <p className="text-blue-500 text-xs">FuelTrack v1.0</p>
      </div>
    </aside>
  );
}