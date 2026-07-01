import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUGX(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `UGX ${amount.toLocaleString("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatLitres(litres: number | null | undefined): string {
  if (litres === null || litres === undefined) return "—";
  return `${litres.toLocaleString("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} L`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-UG", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(dtStr: string | null | undefined): string {
  if (!dtStr) return "—";
  return new Date(dtStr).toLocaleString("en-UG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function shiftLabel(type: string): string {
  const map: Record<string, string> = {
    morning:   "Morning  (06:00 – 14:00)",
    afternoon: "Afternoon  (14:00 – 22:00)",
    night:     "Night  (22:00 – 06:00)",
  };
  return map[type] ?? type;
}

export function paymentLabel(type: string): string {
  const map: Record<string, string> = {
    cash: "Cash", mtn_momo: "MTN MoMo", airtel_money: "Airtel Money",
    fuel_card: "Fuel Card", credit: "Credit (Fleet)", lpo: "LPO", bank_pos: "Bank POS",
  };
  return map[type] ?? type;
}

export function shiftStatusColor(status: string): string {
  const map: Record<string, string> = {
    open: "bg-green-100 text-green-800",
    closed: "bg-amber-100 text-amber-800",
    reconciled: "bg-blue-100 text-blue-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

export function deliveryStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    received: "bg-green-100 text-green-800",
    disputed: "bg-red-100 text-red-800",
    resolved: "bg-blue-100 text-blue-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function isVarianceAcceptable(variance: number, total: number): boolean {
  if (total === 0) return true;
  return Math.abs(variance / total) <= 0.005;
}