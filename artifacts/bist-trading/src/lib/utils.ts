import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const TZ = "Europe/Istanbul";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "₺0,00";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "%0,00";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("tr-TR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)}`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function formatShortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("tr-TR", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
