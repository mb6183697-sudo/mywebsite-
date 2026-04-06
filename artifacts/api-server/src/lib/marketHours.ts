/**
 * BIST piyasa saatleri ve tatil takvimi.
 * Pazartesi–Cuma 10:00–18:00 Türkiye saati (Europe/Istanbul).
 * Resmi tatil günleri dahil.
 */

const TURKISH_HOLIDAYS = new Set([
  // Sabit millî bayramlar (2024–2028)
  ...["2024","2025","2026","2027","2028"].flatMap(y => [
    `${y}-01-01`, // Yılbaşı
    `${y}-04-23`, // Ulusal Egemenlik ve Çocuk Bayramı
    `${y}-05-01`, // Emek ve Dayanışma Günü
    `${y}-05-19`, // Atatürk'ü Anma, Gençlik ve Spor Bayramı
    `${y}-07-15`, // Demokrasi ve Millî Birlik Günü
    `${y}-08-30`, // Zafer Bayramı
    `${y}-10-29`, // Cumhuriyet Bayramı
  ]),
  // Ramazan Bayramı 2024 (Arife + 3 gün): 9–12 Nisan
  "2024-04-09","2024-04-10","2024-04-11","2024-04-12",
  // Kurban Bayramı 2024 (Arife + 4 gün): 15–19 Haziran
  "2024-06-15","2024-06-16","2024-06-17","2024-06-18","2024-06-19",
  // Ramazan Bayramı 2025 (Arife + 3 gün): 29 Mar – 1 Nis
  "2025-03-29","2025-03-30","2025-03-31","2025-04-01",
  // Kurban Bayramı 2025 (Arife + 4 gün): 5–9 Haziran
  "2025-06-05","2025-06-06","2025-06-07","2025-06-08","2025-06-09",
  // Ramazan Bayramı 2026 (Arife + 3 gün): 19–22 Mart
  "2026-03-19","2026-03-20","2026-03-21","2026-03-22",
  // Kurban Bayramı 2026 (Arife + 4 gün): 26–30 Mayıs
  "2026-05-26","2026-05-27","2026-05-28","2026-05-29","2026-05-30",
  // Ramazan Bayramı 2027 (Arife + 3 gün): 9–12 Mart
  "2027-03-09","2027-03-10","2027-03-11","2027-03-12",
  // Kurban Bayramı 2027 (Arife + 4 gün): 16–20 Mayıs
  "2027-05-16","2027-05-17","2027-05-18","2027-05-19","2027-05-20",
  // Ramazan Bayramı 2028 (yaklaşık): 27 Feb – 1 Mar
  "2028-02-27","2028-02-28","2028-02-29","2028-03-01",
  // Kurban Bayramı 2028 (yaklaşık): 4–8 Mayıs
  "2028-05-04","2028-05-05","2028-05-06","2028-05-07","2028-05-08",
]);

/** UTC'deki bir anı İstanbul yerel tarih damgasına dönüştürür */
function toIstanbul(date: Date): { year: number; month: number; day: number; hour: number; minute: number; dow: number } {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  return {
    year:   ist.getFullYear(),
    month:  ist.getMonth() + 1,
    day:    ist.getDate(),
    hour:   ist.getHours(),
    minute: ist.getMinutes(),
    dow:    ist.getDay(), // 0=Pazar, 6=Cumartesi
  };
}

/**
 * Verilen andaki piyasa durumunu döndürür.
 * @returns { open: boolean; reason: string }
 */
export function checkMarketStatus(now: Date = new Date()): { open: boolean; reason: string } {
  const { year, month, day, hour, minute, dow } = toIstanbul(now);

  if (dow === 0 || dow === 6) {
    return { open: false, reason: "Piyasa hafta sonları kapalıdır (Pazartesi–Cuma 10:00–18:00)" };
  }

  const dateKey = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  if (TURKISH_HOLIDAYS.has(dateKey)) {
    return { open: false, reason: "Bugün resmi tatil olduğu için piyasa kapalıdır" };
  }

  const minuteOfDay = hour * 60 + minute;
  const openAt  = 10 * 60;      // 10:00
  const closeAt = 18 * 60;      // 18:00

  if (minuteOfDay < openAt) {
    return { open: false, reason: "Piyasa henüz açılmadı. BIST işlem saatleri: 10:00–18:00" };
  }
  if (minuteOfDay >= closeAt) {
    return { open: false, reason: "Piyasa kapandı. BIST işlem saatleri: 10:00–18:00" };
  }

  return { open: true, reason: "Piyasa açık" };
}
