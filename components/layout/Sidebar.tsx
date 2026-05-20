"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Clock, Truck, ShoppingCart, Receipt, Users, BarChart3, Settings, Fuel, ChevronRight } from "lucide-react";
import { cn } from "@/utils";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Stations", href: "/stations", icon: Building2 },
  { label: "Shifts", href: "/shifts", icon: Clock },
  { label: "Fuel Deliveries", href: "/deliveries", icon: Truck },
  { label: "Sales", href: "/sales", icon: ShoppingCart },
  { label: "Expenses", href: "/expenses", icon: Receipt },
  { label: "Credit Accounts", href: "/credit", icon: Users },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-blue-900 flex flex-col z-30">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-800">
        <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <Fuel size={20} className="text-blue-900" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">FuelTrack</p>
          <p className="text-blue-300 text-xs">Uganda</p>
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ? "bg-blue-700 text-white" : "text-blue-200 hover:bg-blue-800 hover:text-white")}>
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-blue-300" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-5 py-4 border-t border-blue-800">
        <p className="text-blue-400 text-xs">FuelTrack v1.0</p>
        <p className="text-blue-500 text-xs mt-0.5">Main Branch System</p>
      </div>
    </aside>
  );
}