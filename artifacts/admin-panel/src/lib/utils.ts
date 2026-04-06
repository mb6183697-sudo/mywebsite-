import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TZ = "Europe/Istanbul";

export function fmtTR(
  d: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = {}
): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("tr-TR", { timeZone: TZ, ...opts });
  } catch {
    return String(d);
  }
}

export function fmtTRDate(d: string | Date | null | undefined): string {
  return fmtTR(d, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtTRDateTime(d: string | Date | null | undefined): string {
  return fmtTR(d, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtTRTime(d: string | Date | null | undefined): string {
  return fmtTR(d, { hour: "2-digit", minute: "2-digit" });
}
