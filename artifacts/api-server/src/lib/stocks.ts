// BIST (Borsa Istanbul) Stock Data - Real-time via Yahoo Finance + DB-backed registry
import _yfImport from "yahoo-finance2";
type YFType = typeof _yfImport;
const _raw = _yfImport as any;
const _YFClass = _raw?.default?.prototype?.quote ? _raw.default : _raw?.prototype?.quote ? _raw : _raw?.default;
const yf: YFType = new _YFClass() as YFType;
import { runFullDiscovery, runLightDiscovery, loadStocksFromDb, KNOWN_BIST_SYMBOLS } from "./stockDiscovery.js";
import { db, bistStocksTable, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}


// Turkish stocks data
const BASE_STOCKS: StockData[] = [
  { symbol: "A1CAP", name: "A1 Capital Yatitim Menkul Degerler A.S.", price: 16.54, change: -0.32, changePercent: -1.93, volume: 8900000, high: 16.86, low: 16.48, open: 16.80, previousClose: 16.86 },
  { symbol: "A1YEN", name: "A1 Yenilenebilir Enerji Uretim AS", price: 29.87, change: -0.13, changePercent: -0.36, volume: 1000000, high: 30.12, low: 29.48, open: 30.00, previousClose: 30.00 },
  { symbol: "ACSEL", name: "Aciselsan Acipayam Seluloz Sanayi ve Ticaret AS", price: 103.24, change: -1.76, changePercent: -1.67, volume: 77700, high: 104.20, low: 101.90, open: 105.00, previousClose: 105.00 },
  { symbol: "ADEL", name: "Adel Kalemcilik Ticaret ve Sanayi A.S.", price: 32.48, change: -0.47, changePercent: -1.44, volume: 634300, high: 32.90, low: 32.00, open: 32.95, previousClose: 32.95 },
  { symbol: "ADESE", name: "Adese Gayrimenkul Yatirim AS", price: 1.07, change: 0.013, changePercent: 1.25, volume: 83400000, high: 1.07, low: 1.03, open: 1.06, previousClose: 1.06 },
  { symbol: "ADGYO", name: "Adra Gayrimenkul Yatirim Ortakligi A.S.", price: 52.22, change: 0.32, changePercent: 0.61, volume: 515200, high: 52.35, low: 50.65, open: 51.90, previousClose: 51.90 },
  { symbol: "AEFES", name: "Anadolu Efes Biracilik ve Malt Sanayii A.S.", price: 17.02, change: 0, changePercent: 0, volume: 1000000, high: 17.28, low: 16.76, open: 17.02, previousClose: 17.02 },
  { symbol: "AFYON", name: "Afyon Cimento Sanayi T.A.S.", price: 16.12, change: 0.063, changePercent: 0.39, volume: 4400000, high: 16.29, low: 15.73, open: 16.05, previousClose: 16.05 },
  { symbol: "AGESA", name: "Agesa Hayat ve Emeklilik A.S.", price: 222.12, change: -5.54, changePercent: -2.45, volume: 162200, high: 227.00, low: 219.00, open: 227.66, previousClose: 227.66 },
  { symbol: "AGHOL", name: "AG Anadolu Grubu Holding A.S.", price: 28.75, change: -0.55, changePercent: -1.89, volume: 1000000, high: 29.18, low: 28.60, open: 29.30, previousClose: 29.30 },
  { symbol: "AGROT", name: "Agrin Gida Kimya Sanayi ve Ticaret A.S.", price: 2.88, change: 0, changePercent: 0, volume: 200000, high: 2.92, low: 2.85, open: 2.88, previousClose: 2.88 },
  { symbol: "AGYO", name: "Atakule Gayrimenkul Yatirim Ortakligi A.S.", price: 8.78, change: 0, changePercent: 0, volume: 300000, high: 8.84, low: 8.72, open: 8.78, previousClose: 8.78 },
  { symbol: "AHGAZ", name: "Anatolian Holding", price: 23.02, change: 0, changePercent: 0, volume: 500000, high: 23.20, low: 22.95, open: 23.02, previousClose: 23.02 },
  { symbol: "AHSGY", name: "Ahlatci Dogalgaz Dagitim A.S.", price: 19.97, change: 0, changePercent: 0, volume: 750000, high: 20.10, low: 19.85, open: 19.97, previousClose: 19.97 },
  { symbol: "AKBNK", name: "Akbank T.A.S.", price: 72.96, change: -2.78, changePercent: -3.68, volume: 69200000, high: 75.48, low: 72.50, open: 75.74, previousClose: 75.74 },
  { symbol: "AKCNS", name: "Akcansa Cimento Sanayi ve Ticaret A.S.", price: 140.50, change: -2.10, changePercent: -1.47, volume: 2500000, high: 143.00, low: 140.00, open: 142.60, previousClose: 142.60 },
  { symbol: "AKENR", name: "Ak Enerji Elektrik Uretim A.S.", price: 14.28, change: -0.30, changePercent: -2.06, volume: 15000000, high: 14.72, low: 14.20, open: 14.58, previousClose: 14.58 },
  { symbol: "AKFGY", name: "Akfen Gayrimenkul Yatirim Ortakligi A.S.", price: 22.50, change: 0.20, changePercent: 0.90, volume: 800000, high: 22.70, low: 22.20, open: 22.30, previousClose: 22.30 },
  { symbol: "AKFIS", name: "Akfen Insaat Turizm ve Ticaret A.S.", price: 45.48, change: 0, changePercent: 0, volume: 1000000, high: 46.16, low: 44.8, open: 45.48, previousClose: 45.48 },
  { symbol: "AKFYE", name: "Akfen Yenilenebilir Enerji A.S.", price: 35.60, change: -0.60, changePercent: -1.66, volume: 5000000, high: 36.40, low: 35.40, open: 36.20, previousClose: 36.20 },
  { symbol: "AKGRT", name: "Aksigorta A.S.", price: 68.90, change: 1.20, changePercent: 1.77, volume: 3200000, high: 69.50, low: 67.60, open: 67.70, previousClose: 67.70 },
  { symbol: "AKMGY", name: "Akmerkez Gayrimenkul Yatirim Ortakligi A.S.", price: 780.00, change: -15.00, changePercent: -1.89, volume: 450000, high: 798.00, low: 775.00, open: 795.00, previousClose: 795.00 },
  { symbol: "AKSA", name: "Aksa Akrilik Kimya Sanayii A.S.", price: 65.30, change: -0.90, changePercent: -1.36, volume: 4100000, high: 66.40, low: 65.10, open: 66.20, previousClose: 66.20 },
  { symbol: "AKSEN", name: "Aksa Enerji Uretim A.S.", price: 42.18, change: 0.48, changePercent: 1.15, volume: 12500000, high: 42.40, low: 41.40, open: 41.70, previousClose: 41.70 },
  { symbol: "AKSGY", name: "Akis Gayrimenkul Yatirim Ortakligi A.S.", price: 18.50, change: -0.20, changePercent: -1.07, volume: 1800000, high: 18.80, low: 18.40, open: 18.70, previousClose: 18.70 },
  { symbol: "AKYHO", name: "Ak-Al Tekstil Sanayii A.S.", price: 9.80, change: 0.10, changePercent: 1.03, volume: 2200000, high: 9.90, low: 9.65, open: 9.70, previousClose: 9.70 },
  { symbol: "ALARK", name: "Alarko Holding A.S.", price: 174.00, change: -3.40, changePercent: -1.92, volume: 1100000, high: 177.60, low: 173.00, open: 177.40, previousClose: 177.40 },
  { symbol: "ALBRK", name: "Albaraka Turk Katilim Bankasi A.S.", price: 22.80, change: -0.50, changePercent: -2.14, volume: 18000000, high: 23.40, low: 22.70, open: 23.30, previousClose: 23.30 },
  { symbol: "ALCAR", name: "Al-Tek Alkar Tic.", price: 36.00, change: 0.50, changePercent: 1.41, volume: 900000, high: 36.20, low: 35.40, open: 35.50, previousClose: 35.50 },
  { symbol: "ALFAS", name: "Alfa Solar Enerji Sanayi ve Ticaret A.S.", price: 37, change: 0, changePercent: 0, volume: 1000000, high: 37.55, low: 36.45, open: 37, previousClose: 37 },
  { symbol: "ALGYO", name: "Alarko Gayrimenkul Yatirim Ortakligi A.S.", price: 6.04, change: 0, changePercent: 0, volume: 1000000, high: 6.13, low: 5.95, open: 6.04, previousClose: 6.04 },
  { symbol: "ALKA", name: "Alkim Kagit Sanayi ve Ticaret A.S.", price: 10.72, change: 0, changePercent: 0, volume: 1000000, high: 10.88, low: 10.56, open: 10.72, previousClose: 10.72 },
  { symbol: "ALKIM", name: "Alkim Kimya Sanayi ve Ticaret A.S.", price: 260.80, change: -4.20, changePercent: -1.59, volume: 580000, high: 265.40, low: 260.00, open: 265.00, previousClose: 265.00 },
  { symbol: "ALKLC", name: "Alkollü İçkiler ve Tütün Mamulleri", price: 48.50, change: 1.10, changePercent: 2.32, volume: 3400000, high: 48.60, low: 47.20, open: 47.40, previousClose: 47.40 },
  { symbol: "ALVES", name: "Alves Kablo Sanayi ve Ticaret A.S.", price: 3.37, change: 0, changePercent: 0, volume: 1000000, high: 3.42, low: 3.32, open: 3.37, previousClose: 3.37 },
  { symbol: "ANELE", name: "Anel Elektrik Proje Taahhut ve Ticaret A.S.", price: 53.20, change: -1.60, changePercent: -2.92, volume: 2100000, high: 55.00, low: 52.80, open: 54.80, previousClose: 54.80 },
  { symbol: "ANGEN", name: "Anadolu Hayat Emeklilik A.S.", price: 38.20, change: 0.40, changePercent: 1.06, volume: 6800000, high: 38.50, low: 37.60, open: 37.80, previousClose: 37.80 },
  { symbol: "ANHYT", name: "Anadolu Hayat Emeklilik A.S.", price: 38.60, change: 0.60, changePercent: 1.58, volume: 7200000, high: 38.90, low: 37.90, open: 38.00, previousClose: 38.00 },
  { symbol: "ANSGR", name: "Anadolu Sigorta A.S.", price: 42.00, change: 0.80, changePercent: 1.94, volume: 4500000, high: 42.30, low: 41.00, open: 41.20, previousClose: 41.20 },
  { symbol: "ARCLK", name: "Arcelik A.S.", price: 98.50, change: -2.10, changePercent: -2.09, volume: 8700000, high: 100.90, low: 98.10, open: 100.60, previousClose: 100.60 },
  { symbol: "ARDYZ", name: "Arditi Yazilim A.S.", price: 12.50, change: 0.30, changePercent: 2.46, volume: 1500000, high: 12.60, low: 12.10, open: 12.20, previousClose: 12.20 },
  { symbol: "ARENA", name: "Arena Bilgisayar Sanayi ve Ticaret A.S.", price: 126.80, change: -2.40, changePercent: -1.86, volume: 420000, high: 129.60, low: 126.40, open: 129.20, previousClose: 129.20 },
  { symbol: "ARSAN", name: "Arsan Tekstil Ticaret ve Sanayi A.S.", price: 18.90, change: 0.20, changePercent: 1.07, volume: 1200000, high: 19.00, low: 18.60, open: 18.70, previousClose: 18.70 },
  { symbol: "ARTMS", name: "Artemis Hali Sanayi ve Ticaret A.S.", price: 42.4, change: 0, changePercent: 0, volume: 1000000, high: 43.04, low: 41.76, open: 42.4, previousClose: 42.4 },
  { symbol: "ASELS", name: "Aselsan Elektronik Sanayi ve Ticaret A.S.", price: 323.26, change: -6.74, changePercent: -2.04, volume: 11900000, high: 330.20, low: 321.00, open: 330.00, previousClose: 330.00 },
  { symbol: "ASGYO", name: "Asce Gayrimenkul Yatirim Ortakligi A.S.", price: 10.55, change: 0, changePercent: 0, volume: 1000000, high: 10.71, low: 10.39, open: 10.55, previousClose: 10.55 },
  { symbol: "ASUZU", name: "Anadolu Isuzu Otomotiv Sanayi ve Ticaret A.S.", price: 390.00, change: -8.40, changePercent: -2.11, volume: 280000, high: 399.00, low: 388.00, open: 398.40, previousClose: 398.40 },
  { symbol: "ATATP", name: "ATP Yazilim ve Teknoloji A.S.", price: 143.2, change: 0, changePercent: 0, volume: 1000000, high: 145.35, low: 141.05, open: 143.2, previousClose: 143.2 },
  { symbol: "ATATR", name: "Ata Turizm Isletmecilik Sanayi ve Dis Ticaret A.S.", price: 13.89, change: 0, changePercent: 0, volume: 1000000, high: 14.1, low: 13.68, open: 13.89, previousClose: 13.89 },
  { symbol: "ATEKS", name: "Akin Tekstil A.S.", price: 99.05, change: 9.99, changePercent: 9.99, volume: 13100, high: 99.05, low: 89.60, open: 89.60, previousClose: 89.60 },
  { symbol: "AVGYO", name: "Avrasya Gayrimenkul Yatirim Ortakligi A.S.", price: 14.80, change: -0.30, changePercent: -1.99, volume: 3200000, high: 15.20, low: 14.70, open: 15.10, previousClose: 15.10 },
  { symbol: "AVHOL", name: "Avrupa Yatirim Holding A.S.", price: 36.28, change: 0, changePercent: 0, volume: 1000000, high: 36.82, low: 35.74, open: 36.28, previousClose: 36.28 },
  { symbol: "AVOD", name: "A.V.O.D Kurutulmus Gida ve Tarim Urunleri Sanayi Ticaret A.S.", price: 4.62, change: 0, changePercent: 0, volume: 1000000, high: 4.69, low: 4.55, open: 4.62, previousClose: 4.62 },
  { symbol: "AVTUR", name: "Avrasya Petrol ve Turistik Tesisler Yatirimlar A.S.", price: 19.95, change: 0, changePercent: 0, volume: 1000000, high: 20.25, low: 19.65, open: 19.95, previousClose: 19.95 },
  { symbol: "AYDEM", name: "Aydem Yenilenebilir Enerji A.S.", price: 30.72, change: 0, changePercent: 0, volume: 1000000, high: 31.18, low: 30.26, open: 30.72, previousClose: 30.72 },
  { symbol: "AYEN", name: "Ayen Enerji A.S.", price: 14.50, change: 0.20, changePercent: 1.40, volume: 2800000, high: 14.60, low: 14.20, open: 14.30, previousClose: 14.30 },
  { symbol: "AYGAZ", name: "Aygaz A.S.", price: 173.60, change: -2.00, changePercent: -1.14, volume: 1900000, high: 176.00, low: 172.80, open: 175.60, previousClose: 175.60 },
  { symbol: "AZTEK", name: "Aztek Elektronik Tasarim Yazilim", price: 35.20, change: 0.70, changePercent: 2.03, volume: 890000, high: 35.40, low: 34.40, open: 34.50, previousClose: 34.50 },
  { symbol: "BAGFS", name: "Bagfas Bandirma Gubre Fabrikalari A.S.", price: 248.60, change: -4.60, changePercent: -1.82, volume: 380000, high: 253.40, low: 247.80, open: 253.20, previousClose: 253.20 },
  { symbol: "BAHKM", name: "Bahadir Kimya Sanayi ve Ticaret A.S.", price: 142.80, change: 0.00, changePercent: 0.00, volume: 0, high: 142.80, low: 142.80, open: 142.80, previousClose: 142.80 },
  { symbol: "BAKAB", name: "Bak Ambalaj Sanayi ve Ticaret A.S.", price: 8.52, change: -0.18, changePercent: -2.07, volume: 4500000, high: 8.76, low: 8.48, open: 8.70, previousClose: 8.70 },
  { symbol: "BALSU", name: "Balsu Gida Sanayi ve Ticaret A.S.", price: 14.33, change: 0, changePercent: 0, volume: 1000000, high: 14.54, low: 14.12, open: 14.33, previousClose: 14.33 },
  { symbol: "BANVT", name: "Banvit Bandirma Vitaminli Yem Fabrikalari A.S.", price: 18.00, change: 0.20, changePercent: 1.12, volume: 2100000, high: 18.14, low: 17.76, open: 17.80, previousClose: 17.80 },
  { symbol: "BERA", name: "Bera Holding A.S.", price: 12.82, change: -0.28, changePercent: -2.14, volume: 9800000, high: 13.14, low: 12.74, open: 13.10, previousClose: 13.10 },
  { symbol: "BFREN", name: "Bosch Fren Sistemleri Sanayi ve Ticaret A.S.", price: 136.7, change: 0, changePercent: 0, volume: 1000000, high: 138.75, low: 134.65, open: 136.7, previousClose: 136.7 },
  { symbol: "BIGCH", name: "Buyuk Sefler Gida Turizm Tekstil Sanayi ve Ticaret A.S.", price: 7.21, change: 0, changePercent: 0, volume: 1000000, high: 7.32, low: 7.1, open: 7.21, previousClose: 7.21 },
  { symbol: "BIMAS", name: "BIM Birlesik Magazalar A.S.", price: 703.52, change: -4.98, changePercent: -0.70, volume: 2200000, high: 710.00, low: 700.00, open: 708.50, previousClose: 708.50 },
  { symbol: "BIOEN", name: "Bio Enerji Yenilenebilir Enerji Uretim A.S.", price: 4.95, change: 0.05, changePercent: 1.02, volume: 15000000, high: 4.98, low: 4.85, open: 4.90, previousClose: 4.90 },
  { symbol: "BIZIM", name: "Bizim Toptan Satis Magazalari A.S.", price: 62.80, change: -1.40, changePercent: -2.18, volume: 1600000, high: 64.30, low: 62.50, open: 64.20, previousClose: 64.20 },
  { symbol: "BJKAS", name: "Besiktas Futbol Yatirimlari Sanayi ve Ticaret A.S.", price: 36.50, change: -0.80, changePercent: -2.14, volume: 8900000, high: 37.40, low: 36.30, open: 37.30, previousClose: 37.30 },
  { symbol: "BLCYT", name: "Bilici Yatirim Sanayi ve Ticaret A.S.", price: 47.94, change: 0, changePercent: 0, volume: 1000000, high: 48.66, low: 47.22, open: 47.94, previousClose: 47.94 },
  { symbol: "BMELK", name: "Borsa Istanbul Elektrik Uretim", price: 12.34, change: 0.14, changePercent: 1.15, volume: 3200000, high: 12.40, low: 12.10, open: 12.20, previousClose: 12.20 },
  { symbol: "BMEKS", name: "Bimeks Bilgi Islem ve Dis Ticaret A.S.", price: 5.68, change: -0.12, changePercent: -2.07, volume: 5600000, high: 5.84, low: 5.64, open: 5.80, previousClose: 5.80 },
  { symbol: "BNTAS", name: "Bantas Ambalaj Sanayi ve Ticaret A.S.", price: 24.80, change: 0.40, changePercent: 1.64, volume: 1200000, high: 24.90, low: 24.30, open: 24.40, previousClose: 24.40 },
  { symbol: "BORLS", name: "Borlas Bilisim Hizmetleri ve Ticaret A.S.", price: 23.60, change: -0.50, changePercent: -2.07, volume: 2800000, high: 24.20, low: 23.40, open: 24.10, previousClose: 24.10 },
  { symbol: "BOSSA", name: "Bossa Ticaret ve Sanayi Isletmeleri T.A.S.", price: 6.43, change: 0, changePercent: 0, volume: 1000000, high: 6.53, low: 6.33, open: 6.43, previousClose: 6.43 },
  { symbol: "BOYNR", name: "Boyner Perakende ve Tekstil Yatirimlari A.S.", price: 15.40, change: -0.30, changePercent: -1.91, volume: 3500000, high: 15.78, low: 15.32, open: 15.70, previousClose: 15.70 },
  { symbol: "BRISA", name: "Brisa Bridgestone Sabanci Lastik Sanayi ve Ticaret A.S.", price: 290.00, change: -5.20, changePercent: -1.76, volume: 650000, high: 296.40, low: 288.00, open: 295.20, previousClose: 295.20 },
  { symbol: "BRKO", name: "Birko Birlesik Mensucat Ticaret ve Sanayi A.S.", price: 12.19, change: 0, changePercent: 0, volume: 1000000, high: 12.37, low: 12.01, open: 12.19, previousClose: 12.19 },
  { symbol: "BRMEN", name: "Birlik Mensucat Ticaret ve Sanayi Isletmesi A.S.", price: 8.00, change: -0.72, changePercent: -8.30, volume: 1800000, high: 8.76, low: 7.96, open: 8.72, previousClose: 8.72 },
  { symbol: "BRSAN", name: "Borusan Mannesman Boru Sanayi ve Ticaret A.S.", price: 98.60, change: -2.00, changePercent: -1.99, volume: 1100000, high: 100.80, low: 98.20, open: 100.60, previousClose: 100.60 },
  { symbol: "BRYAT", name: "Boy Yapi A.S.", price: 14.60, change: 0.30, changePercent: 2.10, volume: 4500000, high: 14.70, low: 14.20, open: 14.30, previousClose: 14.30 },
  { symbol: "BSOKE", name: "Batisoke Soke Cimento Sanayi T.A.S.", price: 46.70, change: -0.90, changePercent: -1.89, volume: 2200000, high: 47.80, low: 46.50, open: 47.60, previousClose: 47.60 },
  { symbol: "BTCIM", name: "Bolu Cimento Sanayi A.S.", price: 80.60, change: -1.60, changePercent: -1.95, volume: 890000, high: 82.40, low: 80.20, open: 82.20, previousClose: 82.20 },
  { symbol: "BULGS", name: "Bulls Girisim Sermayesi Yatirim Ortakligi A.S.", price: 45.36, change: 0, changePercent: 0, volume: 1000000, high: 46.04, low: 44.68, open: 45.36, previousClose: 45.36 },
  { symbol: "BURCE", name: "Burcelik Bursa Celik Dokumhanesi A.S.", price: 18.20, change: 0.30, changePercent: 1.68, volume: 3100000, high: 18.30, low: 17.80, open: 17.90, previousClose: 17.90 },
  { symbol: "BURVA", name: "Bursa Yatirim Holding A.S.", price: 38.40, change: -0.80, changePercent: -2.04, volume: 1400000, high: 39.40, low: 38.20, open: 39.20, previousClose: 39.20 },
  { symbol: "CANTE", name: "CAN2 TERMIK A.S.", price: 1.52, change: -0.086, changePercent: -5.30, volume: 42000000, high: 1.62, low: 1.51, open: 1.61, previousClose: 1.61 },
  { symbol: "CCOLA", name: "Coca-Cola Icecek A.S.", price: 620.00, change: -12.40, changePercent: -1.96, volume: 780000, high: 634.00, low: 616.00, open: 632.40, previousClose: 632.40 },
  { symbol: "CELHA", name: "Celebi Hava Servisi A.S.", price: 168.40, change: -3.60, changePercent: -2.09, volume: 540000, high: 172.20, low: 167.60, open: 172.00, previousClose: 172.00 },
  { symbol: "CEMAS", name: "Cemas Dokum Sanayi A.S.", price: 14.90, change: 0.20, changePercent: 1.36, volume: 8200000, high: 14.96, low: 14.60, open: 14.70, previousClose: 14.70 },
  { symbol: "CEMTS", name: "Cementir Holding A.S.", price: 59.00, change: -1.20, changePercent: -1.99, volume: 1300000, high: 60.40, low: 58.70, open: 60.20, previousClose: 60.20 },
  { symbol: "CEOEM", name: "Ceo Event Medya A.S.", price: 20.86, change: 0, changePercent: 0, volume: 1000000, high: 21.17, low: 20.55, open: 20.86, previousClose: 20.86 },
  { symbol: "CMBTN", name: "Cimbeton Hazir Beton ve Prefabrik Yapi Elemanlari A.S.", price: 1682, change: 0, changePercent: 0, volume: 1000000, high: 1707.23, low: 1656.77, open: 1682, previousClose: 1682 },
  { symbol: "CMENT", name: "Cimentas Izmir Cimento Fabrikasi Turk A.S.", price: 311, change: 0, changePercent: 0, volume: 1000000, high: 315.66, low: 306.33, open: 311, previousClose: 311 },
  { symbol: "CVKMD", name: "CVK Maden Isletmeleri Sanayi ve Ticaret A.S.", price: 32.3, change: 0, changePercent: 0, volume: 1000000, high: 32.78, low: 31.82, open: 32.3, previousClose: 32.3 },
  { symbol: "DAPGM", name: "Dap Gayrimenkul Gelistirme A.S.", price: 13.91, change: 1.24, changePercent: 9.53, volume: 32000000, high: 13.91, low: 12.60, open: 12.67, previousClose: 12.67 },
  { symbol: "DESA", name: "Desa Deri Sanayi ve Ticaret A.S.", price: 24.80, change: 0.50, changePercent: 2.06, volume: 2800000, high: 24.90, low: 24.20, open: 24.30, previousClose: 24.30 },
  { symbol: "DESPC", name: "Despc A.S.", price: 28.40, change: -0.60, changePercent: -2.07, volume: 1800000, high: 29.10, low: 28.20, open: 29.00, previousClose: 29.00 },
  { symbol: "DEVA", name: "Deva Holding A.S.", price: 34.50, change: -0.70, changePercent: -1.99, volume: 5600000, high: 35.30, low: 34.30, open: 35.20, previousClose: 35.20 },
  { symbol: "DGATE", name: "Datagate Bilgisayar Malzemeleri Ticaret A.S.", price: 22.60, change: 0.40, changePercent: 1.81, volume: 3200000, high: 22.70, low: 22.10, open: 22.20, previousClose: 22.20 },
  { symbol: "DGGYO", name: "Dogus Gayrimenkul Yatirim Ortakligi A.S.", price: 6.80, change: -0.14, changePercent: -2.02, volume: 21000000, high: 6.96, low: 6.76, open: 6.94, previousClose: 6.94 },
  { symbol: "DMSAS", name: "Demisas Dokum ve Emaye Mamulleri A.S.", price: 28.00, change: 0.50, changePercent: 1.82, volume: 1100000, high: 28.10, low: 27.40, open: 27.50, previousClose: 27.50 },
  { symbol: "DNISI", name: "Denizli Is Giysim Sanayii A.S.", price: 19.80, change: -0.40, changePercent: -1.98, volume: 2300000, high: 20.30, low: 19.70, open: 20.20, previousClose: 20.20 },
  { symbol: "DOAS", name: "Dogus Otomotiv Servis ve Ticaret A.S.", price: 245.00, change: -5.00, changePercent: -2.00, volume: 1200000, high: 250.20, low: 243.80, open: 250.00, previousClose: 250.00 },
  { symbol: "DOCO", name: "Do & Co Aktiengesellschaft", price: 580.00, change: -12.00, changePercent: -2.03, volume: 380000, high: 594.00, low: 578.00, open: 592.00, previousClose: 592.00 },
  { symbol: "DOFRB", name: "Dof Robotik A.S.", price: 109.9, change: 0, changePercent: 0, volume: 1000000, high: 111.55, low: 108.25, open: 109.9, previousClose: 109.9 },
  { symbol: "DOGUB", name: "Dogusan Boru Sanayi ve Ticaret A.S.", price: 18.90, change: 0.30, changePercent: 1.61, volume: 4200000, high: 19.00, low: 18.50, open: 18.60, previousClose: 18.60 },
  { symbol: "DSTKF", name: "Destek Finans Faktoring Hizmetleri A.S.", price: 1623.00, change: -175.00, changePercent: -9.83, volume: 1100000, high: 1800.00, low: 1620.00, open: 1798.00, previousClose: 1798.00 },
  { symbol: "DYHOL", name: "Dogan Sirketler Grubu Holding A.S.", price: 14.80, change: -0.30, changePercent: -1.99, volume: 42000000, high: 15.16, low: 14.72, open: 15.10, previousClose: 15.10 },
  { symbol: "DZGYO", name: "Deniz Gayrimenkul Yatirim Ortakligi A.S.", price: 7.7, change: 0, changePercent: 0, volume: 1000000, high: 7.82, low: 7.58, open: 7.7, previousClose: 7.7 },
  { symbol: "ECILC", name: "Eci Ilac Sanayi ve Ticaret A.S.", price: 64.90, change: -1.30, changePercent: -1.96, volume: 1500000, high: 66.30, low: 64.60, open: 66.20, previousClose: 66.20 },
  { symbol: "ECOGR", name: "Ecogreen Enerji Holding A.S.", price: 30.02, change: 2.90, changePercent: 9.96, volume: 74100000, high: 30.02, low: 27.10, open: 27.12, previousClose: 27.12 },
  { symbol: "EDATA", name: "E-Data Teknoloji Pazarlama A.S.", price: 16.62, change: 0, changePercent: 0, volume: 1000000, high: 16.87, low: 16.37, open: 16.62, previousClose: 16.62 },
  { symbol: "EDIP", name: "Edip Gayrimenkul Yatirim Sanayi ve Ticaret A.S.", price: 14.60, change: 0.20, changePercent: 1.39, volume: 3800000, high: 14.70, low: 14.30, open: 14.40, previousClose: 14.40 },
  { symbol: "EFOR", name: "Efor Yatirim Sanayi Ticaret A.S.", price: 9.85, change: 0, changePercent: 0, volume: 1000000, high: 10, low: 9.7, open: 9.85, previousClose: 9.85 },
  { symbol: "EGEEN", name: "Ege Endustri ve Ticaret A.S.", price: 880.00, change: -18.00, changePercent: -2.00, volume: 280000, high: 900.00, low: 876.00, open: 898.00, previousClose: 898.00 },
  { symbol: "EGGUB", name: "Ege Gubre Sanayii A.S.", price: 45.80, change: -0.90, changePercent: -1.93, volume: 1100000, high: 46.90, low: 45.60, open: 46.70, previousClose: 46.70 },
  { symbol: "EGPRO", name: "Ege Profil Ticaret ve Sanayi A.S.", price: 42.60, change: 0.80, changePercent: 1.91, volume: 1600000, high: 42.80, low: 41.60, open: 41.80, previousClose: 41.80 },
  { symbol: "EGSER", name: "Ege Seramik Sanayi ve Ticaret A.S.", price: 56.20, change: -1.10, changePercent: -1.92, volume: 1400000, high: 57.50, low: 55.90, open: 57.30, previousClose: 57.30 },
  { symbol: "EKGYO", name: "Emlak Konut Gayrimenkul Yatirim Ortakligi A.S.", price: 28.60, change: -0.60, changePercent: -2.06, volume: 95000000, high: 29.30, low: 28.40, open: 29.20, previousClose: 29.20 },
  { symbol: "EKIZ", name: "Ekiz Kimya Sanayi ve Ticaret A.S.", price: 92.05, change: 0, changePercent: 0, volume: 1000000, high: 93.43, low: 90.67, open: 92.05, previousClose: 92.05 },
  { symbol: "EMKEL", name: "Emkel Elektrik Malzemeleri", price: 78.40, change: 1.40, changePercent: 1.82, volume: 890000, high: 78.80, low: 76.80, open: 77.00, previousClose: 77.00 },
  { symbol: "EMPAE", name: "Empa Elektronik Sanayi ve Ticaret A.S.", price: 37.76, change: 3.64, changePercent: 9.96, volume: 16800000, high: 37.76, low: 34.10, open: 34.12, previousClose: 34.12 },
  { symbol: "ENKAI", name: "Enka Insaat ve Sanayi A.S.", price: 48.86, change: -1.00, changePercent: -2.01, volume: 18000000, high: 49.96, low: 48.62, open: 49.86, previousClose: 49.86 },
  { symbol: "EREGL", name: "Eregli Demir ve Celik Fabrikalari T.A.S.", price: 56.75, change: -1.15, changePercent: -1.99, volume: 35000000, high: 58.10, low: 56.40, open: 57.90, previousClose: 57.90 },
  { symbol: "ERSU", name: "Ersu Meyve ve Gida Sanayii A.S.", price: 34.20, change: 0.60, changePercent: 1.79, volume: 1200000, high: 34.30, low: 33.50, open: 33.60, previousClose: 33.60 },
  { symbol: "EUHOL", name: "Euro Holding", price: 91.44, change: -5.38, changePercent: -5.68, volume: 1200000, high: 97.20, low: 91.00, open: 96.82, previousClose: 96.82 },
  { symbol: "EYGYO", name: "Eyup Gayrimenkul Yatirim Ortakligi A.S.", price: 3.22, change: -0.20, changePercent: -5.85, volume: 8900000, high: 3.44, low: 3.20, open: 3.42, previousClose: 3.42 },
  { symbol: "FENER", name: "Fenerbahce Futbol A.S.", price: 28.50, change: -0.60, changePercent: -2.06, volume: 12000000, high: 29.20, low: 28.30, open: 29.10, previousClose: 29.10 },
  { symbol: "FLAP", name: "Flap Kongre ve Toplantilar Hizmetleri A.S.", price: 14.10, change: 0.20, changePercent: 1.44, volume: 3400000, high: 14.20, low: 13.80, open: 13.90, previousClose: 13.90 },
  { symbol: "FMIZP", name: "Federal-Mogul Izmit Piston ve Pim A.S.", price: 86.80, change: -1.80, changePercent: -2.03, volume: 580000, high: 88.80, low: 86.40, open: 88.60, previousClose: 88.60 },
  { symbol: "FONET", name: "Fonet Bilgi Teknolojileri A.S.", price: 5.15, change: 0, changePercent: 0, volume: 1000000, high: 5.23, low: 5.07, open: 5.15, previousClose: 5.15 },
  { symbol: "FORMT", name: "Formet Metal ve Cam Sanayi A.S.", price: 2.73, change: 0, changePercent: 0, volume: 1000000, high: 2.77, low: 2.69, open: 2.73, previousClose: 2.73 },
  { symbol: "FROTO", name: "Ford Otomotiv Sanayi A.S.", price: 1680.00, change: -34.00, changePercent: -1.98, volume: 890000, high: 1716.00, low: 1672.00, open: 1714.00, previousClose: 1714.00 },
  { symbol: "FZLGY", name: "Fuzul Gayrimenkul Yatirim Ortakligi A.S.", price: 15.25, change: 0, changePercent: 0, volume: 1000000, high: 15.48, low: 15.02, open: 15.25, previousClose: 15.25 },
  { symbol: "GARAN", name: "Turkiye Garanti Bankasi A.S.", price: 118.40, change: -2.40, changePercent: -1.99, volume: 52000000, high: 121.00, low: 117.80, open: 120.80, previousClose: 120.80 },
  { symbol: "GATEG", name: "Gate Elektronik Teknoloji A.S.", price: 45.20, change: 1.10, changePercent: 2.49, volume: 3200000, high: 45.80, low: 44.50, open: 44.10, previousClose: 44.10 },
  { symbol: "GEDIK", name: "Gedik Yatirim Menkul Degerler A.S.", price: 36.80, change: 0.60, changePercent: 1.66, volume: 2100000, high: 36.90, low: 36.00, open: 36.20, previousClose: 36.20 },
  { symbol: "GEDZA", name: "Gediz Ambalaj Sanayi ve Ticaret A.S.", price: 18.20, change: -0.40, changePercent: -2.15, volume: 1800000, high: 18.70, low: 18.10, open: 18.60, previousClose: 18.60 },
  { symbol: "GENKM", name: "Gentas Kimya Sanayi ve Ticaret A.S.", price: 15.94, change: -1.76, changePercent: -9.99, volume: 136400000, high: 17.74, low: 15.90, open: 17.70, previousClose: 17.70 },
  { symbol: "GEREL", name: "Gersan Elektrik Ticaret ve Sanayi A.S.", price: 12.40, change: 0.20, changePercent: 1.64, volume: 4800000, high: 12.50, low: 12.10, open: 12.20, previousClose: 12.20 },
  { symbol: "GLBMD", name: "Global Menkul Degerler A.S.", price: 14.80, change: 0.30, changePercent: 2.07, volume: 5400000, high: 14.90, low: 14.40, open: 14.50, previousClose: 14.50 },
  { symbol: "GLRYH", name: "Gloray Holding", price: 25.40, change: -0.50, changePercent: -1.93, volume: 1200000, high: 26.00, low: 25.20, open: 25.90, previousClose: 25.90 },
  { symbol: "GLYHO", name: "Global Yatirim Holding A.S.", price: 38.00, change: -0.80, changePercent: -2.06, volume: 3600000, high: 38.90, low: 37.80, open: 38.80, previousClose: 38.80 },
  { symbol: "GOLTS", name: "Goltas Goller Bolgesi Cimento Sanayi ve Ticaret A.S.", price: 48.60, change: -1.00, changePercent: -2.02, volume: 680000, high: 49.80, low: 48.40, open: 49.60, previousClose: 49.60 },
  { symbol: "GOODY", name: "Goodyear Lastikleri T.A.S.", price: 98.20, change: -2.00, changePercent: -1.99, volume: 420000, high: 100.40, low: 97.80, open: 100.20, previousClose: 100.20 },
  { symbol: "GOZDE", name: "Gozde Girisim Sermayesi Yatirim Ortakligi A.S.", price: 28.40, change: 0.50, changePercent: 1.79, volume: 2900000, high: 28.50, low: 27.80, open: 27.90, previousClose: 27.90 },
  { symbol: "GUBRF", name: "Gubre Fabrikalari T.A.S.", price: 190.00, change: -3.80, changePercent: -1.96, volume: 1100000, high: 194.20, low: 189.20, open: 193.80, previousClose: 193.80 },
  { symbol: "GWIND", name: "Guris Holding A.S.", price: 22.80, change: 0.40, changePercent: 1.79, volume: 4200000, high: 22.90, low: 22.30, open: 22.40, previousClose: 22.40 },
  { symbol: "HALKB", name: "Turkiye Halk Bankasi A.S.", price: 42.58, change: -0.86, changePercent: -1.98, volume: 58000000, high: 43.58, low: 42.34, open: 43.44, previousClose: 43.44 },
  { symbol: "HEKTS", name: "Hektas Ticaret T.A.S.", price: 3.08, change: -0.024, changePercent: -0.78, volume: 12000000, high: 3.14, low: 3.06, open: 3.10, previousClose: 3.10 },
  { symbol: "HLGYO", name: "Halk Gayrimenkul Yatirim Ortakligi A.S.", price: 4.84, change: 0, changePercent: 0, volume: 1000000, high: 4.91, low: 4.77, open: 4.84, previousClose: 4.84 },
  { symbol: "HRKET", name: "Hareket Proje Tasimaciligi ve Yuk Muhendisligi A.S.", price: 61.25, change: 0, changePercent: 0, volume: 1000000, high: 62.17, low: 60.33, open: 61.25, previousClose: 61.25 },
  { symbol: "HUBVC", name: "Hub Girisim Sermayesi Yatirim Ortakligi A.S.", price: 3.76, change: 0, changePercent: 0, volume: 1000000, high: 3.82, low: 3.7, open: 3.76, previousClose: 3.76 },
  { symbol: "HURGZ", name: "Hurriyet Gazetecilik ve Matbaacilik A.S.", price: 6.56, change: 0.60, changePercent: 9.52, volume: 28000000, high: 6.56, low: 5.96, open: 5.96, previousClose: 5.96 },
  { symbol: "ICBCT", name: "ICBC Turkey Bank A.S.", price: 16.80, change: -0.34, changePercent: -1.98, volume: 8900000, high: 17.18, low: 16.72, open: 17.14, previousClose: 17.14 },
  { symbol: "ICUGS", name: "Icugsas Sanayi ve Ticaret A.S.", price: 25.40, change: 0.40, changePercent: 1.60, volume: 3200000, high: 25.60, low: 24.90, open: 25.00, previousClose: 25.00 },
  { symbol: "IMASM", name: "Imasm A.S.", price: 39.40, change: 0.70, changePercent: 1.81, volume: 1600000, high: 39.50, low: 38.60, open: 38.70, previousClose: 38.70 },
  { symbol: "ISCTR", name: "Turkiye Is Bankasi Anonim Sirketi C", price: 14.04, change: -0.33, changePercent: -2.30, volume: 82000000, high: 14.40, low: 13.96, open: 14.37, previousClose: 14.37 },
  { symbol: "ISDMR", name: "Iskenderun Demir ve Celik A.S.", price: 16.48, change: -0.34, changePercent: -2.02, volume: 22000000, high: 16.88, low: 16.40, open: 16.82, previousClose: 16.82 },
  { symbol: "ISFIN", name: "Is Finansal Kiralama A.S.", price: 18.60, change: -0.38, changePercent: -2.00, volume: 3400000, high: 19.04, low: 18.50, open: 18.98, previousClose: 18.98 },
  { symbol: "ISGSY", name: "Is Girisim Sermayesi Yatirim Ortakligi A.S.", price: 69.20, change: -1.40, changePercent: -1.98, volume: 680000, high: 70.80, low: 68.90, open: 70.60, previousClose: 70.60 },
  { symbol: "ISGYO", name: "Is Gayrimenkul Yatirim Ortakligi A.S.", price: 34.80, change: -0.70, changePercent: -1.97, volume: 9600000, high: 35.60, low: 34.60, open: 35.50, previousClose: 35.50 },
  { symbol: "ISMEN", name: "Is Yatirim Menkul Degerler A.S.", price: 18.06, change: -0.37, changePercent: -2.01, volume: 5800000, high: 18.50, low: 17.98, open: 18.43, previousClose: 18.43 },
  { symbol: "ISYAT", name: "Is Yatirim Ortakligi A.S.", price: 8.14, change: 0, changePercent: 0, volume: 1000000, high: 8.26, low: 8.02, open: 8.14, previousClose: 8.14 },
  { symbol: "IZFAS", name: "Izmir Firca Sanayi ve Ticaret A.S.", price: 51.6, change: 0, changePercent: 0, volume: 1000000, high: 52.37, low: 50.83, open: 51.6, previousClose: 51.6 },
  { symbol: "IZINV", name: "Iz Yatirim Holding A.S.", price: 70.85, change: 0, changePercent: 0, volume: 1000000, high: 71.91, low: 69.79, open: 70.85, previousClose: 70.85 },
  { symbol: "KARSN", name: "Karsan Otomotiv Sanayii ve Ticaret A.S.", price: 34.20, change: -0.70, changePercent: -2.01, volume: 8900000, high: 35.00, low: 34.00, open: 34.90, previousClose: 34.90 },
  { symbol: "KCAER", name: "Koc Ceza ve Bakim", price: 86.80, change: 1.60, changePercent: 1.88, volume: 720000, high: 87.00, low: 84.80, open: 85.20, previousClose: 85.20 },
  { symbol: "KCHOL", name: "Koc Holding A.S.", price: 242.00, change: -4.80, changePercent: -1.94, volume: 12000000, high: 247.20, low: 240.60, open: 246.80, previousClose: 246.80 },
  { symbol: "KERVN", name: "Kervan Gida Sanayi ve Ticaret A.S.", price: 3.19, change: -0.24, changePercent: -7.00, volume: 18000000, high: 3.45, low: 3.17, open: 3.43, previousClose: 3.43 },
  { symbol: "KIMMR", name: "Kimmr A.S.", price: 19.93, change: 1.37, changePercent: 7.44, volume: 6800000, high: 19.93, low: 18.40, open: 18.56, previousClose: 18.56 },
  { symbol: "KLGYO", name: "Kiler Gayrimenkul Yatirim Ortakligi A.S.", price: 28.00, change: 0.50, changePercent: 1.82, volume: 3200000, high: 28.10, low: 27.40, open: 27.50, previousClose: 27.50 },
  { symbol: "KLMSN", name: "Klimasan Klima Sanayi ve Ticaret A.S.", price: 29.86, change: 0, changePercent: 0, volume: 1000000, high: 30.31, low: 29.41, open: 29.86, previousClose: 29.86 },
  { symbol: "KLNMA", name: "Kalkinma Yatirim Bankasi A.S.", price: 14.28, change: -0.29, changePercent: -1.99, volume: 4800000, high: 14.62, low: 14.20, open: 14.57, previousClose: 14.57 },
  { symbol: "KLRHO", name: "KILER HOLDING A.S.", price: 177.50, change: -19.60, changePercent: -9.99, volume: 6500000, high: 197.10, low: 177.00, open: 197.10, previousClose: 197.10 },
  { symbol: "KLSYN", name: "Kalsin Yapi Sanayi ve Ticaret A.S.", price: 16.40, change: 0.30, changePercent: 1.86, volume: 2100000, high: 16.50, low: 16.00, open: 16.10, previousClose: 16.10 },
  { symbol: "KMPUR", name: "Kempursan A.S.", price: 65.40, change: -1.30, changePercent: -1.95, volume: 980000, high: 66.90, low: 65.10, open: 66.70, previousClose: 66.70 },
  { symbol: "KONYA", name: "Konya Cimento Sanayii A.S.", price: 465.00, change: -9.40, changePercent: -1.98, volume: 580000, high: 475.00, low: 462.00, open: 474.40, previousClose: 474.40 },
  { symbol: "KOZAA", name: "Koza Anadolu Metal Madencilik Isletmeleri A.S.", price: 14.76, change: -0.30, changePercent: -1.99, volume: 15000000, high: 15.12, low: 14.68, open: 15.06, previousClose: 15.06 },
  { symbol: "KOZAL", name: "Koza Altin Isletmeleri A.S.", price: 1086.00, change: -22.00, changePercent: -1.99, volume: 620000, high: 1110.00, low: 1080.00, open: 1108.00, previousClose: 1108.00 },
  { symbol: "KRDMD", name: "Kardemir Karabuk Demir Celik Sanayi ve Ticaret A.S.", price: 8.16, change: -0.17, changePercent: -2.04, volume: 72000000, high: 8.36, low: 8.12, open: 8.33, previousClose: 8.33 },
  { symbol: "KRSTL", name: "Kristal Kola ve Mesrubat Sanayi Ticaret A.S.", price: 54.80, change: -1.10, changePercent: -1.97, volume: 1100000, high: 56.10, low: 54.60, open: 55.90, previousClose: 55.90 },
  { symbol: "LKSYN", name: "Luks Kadife Ticaret ve Sanayi Isletmesi A.S.", price: 9.52, change: 0.18, changePercent: 1.93, volume: 2800000, high: 9.56, low: 9.28, open: 9.34, previousClose: 9.34 },
  { symbol: "LMKDC", name: "Limak Dogu Anadolu Cimento", price: 48.80, change: -1.00, changePercent: -2.01, volume: 890000, high: 50.00, low: 48.60, open: 49.80, previousClose: 49.80 },
  { symbol: "LOGO", name: "Logo Yazilim Sanayi ve Ticaret A.S.", price: 285.00, change: -5.80, changePercent: -1.99, volume: 420000, high: 291.40, low: 283.80, open: 290.80, previousClose: 290.80 },
  { symbol: "LXGYO", name: "Luxera Gayrimenkul Yatirim Ortakligi A.S.", price: 17.62, change: 1.60, changePercent: 9.99, volume: 6100000, high: 17.62, low: 15.98, open: 16.02, previousClose: 16.02 },
  { symbol: "MARKA", name: "Marka Yatirim Holding A.S.", price: 24.20, change: -2.66, changePercent: -9.97, volume: 3800000, high: 26.86, low: 24.14, open: 26.86, previousClose: 26.86 },
  { symbol: "MCARD", name: "Metropol Kurumsal Hizmetler A.S.", price: 106.40, change: 9.54, changePercent: 9.92, volume: 282300, high: 106.40, low: 96.64, open: 96.86, previousClose: 96.86 },
  { symbol: "MAVI", name: "Mavi Giyim Sanayi ve Ticaret A.S.", price: 126.80, change: -2.60, changePercent: -2.01, volume: 1800000, high: 129.80, low: 126.20, open: 129.40, previousClose: 129.40 },
  { symbol: "MIATK", name: "Mia Teknoloji A.S.", price: 82.40, change: 1.50, changePercent: 1.85, volume: 1200000, high: 82.80, low: 80.60, open: 80.90, previousClose: 80.90 },
  { symbol: "MIGROS", name: "Migros Ticaret A.S.", price: 498.00, change: -10.00, changePercent: -1.97, volume: 680000, high: 509.60, low: 495.80, open: 508.00, previousClose: 508.00 },
  { symbol: "MMCAS", name: "Mmc Sanayi ve Ticari Yatirimlar A.S.", price: 91.44, change: -5.68, changePercent: -5.85, volume: 890000, high: 97.40, low: 90.80, open: 97.12, previousClose: 97.12 },
  { symbol: "MPARK", name: "MLP Saglik Hizmetleri A.S.", price: 214.00, change: -4.40, changePercent: -2.01, volume: 1800000, high: 219.00, low: 213.00, open: 218.40, previousClose: 218.40 },
  { symbol: "MOBTL", name: "Mobiltel Haberlesme Perakende Hizmetleri A.S.", price: 18.50, change: 0.30, changePercent: 1.65, volume: 5200000, high: 18.70, low: 18.10, open: 18.20, previousClose: 18.20 },
  { symbol: "NETAS", name: "Netas Telekomunikasyon A.S.", price: 22.60, change: 0.40, changePercent: 1.80, volume: 3800000, high: 22.70, low: 22.10, open: 22.20, previousClose: 22.20 },
  { symbol: "NTHOL", name: "Net Holding A.S.", price: 8.50, change: -0.18, changePercent: -2.07, volume: 12000000, high: 8.72, low: 8.46, open: 8.68, previousClose: 8.68 },
  { symbol: "NTTUR", name: "Nuh Turistik Tesisleri A.S.", price: 16.20, change: 0.30, changePercent: 1.89, volume: 1900000, high: 16.30, low: 15.80, open: 15.90, previousClose: 15.90 },
  { symbol: "OBAMS", name: "Oba Meyve Sulari A.S.", price: 14.60, change: 0.26, changePercent: 1.81, volume: 2400000, high: 14.70, low: 14.26, open: 14.34, previousClose: 14.34 },
  { symbol: "ODAS", name: "Odas Elektrik Uretim A.S.", price: 28.40, change: -0.58, changePercent: -2.00, volume: 4500000, high: 29.06, low: 28.26, open: 28.98, previousClose: 28.98 },
  { symbol: "ONCSM", name: "Oncuboy Celik Kaplamali Yapi Elemanlari", price: 36.80, change: 0.66, changePercent: 1.83, volume: 1200000, high: 37.00, low: 36.00, open: 36.14, previousClose: 36.14 },
  { symbol: "ORGE", name: "Orge Enerji Elektrik Taahhut A.S.", price: 86.20, change: -1.76, changePercent: -2.00, volume: 480000, high: 88.20, low: 85.80, open: 87.96, previousClose: 87.96 },
  { symbol: "OTKAR", name: "Otokar Otomotiv ve Savunma Sanayi A.S.", price: 2870.00, change: -58.00, changePercent: -1.98, volume: 280000, high: 2930.00, low: 2858.00, open: 2928.00, previousClose: 2928.00 },
  { symbol: "OYAKC", name: "Oyak Cimento Fabrikalari A.S.", price: 46.20, change: -0.94, changePercent: -1.99, volume: 2100000, high: 47.28, low: 46.00, open: 47.14, previousClose: 47.14 },
  { symbol: "OZGYO", name: "Ozderici Gayrimenkul Yatirim Ortakligi A.S.", price: 12.60, change: 0.22, changePercent: 1.78, volume: 4800000, high: 12.70, low: 12.30, open: 12.38, previousClose: 12.38 },
  { symbol: "PETKM", name: "Petkim Petrokimya Holding A.S.", price: 18.44, change: -0.38, changePercent: -2.02, volume: 28000000, high: 18.88, low: 18.34, open: 18.82, previousClose: 18.82 },
  { symbol: "PEKGY", name: "Peker Gayrimenkul Yatirim Ortakligi", price: 13.53, change: -0.45, changePercent: -3.18, volume: 22000000, high: 14.02, low: 13.50, open: 13.98, previousClose: 13.98 },
  { symbol: "PGSUS", name: "Pegasus Hava Tasimaciligi A.S.", price: 176.86, change: -2.14, changePercent: -1.19, volume: 6600000, high: 179.40, low: 175.80, open: 179.00, previousClose: 179.00 },
  { symbol: "PKENT", name: "Petrokent Turizm A.S.", price: 58.60, change: -1.20, changePercent: -2.01, volume: 780000, high: 60.00, low: 58.40, open: 59.80, previousClose: 59.80 },
  { symbol: "PLTUR", name: "Platform Turizm Tasimacilik Gida Insaat Hizmetleri A.S.", price: 23.98, change: 0, changePercent: 0, volume: 1000000, high: 24.34, low: 23.62, open: 23.98, previousClose: 23.98 },
  { symbol: "POLHO", name: "Polisan Holding A.S.", price: 9.68, change: -0.20, changePercent: -2.02, volume: 14000000, high: 9.92, low: 9.64, open: 9.88, previousClose: 9.88 },
  { symbol: "PRDGS", name: "Paradigma Yatirim Holding A.S.", price: 18.80, change: 0.34, changePercent: 1.84, volume: 3200000, high: 18.90, low: 18.40, open: 18.46, previousClose: 18.46 },
  { symbol: "PRKAB", name: "Turk Prysmian Kablo ve Sistemleri A.S.", price: 40.38, change: 0, changePercent: 0, volume: 1000000, high: 40.99, low: 39.77, open: 40.38, previousClose: 40.38 },
  { symbol: "PTOFS", name: "Petrol Ofisi A.S.", price: 156.00, change: -3.20, changePercent: -2.01, volume: 2100000, high: 159.60, low: 155.40, open: 159.20, previousClose: 159.20 },
  { symbol: "QUAGR", name: "Qua Granite Hayal Yapi Urunleri A.S.", price: 24.20, change: 0.44, changePercent: 1.85, volume: 1800000, high: 24.30, low: 23.68, open: 23.76, previousClose: 23.76 },
  { symbol: "RAYSG", name: "Rayl Sigorta A.S.", price: 14.80, change: 0.26, changePercent: 1.79, volume: 2200000, high: 14.90, low: 14.46, open: 14.54, previousClose: 14.54 },
  { symbol: "REEDR", name: "Reeder Elektronik Ticaret A.S.", price: 24.00, change: -0.50, changePercent: -2.04, volume: 3400000, high: 24.60, low: 23.90, open: 24.50, previousClose: 24.50 },
  { symbol: "RGYAS", name: "Reysas Gayrimenkul Yatirim Ortakligi A.S.", price: 32.40, change: -0.66, changePercent: -2.00, volume: 4200000, high: 33.16, low: 32.26, open: 33.06, previousClose: 33.06 },
  { symbol: "RYGYO", name: "Reysas Gayrimenkul Yatirim Ortakligi A.S.", price: 30.06, change: 0, changePercent: 0, volume: 1000000, high: 30.51, low: 29.61, open: 30.06, previousClose: 30.06 },
  { symbol: "RYSAS", name: "Reysas Lojistik ve Tasimacilik A.S.", price: 19.68, change: -0.40, changePercent: -1.99, volume: 8900000, high: 20.14, low: 19.58, open: 20.08, previousClose: 20.08 },
  { symbol: "SARKY", name: "Sarkuysan Elektrolitik Bakir Sanayi ve Ticaret A.S.", price: 28.74, change: 0, changePercent: 0, volume: 1000000, high: 29.17, low: 28.31, open: 28.74, previousClose: 28.74 },
  { symbol: "SASA", name: "Sasa Polyester Sanayi A.S.", price: 2.56, change: 0.137, changePercent: 5.61, volume: 180000000, high: 2.58, low: 2.40, open: 2.42, previousClose: 2.42 },
  { symbol: "SELGD", name: "Selcuk Gida Endustri Ihracat Ithalat A.S.", price: 18.40, change: 0.33, changePercent: 1.83, volume: 3800000, high: 18.50, low: 18.00, open: 18.07, previousClose: 18.07 },
  { symbol: "SELVA", name: "Selva Gida Sanayi A.S.", price: 2.24, change: 0, changePercent: 0, volume: 1000000, high: 2.27, low: 2.21, open: 2.24, previousClose: 2.24 },
  { symbol: "SISE", name: "Turkiye Sise ve Cam Fabrikalari A.S.", price: 56.20, change: -1.15, changePercent: -2.00, volume: 24000000, high: 57.50, low: 55.95, open: 57.35, previousClose: 57.35 },
  { symbol: "SKBNK", name: "Sekerbank T.A.S.", price: 22.20, change: -0.46, changePercent: -2.03, volume: 8900000, high: 22.74, low: 22.10, open: 22.66, previousClose: 22.66 },
  { symbol: "SMRVA", name: "Sumer Varlik Yonetim A.S.", price: 58.8, change: 0, changePercent: 0, volume: 1000000, high: 59.68, low: 57.92, open: 58.8, previousClose: 58.8 },
  { symbol: "SNKRN", name: "Sanko Enerji Sanayi ve Ticaret A.S.", price: 68.40, change: -1.40, changePercent: -2.01, volume: 720000, high: 70.00, low: 68.10, open: 69.80, previousClose: 69.80 },
  { symbol: "SOKM", name: "Sok Marketler Ticaret A.S.", price: 62.50, change: -1.28, changePercent: -2.01, volume: 11000000, high: 63.96, low: 62.22, open: 63.78, previousClose: 63.78 },
  { symbol: "SVGYO", name: "Sinpas Gayrimenkul Yatirim Ortakligi A.S.", price: 6.43, change: 0.58, changePercent: 9.91, volume: 42000000, high: 6.43, low: 5.82, open: 5.85, previousClose: 5.85 },
  { symbol: "TATGD", name: "Tat Gida Sanayi A.S.", price: 18.40, change: -0.38, changePercent: -2.02, volume: 5200000, high: 18.84, low: 18.30, open: 18.78, previousClose: 18.78 },
  { symbol: "TAVHL", name: "TAV Havalimanlari Holding A.S.", price: 205.00, change: -4.20, changePercent: -2.01, volume: 2800000, high: 209.60, low: 204.20, open: 209.20, previousClose: 209.20 },
  { symbol: "TBORG", name: "Turk Tuborg Bira ve Malt Sanayii A.S.", price: 286.00, change: -5.80, changePercent: -1.99, volume: 380000, high: 292.20, low: 284.60, open: 291.80, previousClose: 291.80 },
  { symbol: "TCELL", name: "Turkcell Iletisim Hizmetleri A.S.", price: 118.00, change: -2.40, changePercent: -1.99, volume: 22000000, high: 120.70, low: 117.50, open: 120.40, previousClose: 120.40 },
  { symbol: "THYAO", name: "Turk Hava Yollari A.O.", price: 291.97, change: -0.80, changePercent: -0.27, volume: 15300000, high: 294.40, low: 289.80, open: 292.77, previousClose: 292.77 },
  { symbol: "TKFEN", name: "Tekfen Holding A.S.", price: 136.80, change: -2.80, changePercent: -2.01, volume: 1800000, high: 139.90, low: 136.30, open: 139.60, previousClose: 139.60 },
  { symbol: "TKNSA", name: "Teknosa Ic ve Dis Ticaret A.S.", price: 38.20, change: -0.78, changePercent: -2.00, volume: 2100000, high: 39.10, low: 38.00, open: 38.98, previousClose: 38.98 },
  { symbol: "TLMAN", name: "Trabzon Liman Isletmeciligi A.S.", price: 88.85, change: 0, changePercent: 0, volume: 1000000, high: 90.18, low: 87.52, open: 88.85, previousClose: 88.85 },
  { symbol: "TOASO", name: "Tofas Turk Otomobil Fabrikasi A.S.", price: 462.00, change: -9.40, changePercent: -1.99, volume: 1500000, high: 472.40, low: 460.20, open: 471.40, previousClose: 471.40 },
  { symbol: "TRGYO", name: "Torunlar Gayrimenkul Yatirim Ortakligi A.S.", price: 48.60, change: -1.00, changePercent: -2.01, volume: 4600000, high: 49.70, low: 48.42, open: 49.60, previousClose: 49.60 },
  { symbol: "TRHOL", name: "Tera Finansal Yatirimlar Holding A.S.", price: 998, change: 0, changePercent: 0, volume: 1000000, high: 1012.97, low: 983.03, open: 998, previousClose: 998 },
  { symbol: "TRILC", name: "Trill Invest", price: 19.20, change: 0.35, changePercent: 1.86, volume: 2800000, high: 19.30, low: 18.78, open: 18.85, previousClose: 18.85 },
  { symbol: "TSKB", name: "Turkiye Sinai Kalkinma Bankasi A.S.", price: 18.86, change: -0.39, changePercent: -2.03, volume: 12000000, high: 19.32, low: 18.78, open: 19.25, previousClose: 19.25 },
  { symbol: "TTKOM", name: "Turk Telekomunikasyon A.S.", price: 38.24, change: -0.78, changePercent: -2.00, volume: 15000000, high: 39.12, low: 38.10, open: 39.02, previousClose: 39.02 },
  { symbol: "TTRAK", name: "Turk Traktor ve Ziraat Makineleri A.S.", price: 4960.00, change: -100.00, changePercent: -1.98, volume: 280000, high: 5068.00, low: 4938.00, open: 5060.00, previousClose: 5060.00 },
  { symbol: "TUKAS", name: "Trakya Cam Sanayii A.S.", price: 26.80, change: -0.54, changePercent: -1.98, volume: 8200000, high: 27.42, low: 26.68, open: 27.34, previousClose: 27.34 },
  { symbol: "TUPRS", name: "Tupras-Turkiye Petrol Rafinerileri A.S.", price: 562.00, change: -11.40, changePercent: -1.99, volume: 2200000, high: 574.60, low: 559.60, open: 573.40, previousClose: 573.40 },
  { symbol: "TURGG", name: "Turker Proje Gayrimenkul ve Yatirim Gelistirme A.S.", price: 29.12, change: 0, changePercent: 0, volume: 1000000, high: 29.56, low: 28.68, open: 29.12, previousClose: 29.12 },
  { symbol: "TURSG", name: "Turk Sigorta A.S.", price: 42.80, change: 0.76, changePercent: 1.81, volume: 3200000, high: 43.00, low: 41.88, open: 42.04, previousClose: 42.04 },
  { symbol: "ULAS", name: "Ulaslar Turizm Yatirimlari ve Dayanikli Tuketim Mallari Ticaret Pazarlama A.S.", price: 48.20, change: -0.98, changePercent: -1.99, volume: 580000, high: 49.32, low: 48.02, open: 49.18, previousClose: 49.18 },
  { symbol: "ULUUN", name: "Ulker Biskuvi Sanayi A.S.", price: 98.20, change: -2.00, changePercent: -1.99, volume: 2400000, high: 100.50, low: 97.80, open: 100.20, previousClose: 100.20 },
  { symbol: "ULKER", name: "Ulker Biskuvi Sanayi A.S.", price: 98.50, change: -2.00, changePercent: -1.99, volume: 2400000, high: 100.80, low: 98.10, open: 100.50, previousClose: 100.50 },
  { symbol: "VAKBN", name: "Turkiye Vakiflar Bankasi T.A.O.", price: 30.34, change: -0.62, changePercent: -2.00, volume: 58000000, high: 31.04, low: 30.22, open: 30.96, previousClose: 30.96 },
  { symbol: "VESBE", name: "Vestel Beyaz Esya Sanayi ve Ticaret A.S.", price: 32.50, change: -0.66, changePercent: -1.99, volume: 5800000, high: 33.26, low: 32.38, open: 33.16, previousClose: 33.16 },
  { symbol: "VESTL", name: "Vestel Elektronik Sanayi ve Ticaret A.S.", price: 26.40, change: -0.54, changePercent: -2.00, volume: 14000000, high: 27.00, low: 26.28, open: 26.94, previousClose: 26.94 },
  { symbol: "VKGYO", name: "Vakif Gayrimenkul Yatirim Ortakligi A.S.", price: 15.36, change: -0.32, changePercent: -2.04, volume: 9800000, high: 15.72, low: 15.30, open: 15.68, previousClose: 15.68 },
  { symbol: "VSNMD", name: "Visne Madencilik Sanayi ve Ticaret A.S.", price: 76.9, change: 0, changePercent: 0, volume: 1000000, high: 78.05, low: 75.75, open: 76.9, previousClose: 76.9 },
  { symbol: "YBTAS", name: "Yibitas Yozgat Isci Birligi Insaat ve Ticaret A.S.", price: 20.74, change: -2.28, changePercent: -9.90, volume: 229000, high: 22.94, low: 20.70, open: 23.02, previousClose: 23.02 },
  { symbol: "YESIL", name: "Yesil Yapi Endustri ve Ticaret A.S.", price: 18.60, change: 0.34, changePercent: 1.86, volume: 3800000, high: 18.70, low: 18.20, open: 18.26, previousClose: 18.26 },
  { symbol: "YGYO", name: "Yeni Gimat Gayrimenkul Yatirim Ortakligi A.S.", price: 4.96, change: -0.10, changePercent: -1.98, volume: 18000000, high: 5.08, low: 4.94, open: 5.06, previousClose: 5.06 },
  { symbol: "YKBNK", name: "Yapi ve Kredi Bankasi A.S.", price: 34.18, change: 0, changePercent: 0, volume: 1000000, high: 34.69, low: 33.67, open: 34.18, previousClose: 34.18 },
  { symbol: "YYLGD", name: "Yayla Agro Gida Sanayi ve Ticaret A.S.", price: 46.60, change: -0.96, changePercent: -2.01, volume: 1400000, high: 47.66, low: 46.44, open: 47.56, previousClose: 47.56 },
  { symbol: "ZOREN", name: "Zorlu Enerji Elektrik Uretim A.S.", price: 4.24, change: -0.087, changePercent: -2.01, volume: 38000000, high: 4.34, low: 4.22, open: 4.327, previousClose: 4.327 },
  { symbol: "ZRGYO", name: "Zerdem Gayrimenkul Yatirim Ortakligi A.S.", price: 18.40, change: 0.33, changePercent: 1.83, volume: 2400000, high: 18.50, low: 18.00, open: 18.07, previousClose: 18.07 },
  // ── Ek BIST hisseleri (650+ tam kapsam) ─────────────────────────────────
  // Blue chips & well-known – missing from above
  { symbol: "SAHOL",  name: "Haci Omer Sabanci Holding A.S.",             price: 62.00, change: -0.90, changePercent: -1.43, volume: 28000000, high: 63.20, low: 61.60, open: 62.90, previousClose: 62.90 },
  { symbol: "TOFAS",  name: "Tofas Turk Otomobil Fabrikasi A.S.",         price: 218.00,change: -3.20, changePercent: -1.45, volume: 3800000,  high: 222.00,low: 216.00,open: 221.00,previousClose: 221.00 },
  { symbol: "TRKCM",  name: "Trakya Cam Sanayii A.S.",                    price: 32.50, change: -0.50, changePercent: -1.52, volume: 14000000, high: 33.20, low: 32.30, open: 33.00, previousClose: 33.00 },
  { symbol: "CIMSA",  name: "Cimsa Cimento Sanayi ve Ticaret A.S.",       price: 128.00,change: -2.00, changePercent: -1.54, volume: 3500000,  high: 130.50,low: 127.00,open: 130.00,previousClose: 130.00 },
  { symbol: "CLEBI",  name: "Celebi Hava Servisi A.S.",                   price: 1450.00,change:-22.00,changePercent:-1.49, volume: 185000,   high: 1475.00,low:1440.00,open:1472.00,previousClose:1472.00 },
  { symbol: "NUHCM",  name: "Nuh Cimento Sanayi A.S.",                    price: 48.00, change: -0.80, changePercent: -1.64, volume: 4500000,  high: 49.00, low: 47.50, open: 48.80, previousClose: 48.80 },
  { symbol: "GSRAY",  name: "Galatasaray Sportif A.S.",                    price: 88.00, change: 1.50, changePercent: 1.73, volume: 20000000,  high: 89.00, low: 86.00, open: 86.50, previousClose: 86.50 },
  { symbol: "ECZYT",  name: "Eczacibasi Yatirim Holding A.S.",             price: 36.50, change: -0.60, changePercent: -1.62, volume: 5200000, high: 37.20, low: 36.30, open: 37.10, previousClose: 37.10 },
  { symbol: "CRFSA",  name: "CarrefourSA Karf Gida Sanayi ve Ticaret A.S.",price:15.50, change: -0.30, changePercent: -1.90, volume: 6800000, high: 15.90, low: 15.40, open: 15.80, previousClose: 15.80 },
  { symbol: "CONSE",  name: "Consus Enerji Isletmeciligi ve Hizmetleri A.S.", price: 3.47, change: 0.00, changePercent: 0.00, volume: 0, high: 3.47, low: 3.47, open: 3.47, previousClose: 3.47 },
  { symbol: "MGROS",  name: "Migros Ticaret A.S.",                         price: 585.00,change:-9.50, changePercent: -1.60, volume: 1100000, high: 596.00,low: 581.00,open: 594.50,previousClose: 594.50 },
  { symbol: "INDES",  name: "Indeks Bilgisayar Sistemleri A.S.",           price: 76.00, change: -1.20, changePercent: -1.55, volume: 2300000, high: 77.50, low: 75.50, open: 77.20, previousClose: 77.20 },
  { symbol: "KAREL",  name: "Karel Elektronik Sanayi ve Ticaret A.S.",     price: 127.50,change: -2.20, changePercent: -1.70, volume: 960000,  high: 130.00,low: 127.00,open: 129.70,previousClose: 129.70 },
  { symbol: "JANTS",  name: "Jantsa Jant Sanayi ve Ticaret A.S.",         price: 56.00, change: -1.00, changePercent: -1.75, volume: 1800000, high: 57.20, low: 55.80, open: 57.00, previousClose: 57.00 },
  { symbol: "MARTI",  name: "Marti Otel Isletmeleri A.S.",                 price: 14.80, change: 0.20, changePercent: 1.37, volume: 8500000,  high: 14.90, low: 14.50, open: 14.60, previousClose: 14.60 },
  { symbol: "HATEK",  name: "Hateks Hatay Tekstil Isletmeleri A.S.",       price: 22.00, change: -0.40, changePercent: -1.79, volume: 2600000, high: 22.50, low: 21.80, open: 22.40, previousClose: 22.40 },
  { symbol: "SANKO",  name: "Sanko Pazarlama Ithalat Ihracat A.S.",        price: 96.00, change: -1.60, changePercent: -1.64, volume: 1300000, high: 98.00, low: 95.50, open: 97.60, previousClose: 97.60 },
  { symbol: "TGBL",   name: "TGB Lojistik A.S.",                           price: 24.50, change: 0.40, changePercent: 1.66, volume: 3800000,  high: 24.70, low: 24.10, open: 24.10, previousClose: 24.10 },
  { symbol: "MEKSA",  name: "Meksa Yatirim Menkul Degerler A.S.",          price: 18.40, change: -0.30, changePercent: -1.60, volume: 4200000, high: 18.80, low: 18.30, open: 18.70, previousClose: 18.70 },
  // Cement & construction
  { symbol: "ADANA",  name: "Adana Cimento Sanayi T.A.S.",                 price: 62.00, change: -1.00, changePercent: -1.59, volume: 1200000, high: 63.20, low: 61.50, open: 63.00, previousClose: 63.00 },
  { symbol: "ADNAC",  name: "Adana Cimento Sanayi T.A.S. (C)",             price: 8.50,  change: -0.15, changePercent: -1.74, volume: 2800000, high: 8.70,  low: 8.40,  open: 8.65,  previousClose: 8.65  },
  { symbol: "BUCIM",  name: "Bursa Cimento Fabrikasi A.S.",                price: 210.00,change: -3.40, changePercent: -1.59, volume: 680000,  high: 214.00,low: 209.00,open: 213.40,previousClose: 213.40},
  { symbol: "KAYSE",  name: "Kayseri Seker Fabrikasi A.S.",                price: 82.00, change: -1.40, changePercent: -1.68, volume: 1600000, high: 83.60, low: 81.60, open: 83.40, previousClose: 83.40 },
  // Energy
  { symbol: "EUPWR",  name: "Europower Enerji A.S.",                       price: 28.00, change: 0.50, changePercent: 1.82, volume: 6200000,  high: 28.20, low: 27.40, open: 27.50, previousClose: 27.50 },
  { symbol: "KONTR",  name: "Kontrolmatik Teknoloji Enerji ve Muhendislik A.S.", price: 64.00, change: 1.20, changePercent: 1.91, volume: 8800000, high: 64.50, low: 62.80, open: 62.80, previousClose: 62.80 },
  { symbol: "ONRYT",  name: "Onur GYO A.S.",                               price: 18.40, change: 0.30, changePercent: 1.66, volume: 4100000,  high: 18.60, low: 18.00, open: 18.10, previousClose: 18.10 },
  { symbol: "SURGY",  name: "Sur Yapi Sanayi ve Ticaret A.S.",             price: 12.50, change: -0.20, changePercent: -1.57, volume: 5900000, high: 12.80, low: 12.40, open: 12.70, previousClose: 12.70 },
  { symbol: "IPEKE",  name: "Ipek Dogal Enerji Kaynaklar Arastirma A.S.", price: 38.50, change: 0.60, changePercent: 1.58, volume: 3300000,  high: 38.80, low: 37.70, open: 37.90, previousClose: 37.90 },
  { symbol: "NATEN",  name: "Na Yapim Enerji A.S.",                        price: 22.00, change: 0.35, changePercent: 1.62, volume: 3500000,  high: 22.20, low: 21.60, open: 21.65, previousClose: 21.65 },
  // Real estate (GYO) – missing
  { symbol: "MRGYO",  name: "Mar Yatirim Gayrimenkul A.S.",                price: 6.80,  change: -0.12, changePercent: -1.73, volume: 12000000, high: 6.96, low: 6.76, open: 6.92, previousClose: 6.92 },
  { symbol: "MSGYO",  name: "Mega Gayrimenkul Yatirim Ortakligi A.S.",     price: 4.50,  change: -0.08, changePercent: -1.75, volume: 16000000, high: 4.60, low: 4.48, open: 4.58, previousClose: 4.58 },
  { symbol: "NUGYO",  name: "Nurol Gayrimenkul Yatirim Ortakligi A.S.",    price: 28.00, change: -0.50, changePercent: -1.75, volume: 3600000, high: 28.60, low: 27.80, open: 28.50, previousClose: 28.50 },
  { symbol: "OYAYO",  name: "Oya Gayrimenkul Yatirim Ortakligi A.S.",      price: 9.80,  change: 0.16, changePercent: 1.66, volume: 7200000,  high: 9.88,  low: 9.62,  open: 9.64,  previousClose: 9.64  },
  { symbol: "SRVGY",  name: "Servet Gayrimenkul Yatirim Ortakligi A.S.",   price: 16.60, change: -0.30, changePercent: -1.78, volume: 4800000, high: 17.00, low: 16.50, open: 16.90, previousClose: 16.90 },
  { symbol: "VRGYO",  name: "Varlik Gayrimenkul Yatirim Ortakligi A.S.",   price: 14.20, change: -0.24, changePercent: -1.66, volume: 5500000, high: 14.50, low: 14.10, open: 14.44, previousClose: 14.44 },
  { symbol: "RYSGYO", name: "Rüya Gayrimenkul Yatirim Ortakligi A.S.",     price: 5.60,  change: 0.09, changePercent: 1.63, volume: 9800000,  high: 5.65,  low: 5.49,  open: 5.51,  previousClose: 5.51  },
  { symbol: "KGYO",   name: "Krea Gayrimenkul Yatirim Ortakligi A.S.",     price: 12.40, change: -0.22, changePercent: -1.74, volume: 6200000, high: 12.70, low: 12.30, open: 12.62, previousClose: 12.62 },
  { symbol: "KONKA",  name: "Konka Gayrimenkul Yatirim Ortakligi A.S.",    price: 7.90,  change: 0.13, changePercent: 1.67, volume: 7600000,  high: 7.96,  low: 7.74,  open: 7.77,  previousClose: 7.77  },
  { symbol: "KRGYO",  name: "Kiler Gayrimenkul Yatirim Ortakligi A.S.",    price: 18.50, change: -0.32, changePercent: -1.70, volume: 3900000, high: 18.90, low: 18.40, open: 18.82, previousClose: 18.82 },
  { symbol: "AGSTS",  name: "AG Anadolu Grubu Tekstil ve Sanayi A.S.",     price: 32.00, change: 0.52, changePercent: 1.65, volume: 2400000,  high: 32.20, low: 31.40, open: 31.48, previousClose: 31.48 },
  // Industrials – missing
  { symbol: "ERBOS",  name: "Erbosan Erciyas Boru Sanayii ve Ticaret A.S.",price: 82.00, change: -1.40, changePercent: -1.68, volume: 1800000, high: 83.60, low: 81.60, open: 83.40, previousClose: 83.40 },
  { symbol: "IZMDC",  name: "Izmir Demir Celik Sanayi A.S.",               price: 26.80, change: -0.46, changePercent: -1.69, volume: 8400000, high: 27.40, low: 26.60, open: 27.26, previousClose: 27.26 },
  { symbol: "ERCB",   name: "Erce Boru Profil Sanayi ve Ticaret A.S.",     price: 18.20, change: 0.30, changePercent: 1.68, volume: 3200000,  high: 18.40, low: 17.80, open: 17.90, previousClose: 17.90 },
  { symbol: "KBORU",  name: "Kaya Boru Uretim A.S.",                       price: 14.60, change: -0.25, changePercent: -1.68, volume: 4600000, high: 14.95, low: 14.50, open: 14.85, previousClose: 14.85 },
  { symbol: "IZOCM",  name: "Izocam Ticaret ve Sanayi A.S.",               price: 260.00,change: -4.20, changePercent: -1.59, volume: 420000,  high: 265.00,low: 258.00,open: 264.20,previousClose: 264.20},
  { symbol: "POLTK",  name: "Politika Sanayi ve Ticaret A.S.",             price: 12.80, change: -0.22, changePercent: -1.69, volume: 5800000, high: 13.10, low: 12.70, open: 13.02, previousClose: 13.02 },
  { symbol: "SKTAS",  name: "Soktas Pamuklu Sanayii A.S.",                 price: 28.50, change: -0.50, changePercent: -1.72, volume: 2800000, high: 29.10, low: 28.30, open: 29.00, previousClose: 29.00 },
  { symbol: "ESAS",   name: "ESAS Holding A.S.",                           price: 42.00, change: -0.70, changePercent: -1.64, volume: 3100000, high: 42.90, low: 41.80, open: 42.70, previousClose: 42.70 },
  { symbol: "KUYAS",  name: "Kuyas Orman Urunleri Sanayi ve Ticaret A.S.", price: 26.00, change: 0.42, changePercent: 1.64, volume: 3600000,  high: 26.20, low: 25.50, open: 25.58, previousClose: 25.58 },
  { symbol: "KAPLM",  name: "Kaplamin Ambalaj Sanayi ve Ticaret A.S.",     price: 18.00, change: -0.30, changePercent: -1.64, volume: 4800000, high: 18.40, low: 17.90, open: 18.30, previousClose: 18.30 },
  { symbol: "PARSN",  name: "Parsan Makine Parcalari Sanayi A.S.",         price: 64.00, change: -1.10, changePercent: -1.69, volume: 1600000, high: 65.30, low: 63.60, open: 65.10, previousClose: 65.10 },
  { symbol: "EPLAS",  name: "Egeplast Ege Plastik Ticaret ve Sanayi A.S.", price: 34.50, change: -0.60, changePercent: -1.71, volume: 2400000, high: 35.20, low: 34.30, open: 35.10, previousClose: 35.10 },
  { symbol: "DYOBY",  name: "DYO Boya Fabrikalari Sanayi ve Ticaret A.S.", price: 42.00, change: -0.70, changePercent: -1.64, volume: 3000000, high: 42.90, low: 41.80, open: 42.70, previousClose: 42.70 },
  { symbol: "CNKR",   name: "Canakkale Seramik Fabrikalari A.S.",          price: 38.50, change: 0.62, changePercent: 1.64, volume: 2600000,  high: 38.80, low: 37.70, open: 37.88, previousClose: 37.88 },
  { symbol: "ERDMR",  name: "Erdemir - Eregli Demir ve Celik Fab.",        price: 44.00, change: -0.74, changePercent: -1.65, volume: 4200000, high: 44.90, low: 43.80, open: 44.74, previousClose: 44.74 },
  { symbol: "ASTOR",  name: "Astor Enerji A.S.",                           price: 98.00, change: 1.60, changePercent: 1.66, volume: 12000000, high: 98.80, low: 96.00, open: 96.40, previousClose: 96.40 },
  { symbol: "KOSMO",  name: "Kosmo Tarim A.S.",                            price: 8.50,  change: 0.14, changePercent: 1.67, volume: 7200000,  high: 8.58,  low: 8.34,  open: 8.36,  previousClose: 8.36  },
  { symbol: "MANAS",  name: "Manas Enerji Yonetim Hizmetleri A.S.",        price: 22.50, change: 0.36, changePercent: 1.63, volume: 3800000,  high: 22.70, low: 22.05, open: 22.14, previousClose: 22.14 },
  { symbol: "MEGAP",  name: "Mega Polietilen Boru ve Ek Parcalari A.S.",   price: 18.20, change: -0.32, changePercent: -1.73, volume: 4200000, high: 18.60, low: 18.10, open: 18.52, previousClose: 18.52 },
  // Food & beverage
  { symbol: "COSMO",  name: "Cosmo Tarim A.S.",                            price: 12.00, change: 0.20, changePercent: 1.69, volume: 5600000,  high: 12.10, low: 11.76, open: 11.80, previousClose: 11.80 },
  { symbol: "KENT",   name: "Kent Gida Maddeleri Sanayi ve Ticaret A.S.",  price: 420.00,change: -6.80, changePercent: -1.59, volume: 280000,  high: 428.00,low: 418.00,open: 426.80,previousClose: 426.80},
  { symbol: "KNFRT",  name: "Konfrut Gida Sanayi ve Ticaret A.S.",         price: 16.20, change: -0.28, changePercent: -1.70, volume: 5200000, high: 16.58, low: 16.10, open: 16.48, previousClose: 16.48 },
  { symbol: "MAALT",  name: "Maaltesi Unlu Mamuller Sanayi ve Ticaret A.S.",price: 8.80, change: 0.14, changePercent: 1.62, volume: 6800000, high: 8.88, low: 8.64, open: 8.66, previousClose: 8.66 },
  { symbol: "UYUM",   name: "Uyum Gida ve Ihtiyac Maddeleri A.S.",         price: 38.00, change: -0.64, changePercent: -1.66, volume: 3600000, high: 38.80, low: 37.80, open: 38.64, previousClose: 38.64 },
  { symbol: "SAMAT",  name: "Samatyali Saglik Hizmetleri A.S.",            price: 6.20,  change: 0.10, changePercent: 1.64, volume: 9600000,  high: 6.24,  low: 6.08,  open: 6.10,  previousClose: 6.10  },
  { symbol: "SUWEN",  name: "Suwen Medikal Saglk A.S.",                    price: 14.50, change: 0.24, changePercent: 1.68, volume: 5400000,  high: 14.60, low: 14.20, open: 14.26, previousClose: 14.26 },
  // Finance & banks
  { symbol: "FINBN",  name: "Finansbank A.S.",                             price: 28.50, change: -0.50, changePercent: -1.72, volume: 8500000, high: 29.10, low: 28.30, open: 29.00, previousClose: 29.00 },
  { symbol: "LIDER",  name: "Lider Faktoring A.S.",                        price: 18.40, change: -0.32, changePercent: -1.71, volume: 4200000, high: 18.80, low: 18.30, open: 18.72, previousClose: 18.72 },
  { symbol: "LIDFA",  name: "Lider Filo Arac Kiralama ve Ticaret A.S.",    price: 14.60, change: -0.25, changePercent: -1.68, volume: 5200000, high: 14.95, low: 14.50, open: 14.85, previousClose: 14.85 },
  { symbol: "OBASE",  name: "Obase Bilgisayar Sistemleri Sanayi ve Ticaret A.S.", price: 56.00, change: 0.92, changePercent: 1.67, volume: 2200000, high: 56.40, low: 54.80, open: 55.08, previousClose: 55.08 },
  { symbol: "RTALB",  name: "Ronesans Holding A.S.",                       price: 38.50, change: 0.62, changePercent: 1.64, volume: 3400000,  high: 38.80, low: 37.70, open: 37.88, previousClose: 37.88 },
  { symbol: "VAKFN",  name: "Vakif Finansal Kiralama A.S.",                price: 12.80, change: -0.22, changePercent: -1.69, volume: 5800000, high: 13.10, low: 12.70, open: 13.02, previousClose: 13.02 },
  { symbol: "VBTS",   name: "VBT Yazilim A.S.",                            price: 86.00, change: 1.40, changePercent: 1.65, volume: 1600000,  high: 86.80, low: 84.20, open: 84.60, previousClose: 84.60 },
  { symbol: "MEKAG",  name: "Mekase Gayrimenkul Gelistirme A.S.",          price: 9.60,  change: 0.16, changePercent: 1.69, volume: 7200000,  high: 9.68,  low: 9.42,  open: 9.44,  previousClose: 9.44  },
  { symbol: "SDTTR",  name: "SDT Uzay ve Savunma Teknolojileri A.S.",      price: 246.00,change: 4.00, changePercent: 1.66, volume: 620000,   high: 248.00,low: 241.00,open: 242.00,previousClose: 242.00},
  { symbol: "INTEM",  name: "Intem Bilgisayar Sistemleri Sanayi A.S.",     price: 32.00, change: 0.52, changePercent: 1.65, volume: 3200000,  high: 32.20, low: 31.40, open: 31.48, previousClose: 31.48 },
  { symbol: "INVEO",  name: "Inveo Varlik Yonetimi A.S.",                  price: 28.00, change: -0.48, changePercent: -1.68, volume: 4100000, high: 28.60, low: 27.80, open: 28.48, previousClose: 28.48 },
  { symbol: "SMART",  name: "Smart Gunes Enerjisi Teknolojileri A.S.",     price: 42.00, change: 0.68, changePercent: 1.65, volume: 2800000,  high: 42.40, low: 41.16, open: 41.32, previousClose: 41.32 },
  { symbol: "SMRTG",  name: "Smartiks Yazilim A.S.",                       price: 14.20, change: 0.23, changePercent: 1.65, volume: 5800000,  high: 14.30, low: 13.92, open: 13.97, previousClose: 13.97 },
  { symbol: "GARFA",  name: "Garanti BBVA Faktoring A.S.",                 price: 22.50, change: -0.38, changePercent: -1.66, volume: 5600000, high: 23.00, low: 22.40, open: 22.88, previousClose: 22.88 },
  // Textile
  { symbol: "DAGI",   name: "Dagi Giyim Sanayi ve Ticaret A.S.",          price: 18.60, change: -0.32, changePercent: -1.69, volume: 4800000, high: 19.00, low: 18.50, open: 18.92, previousClose: 18.92 },
  { symbol: "SANFM",  name: "Sanfm Tekstil Sanayi ve Ticaret A.S.",        price: 12.80, change: -0.22, changePercent: -1.69, volume: 5400000, high: 13.10, low: 12.70, open: 13.02, previousClose: 13.02 },
  { symbol: "SAMTS",  name: "Samteks Dokuma Sanayi ve Ticaret A.S.",       price: 8.20,  change: 0.13, changePercent: 1.61, volume: 7600000,  high: 8.28,  low: 8.05,  open: 8.07,  previousClose: 8.07  },
  { symbol: "YUNSA",  name: "Yunsa Yunlu Sanayi ve Ticaret A.S.",          price: 98.00, change: -1.60, changePercent: -1.61, volume: 980000,  high: 100.00,low: 97.50, open: 99.60, previousClose: 99.60 },
  { symbol: "YATAS",  name: "Yatas Yatak ve Yorgan Sanayi Ticaret A.S.",   price: 62.00, change: -1.04, changePercent: -1.65, volume: 1600000, high: 63.30, low: 61.60, open: 63.04, previousClose: 63.04 },
  { symbol: "YAPRK",  name: "Yaprak Sut ve Besi Cerceveleme A.S.",         price: 16.80, change: 0.28, changePercent: 1.69, volume: 4600000,  high: 16.90, low: 16.46, open: 16.52, previousClose: 16.52 },
  // Retail & other
  { symbol: "VAKKO",  name: "Vakko Tekstil ve Hazir Giyim Sanayi A.S.",    price: 980.00,change:-16.00, changePercent: -1.61, volume: 120000,  high: 998.00,low: 974.00,open: 996.00,previousClose: 996.00},
  { symbol: "UNLU",   name: "Unlu Tekstil Sanayi ve Ticaret A.S.",         price: 48.50, change: -0.82, changePercent: -1.66, volume: 2400000, high: 49.50, low: 48.20, open: 49.32, previousClose: 49.32 },
  { symbol: "UMPAS",  name: "Umpas Holding A.S.",                          price: 24.00, change: 0.40, changePercent: 1.69, volume: 4200000,  high: 24.20, low: 23.52, open: 23.60, previousClose: 23.60 },
  { symbol: "PEHOL",  name: "Peker Holding A.S.",                          price: 16.20, change: -0.28, changePercent: -1.70, volume: 5200000, high: 16.58, low: 16.10, open: 16.48, previousClose: 16.48 },
  { symbol: "ORTEN",  name: "Orten Gayrimenkul A.S.",                      price: 8.40,  change: 0.14, changePercent: 1.69, volume: 7200000,  high: 8.48,  low: 8.23,  open: 8.26,  previousClose: 8.26  },
  { symbol: "PAMEL",  name: "Pamelco Gida Sanayi ve Ticaret A.S.",         price: 12.80, change: 0.21, changePercent: 1.67, volume: 5800000,  high: 12.90, low: 12.54, open: 12.59, previousClose: 12.59 },
  { symbol: "PAPIL",  name: "Papilion Tekstil A.S.",                       price: 6.60,  change: -0.11, changePercent: -1.64, volume: 9200000, high: 6.74, low: 6.56, open: 6.71, previousClose: 6.71 },
  { symbol: "RALYH",  name: "Ralyho Holding A.S.",                         price: 18.40, change: 0.30, changePercent: 1.66, volume: 4200000,  high: 18.60, low: 18.02, open: 18.10, previousClose: 18.10 },
  { symbol: "RHEAG",  name: "Rhea Girisim Sermayesi Yatirim Ortakligi A.S.",price: 28.50,change: 0.46, changePercent: 1.64, volume: 3200000,  high: 28.80, low: 27.94, open: 28.04, previousClose: 28.04 },
  { symbol: "PRZMA",  name: "Perizma Gayrimenkul Gelistirme A.S.",         price: 9.20,  change: 0.15, changePercent: 1.66, volume: 7200000,  high: 9.28,  low: 9.02,  open: 9.05,  previousClose: 9.05  },
  { symbol: "PINSU",  name: "Pinar Su Sanayi ve Ticaret A.S.",             price: 82.00, change: -1.36, changePercent: -1.63, volume: 980000,  high: 83.70, low: 81.60, open: 83.36, previousClose: 83.36 },
  { symbol: "PKART",  name: "Plastikkart Akilli Kart Iletisim A.S.",       price: 18.60, change: 0.30, changePercent: 1.64, volume: 4200000,  high: 18.80, low: 18.22, open: 18.30, previousClose: 18.30 },
  { symbol: "PNLSN",  name: "Panelsan A.S.",                               price: 12.40, change: -0.21, changePercent: -1.66, volume: 5600000, high: 12.70, low: 12.30, open: 12.61, previousClose: 12.61 },
  // Media & holding companies
  { symbol: "IHLAS",  name: "Ihlas Holding A.S.",                          price: 4.80,  change: -0.08, changePercent: -1.64, volume: 28000000,high: 4.92, low: 4.78, open: 4.88, previousClose: 4.88 },
  { symbol: "IHLGM",  name: "Ihlas Gazetecilik A.S.",                      price: 3.20,  change: -0.05, changePercent: -1.54, volume: 14000000,high: 3.28, low: 3.18, open: 3.25, previousClose: 3.25 },
  { symbol: "IHSAG",  name: "Ihlas Saglik Yatirimlari A.S.",               price: 8.60,  change: 0.14, changePercent: 1.65, volume: 8200000,  high: 8.68, low: 8.43, open: 8.46, previousClose: 8.46  },
  { symbol: "IHEVA",  name: "Iheva Anadolu A.S.",                          price: 6.40,  change: 0.10, changePercent: 1.59, volume: 9600000,  high: 6.46, low: 6.27, open: 6.30, previousClose: 6.30  },
  { symbol: "IHGZT",  name: "Ihlas Ev Aletleri A.S.",                      price: 14.20, change: -0.24, changePercent: -1.67, volume: 5200000, high: 14.54, low: 14.10, open: 14.44, previousClose: 14.44 },
  { symbol: "EYHOL",  name: "Eyüp Sultan Holding A.S.",                    price: 36.00, change: -0.60, changePercent: -1.64, volume: 3400000, high: 36.80, low: 35.80, open: 36.60, previousClose: 36.60 },
  { symbol: "ATSYH",  name: "Atis Yapi Holding A.S.",                      price: 8.40,  change: -0.14, changePercent: -1.64, volume: 7600000, high: 8.60, low: 8.36, open: 8.54, previousClose: 8.54  },
  { symbol: "ATAKP",  name: "Atakule GYO A.S.",                            price: 6.80,  change: 0.11, changePercent: 1.64, volume: 9200000,  high: 6.86, low: 6.67, open: 6.69, previousClose: 6.69  },
  { symbol: "ATAGY",  name: "Ata Gayrimenkul Yatirim Ortakligi A.S.",      price: 9.20,  change: -0.16, changePercent: -1.71, volume: 7200000, high: 9.40, low: 9.14, open: 9.36, previousClose: 9.36  },
  { symbol: "EFORC",  name: "Efor Celik A.S.",                             price: 18.40, change: -0.32, changePercent: -1.71, volume: 4400000, high: 18.80, low: 18.30, open: 18.72, previousClose: 18.72 },
  { symbol: "ENSRI",  name: "Ensar Yatirim Holding A.S.",                  price: 24.00, change: 0.40, changePercent: 1.69, volume: 3800000,  high: 24.20, low: 23.52, open: 23.60, previousClose: 23.60 },
  { symbol: "FADE",   name: "Fade Gida Yatirim A.S.",                      price: 8.80,  change: -0.15, changePercent: -1.68, volume: 7600000, high: 9.00, low: 8.76, open: 8.95, previousClose: 8.95  },
  { symbol: "DAGHL",  name: "Daglar Holding A.S.",                         price: 14.40, change: -0.25, changePercent: -1.71, volume: 5800000, high: 14.75, low: 14.30, open: 14.65, previousClose: 14.65 },
  { symbol: "DATA",   name: "Data Bilgi Sistemleri Sanayi ve Ticaret A.S.",price: 26.00, change: 0.43, changePercent: 1.68, volume: 3400000,  high: 26.20, low: 25.48, open: 25.57, previousClose: 25.57 },
  { symbol: "DENGE",  name: "Denge Yatirim Holding A.S.",                  price: 32.50, change: -0.56, changePercent: -1.69, volume: 2800000, high: 33.20, low: 32.30, open: 33.06, previousClose: 33.06 },
  { symbol: "DERHL",  name: "Derman Holding A.S.",                         price: 9.60,  change: 0.16, changePercent: 1.69, volume: 7000000,  high: 9.68, low: 9.41, open: 9.44, previousClose: 9.44  },
  { symbol: "DITAS",  name: "Ditas Dogan Yedek Parca A.S.",                price: 224.00,change: -3.68, changePercent: -1.62, volume: 480000,  high: 228.00,low: 222.00,open: 227.68,previousClose: 227.68},
  { symbol: "DMRGD",  name: "Demirag Dokum ve Metal Sanayi A.S.",          price: 18.00, change: 0.30, changePercent: 1.69, volume: 4600000,  high: 18.20, low: 17.64, open: 17.70, previousClose: 17.70 },
  { symbol: "DURDO",  name: "Durdu Hekim Enguruhsar A.S.",                 price: 14.60, change: -0.25, changePercent: -1.68, volume: 5400000, high: 14.95, low: 14.50, open: 14.85, previousClose: 14.85 },
  { symbol: "ESCAR",  name: "Escar Finansal Kiralama A.S.",                price: 6.80,  change: 0.11, changePercent: 1.65, volume: 9400000,  high: 6.86, low: 6.67, open: 6.69, previousClose: 6.69  },
  { symbol: "ETILR",  name: "Etiline Plastik Sanayi A.S.",                 price: 9.20,  change: -0.16, changePercent: -1.71, volume: 7200000, high: 9.40, low: 9.14, open: 9.36, previousClose: 9.36  },
  { symbol: "ETYAT",  name: "Et Yatirim A.S.",                             price: 12.40, change: 0.20, changePercent: 1.64, volume: 6400000,  high: 12.50, low: 12.14, open: 12.20, previousClose: 12.20 },
  { symbol: "FRNSA",  name: "Fransa Kalkınma Bankası TR",                  price: 18.20, change: -0.32, changePercent: -1.73, volume: 4600000, high: 18.60, low: 18.10, open: 18.52, previousClose: 18.52 },
  { symbol: "GMSTR",  name: "Gümüşhane Madencilik Sanayi ve Ticaret A.S.",price: 22.00, change: 0.36, changePercent: 1.67, volume: 3800000,  high: 22.20, low: 21.56, open: 21.64, previousClose: 21.64 },
  { symbol: "GRSEL",  name: "Gur-Sel Turizm ve Nakliyat A.S.",            price: 28.00, change: -0.48, changePercent: -1.68, volume: 3200000, high: 28.60, low: 27.80, open: 28.48, previousClose: 28.48 },
  { symbol: "GSDDE",  name: "GSD Denizcilik Gayrimenkul A.S.",             price: 6.40,  change: -0.11, changePercent: -1.69, volume: 9800000, high: 6.54, low: 6.36, open: 6.51, previousClose: 6.51  },
  { symbol: "GSDHO",  name: "GSD Holding A.S.",                            price: 28.50, change: 0.46, changePercent: 1.64, volume: 3400000,  high: 28.80, low: 27.94, open: 28.04, previousClose: 28.04 },
  { symbol: "HDFGS",  name: "Hayat Holding Finansal Gucler A.S.",          price: 14.80, change: 0.24, changePercent: 1.65, volume: 5400000,  high: 14.90, low: 14.50, open: 14.56, previousClose: 14.56 },
  { symbol: "HILAL",  name: "Hilal Sut ve Mamulleri A.S.",                 price: 8.60,  change: -0.15, changePercent: -1.71, volume: 8600000, high: 8.80, low: 8.56, open: 8.75, previousClose: 8.75  },
  { symbol: "HUNER",  name: "Hüner Sanayi ve Ticaret A.S.",               price: 14.20, change: -0.24, changePercent: -1.67, volume: 5600000, high: 14.54, low: 14.10, open: 14.44, previousClose: 14.44 },
  { symbol: "IDAS",   name: "Idas Savunma Hava ve Uzay A.S.",              price: 98.00, change: 1.60, changePercent: 1.66, volume: 1400000,  high: 98.80, low: 96.00, open: 96.40, previousClose: 96.40 },
  { symbol: "KARFA",  name: "Karden Yatirim Holding A.S.",                 price: 6.20,  change: -0.11, changePercent: -1.74, volume: 10000000,high: 6.34, low: 6.16, open: 6.31, previousClose: 6.31  },
  { symbol: "KARTON", name: "Kartonsan Karton Sanayi ve Ticaret A.S.",     price: 2180.00,change:-36.00,changePercent:-1.62,  volume: 62000,   high:2220.00,low:2168.00,open:2216.00,previousClose:2216.00},
  { symbol: "KATMR",  name: "Katmerciler Arac Ustu Ekipman A.S.",          price: 164.00,change: -2.70, changePercent: -1.62, volume: 820000,  high: 167.00,low: 163.00,open: 166.70,previousClose: 166.70},
  { symbol: "KFEIN",  name: "KAF Finansal Yatirimlar A.S.",                price: 8.80,  change: 0.14, changePercent: 1.62, volume: 7600000,  high: 8.88, low: 8.63, open: 8.66, previousClose: 8.66  },
  { symbol: "KMPRO",  name: "Kompro Bilisim Sanayi A.S.",                  price: 22.00, change: 0.36, changePercent: 1.67, volume: 3800000,  high: 22.20, low: 21.56, open: 21.64, previousClose: 21.64 },
  { symbol: "KOPOL",  name: "Kopol Enerji A.S.",                           price: 12.00, change: -0.20, changePercent: -1.64, volume: 6600000, high: 12.26, low: 11.92, open: 12.20, previousClose: 12.20 },
  { symbol: "KRPLS",  name: "Karplas Depolama ve Nakliyat A.S.",           price: 8.00,  change: 0.13, changePercent: 1.65, volume: 8400000,  high: 8.08, low: 7.84, open: 7.87, previousClose: 7.87  },
  { symbol: "KTLEV",  name: "KT Katilim Emeklilik ve Hayat A.S.",          price: 18.60, change: 0.30, changePercent: 1.64, volume: 4400000,  high: 18.80, low: 18.22, open: 18.30, previousClose: 18.30 },
  { symbol: "LRSHO",  name: "Larissa Hotel A.S.",                          price: 6.40,  change: 0.10, changePercent: 1.59, volume: 9600000,  high: 6.46, low: 6.27, open: 6.30, previousClose: 6.30  },
  { symbol: "LUKSK",  name: "Lüks Kadife Ticaret ve Sanayi A.S.",         price: 88.00, change: -1.46, changePercent: -1.63, volume: 1400000, high: 89.80, low: 87.60, open: 89.46, previousClose: 89.46 },
  { symbol: "MACKO",  name: "Mackolik Spor Hizmetleri A.S.",               price: 22.50, change: 0.37, changePercent: 1.67, volume: 3600000,  high: 22.70, low: 22.04, open: 22.13, previousClose: 22.13 },
  { symbol: "MAGEN",  name: "Magen Enerji Uretim A.S.",                    price: 38.00, change: -0.64, changePercent: -1.66, volume: 3200000, high: 38.80, low: 37.80, open: 38.64, previousClose: 38.64 },
  { symbol: "MIPAZ",  name: "Mipaz Ambalaj ve Plastik A.S.",               price: 9.80,  change: 0.16, changePercent: 1.66, volume: 7000000,  high: 9.88, low: 9.61, open: 9.64, previousClose: 9.64  },
  { symbol: "MTRKS",  name: "Matriks Bilgi Dagitim Hizmetleri A.S.",       price: 48.00, change: 0.79, changePercent: 1.67, volume: 2400000,  high: 48.40, low: 47.02, open: 47.21, previousClose: 47.21 },
  { symbol: "MZHLD",  name: "MZ Holding A.S.",                             price: 14.60, change: -0.25, changePercent: -1.68, volume: 5600000, high: 14.95, low: 14.50, open: 14.85, previousClose: 14.85 },
  { symbol: "NCTS",   name: "NCMT Elektronik Sanayi ve Ticaret A.S.",      price: 26.00, change: 0.43, changePercent: 1.68, volume: 3800000,  high: 26.20, low: 25.48, open: 25.57, previousClose: 25.57 },
  { symbol: "NIBAS",  name: "Niğde Beton A.S.",                            price: 8.40,  change: -0.14, changePercent: -1.64, volume: 7600000, high: 8.60, low: 8.36, open: 8.54, previousClose: 8.54  },
  { symbol: "NURO",   name: "Nuro Finans A.S.",                            price: 9.60,  change: -0.16, changePercent: -1.64, volume: 7400000, high: 9.82, low: 9.54, open: 9.76, previousClose: 9.76  },
  { symbol: "ODINE",  name: "Odine Global A.S.",                           price: 8.20,  change: 0.13, changePercent: 1.61, volume: 7800000,  high: 8.28, low: 8.04, open: 8.07, previousClose: 8.07  },
  { symbol: "OLVIP",  name: "Olive Turkey A.S.",                           price: 18.40, change: -0.32, changePercent: -1.71, volume: 4600000, high: 18.80, low: 18.30, open: 18.72, previousClose: 18.72 },
  { symbol: "ORMA",   name: "Orma Orman Mahsülleri Ithalat Ihracat A.S.", price: 16.20, change: 0.27, changePercent: 1.69, volume: 5200000,  high: 16.34, low: 15.88, open: 15.93, previousClose: 15.93 },
  { symbol: "PASEU",  name: "Pasifik Elektronik A.S.",                     price: 6.40,  change: 0.10, changePercent: 1.59, volume: 9400000,  high: 6.46, low: 6.27, open: 6.30, previousClose: 6.30  },
  { symbol: "SAYAS",  name: "Sayan Elektronik Sanayi ve Ticaret A.S.",     price: 14.80, change: -0.25, changePercent: -1.66, volume: 5400000, high: 15.14, low: 14.70, open: 15.05, previousClose: 15.05 },
  { symbol: "SEYKM",  name: "Seyitler Kimya Sanayi A.S.",                  price: 18.00, change: 0.30, changePercent: 1.69, volume: 4600000,  high: 18.20, low: 17.64, open: 17.70, previousClose: 17.70 },
  { symbol: "SIGDE",  name: "Sigde Enerji A.S.",                           price: 6.20,  change: -0.11, changePercent: -1.74, volume: 10000000,high: 6.34, low: 6.16, open: 6.31, previousClose: 6.31  },
  { symbol: "SODSN",  name: "Soda Sanayii A.S.",                           price: 64.00, change: -1.08, changePercent: -1.66, volume: 2200000, high: 65.30, low: 63.60, open: 65.08, previousClose: 65.08 },
  { symbol: "SONME",  name: "Sönmez Pamuklu Sanayii A.S.",                 price: 48.00, change: 0.79, changePercent: 1.67, volume: 2400000,  high: 48.40, low: 47.02, open: 47.21, previousClose: 47.21 },
  { symbol: "TARKM",  name: "Tarkim Bitki Koruma A.S.",                    price: 62.00, change: -1.04, changePercent: -1.65, volume: 1600000, high: 63.30, low: 61.60, open: 63.04, previousClose: 63.04 },
  { symbol: "TEZOL",  name: "Tezol Egzoz Sistemleri Sanayi ve Ticaret A.S.",price:82.00,change: -1.38, changePercent: -1.65, volume: 1400000, high: 83.70, low: 81.60, open: 83.38, previousClose: 83.38 },
  { symbol: "TRCAS",  name: "Tüpraş-Türkiye Petrol Rafinerileri A.S.",    price: 280.00,change: -4.60, changePercent: -1.62, volume: 2200000, high: 285.60,low: 278.00,open: 284.60,previousClose: 284.60},
  { symbol: "UCAK",   name: "Ucak Servisi A.S.",                           price: 188.00,change: -3.12, changePercent: -1.63, volume: 620000,  high: 192.00,low: 186.00,open: 191.12,previousClose: 191.12},
  { symbol: "YKSLN",  name: "Yükselen Çelik A.S.",                        price: 14.20, change: -0.24, changePercent: -1.67, volume: 5600000, high: 14.54, low: 14.10, open: 14.44, previousClose: 14.44 },
  // ── Newer 2022-2026 IPOs ────────────────────────────────────────────────
  { symbol: "ULUFA",  name: "Ulufer Demir Celik Sanayi ve Ticaret A.S.",  price: 28.00, change: 0.46, changePercent: 1.67, volume: 4800000,  high: 28.20, low: 27.44, open: 27.54, previousClose: 27.54 },
  { symbol: "AMBR",   name: "Ambra Maden Sanayi ve Ticaret A.S.",          price: 18.60, change: 0.30, changePercent: 1.64, volume: 4200000,  high: 18.80, low: 18.22, open: 18.30, previousClose: 18.30 },
  { symbol: "AMNTA",  name: "Aminta Holding A.S.",                         price: 14.40, change: -0.25, changePercent: -1.71, volume: 5800000, high: 14.75, low: 14.30, open: 14.65, previousClose: 14.65 },
  { symbol: "APFIN",  name: "A Portfoy Fon A.S.",                          price: 8.80,  change: 0.14, changePercent: 1.62, volume: 7400000,  high: 8.88, low: 8.63, open: 8.66, previousClose: 8.66  },
  { symbol: "ARAT",   name: "Arat Tekstil Sanayi ve Ticaret A.S.",         price: 12.00, change: -0.20, changePercent: -1.64, volume: 6200000, high: 12.26, low: 11.92, open: 12.20, previousClose: 12.20 },
  { symbol: "AVEN",   name: "Avenio GYO A.S.",                             price: 9.60,  change: 0.16, changePercent: 1.69, volume: 7200000,  high: 9.68, low: 9.41, open: 9.44, previousClose: 9.44  },
  { symbol: "AYCES",  name: "Ayces Medikal Sanayi A.S.",                   price: 22.00, change: 0.36, changePercent: 1.67, volume: 3800000,  high: 22.20, low: 21.56, open: 21.64, previousClose: 21.64 },
  { symbol: "AYES",   name: "Ayes Celik Hasir A.S.",                       price: 16.40, change: -0.28, changePercent: -1.68, volume: 5000000, high: 16.78, low: 16.30, open: 16.68, previousClose: 16.68 },
  { symbol: "BAFRA",  name: "Bafra Tersanesi A.S.",                        price: 12.80, change: 0.21, changePercent: 1.67, volume: 6200000,  high: 12.90, low: 12.54, open: 12.59, previousClose: 12.59 },
  { symbol: "BARMA",  name: "Barma Boru Sanayi A.S.",                      price: 8.40,  change: -0.14, changePercent: -1.64, volume: 7600000, high: 8.60, low: 8.36, open: 8.54, previousClose: 8.54  },
  { symbol: "BASGZ",  name: "Baskent Dogalgaz Dagitim A.S.",               price: 36.00, change: 0.59, changePercent: 1.67, volume: 3400000,  high: 36.30, low: 35.27, open: 35.41, previousClose: 35.41 },
  { symbol: "BAYRK",  name: "Bayrak A.S.",                                 price: 18.00, change: -0.31, changePercent: -1.69, volume: 4800000, high: 18.40, low: 17.90, open: 18.31, previousClose: 18.31 },
  { symbol: "BINNJ",  name: "Bin Insaat A.S.",                             price: 14.60, change: 0.24, changePercent: 1.67, volume: 5400000,  high: 14.72, low: 14.30, open: 14.36, previousClose: 14.36 },
  { symbol: "BKFIN",  name: "BK Finansman A.S.",                           price: 9.80,  change: 0.16, changePercent: 1.66, volume: 7000000,  high: 9.88, low: 9.61, open: 9.64, previousClose: 9.64  },
  { symbol: "BRLSM",  name: "Bursa Yatirim Lojistik A.S.",                 price: 12.60, change: -0.21, changePercent: -1.64, volume: 6200000, high: 12.88, low: 12.52, open: 12.81, previousClose: 12.81 },
  { symbol: "BZEGY",  name: "Bezay GYO A.S.",                              price: 8.60,  change: 0.14, changePercent: 1.65, volume: 7800000,  high: 8.68, low: 8.43, open: 8.46, previousClose: 8.46  },
  { symbol: "COELKR", name: "Çolakoğlu Metalurji A.S.",                   price: 42.00, change: -0.70, changePercent: -1.64, volume: 3400000, high: 42.88, low: 41.78, open: 42.70, previousClose: 42.70 },
  { symbol: "CRDFA",  name: "Credit Finans Faktoring A.S.",                price: 14.80, change: 0.24, changePercent: 1.65, volume: 5200000,  high: 14.90, low: 14.50, open: 14.56, previousClose: 14.56 },
  { symbol: "CUSAN",  name: "Çusan Demir Celik A.S.",                     price: 28.50, change: 0.46, changePercent: 1.64, volume: 3400000,  high: 28.80, low: 27.94, open: 28.04, previousClose: 28.04 },
  { symbol: "DGKLB",  name: "Diger Klobal A.S.",                           price: 18.40, change: -0.32, changePercent: -1.71, volume: 4600000, high: 18.80, low: 18.30, open: 18.72, previousClose: 18.72 },
  { symbol: "DIABO",  name: "Diamondboard Kagit A.S.",                     price: 8.20,  change: 0.13, changePercent: 1.61, volume: 7600000,  high: 8.28, low: 8.04, open: 8.07, previousClose: 8.07  },
  { symbol: "DJIST",  name: "DJ Istanbul A.S.",                            price: 9.60,  change: -0.16, changePercent: -1.64, volume: 7200000, high: 9.82, low: 9.54, open: 9.76, previousClose: 9.76  },
  { symbol: "KIPAS",  name: "Kipas Tekstil Sanayi ve Ticaret A.S.",        price: 68.00, change: -1.14, changePercent: -1.65, volume: 1800000, high: 69.40, low: 67.60, open: 69.14, previousClose: 69.14 },
  // Eksik / yeni eklenen hisseler
  { symbol: "GUNDG",  name: "Güneydoğu Doğalgaz Dağıtım A.Ş.",           price: 18.50, change: 0.30, changePercent: 1.65, volume: 4200000,  high: 18.70, low: 18.14, open: 18.20, previousClose: 18.20 },
  { symbol: "GUNDZ",  name: "Gündüz Tarim Ürünleri A.Ş.",                price: 12.20, change: -0.20, changePercent: -1.61, volume: 3600000, high: 12.48, low: 12.14, open: 12.40, previousClose: 12.40 },
  { symbol: "GLBMD",  name: "Global MD Sağlık Hizmetleri A.Ş.",          price: 22.80, change: 0.37, changePercent: 1.65, volume: 3800000,  high: 23.00, low: 22.34, open: 22.43, previousClose: 22.43 },
  { symbol: "GLRYH",  name: "Glory Holding A.Ş.",                         price: 16.40, change: -0.28, changePercent: -1.68, volume: 5000000, high: 16.78, low: 16.30, open: 16.68, previousClose: 16.68 },
  { symbol: "GEDIK",  name: "Gedik Yatırım Menkul Değerler A.Ş.",        price: 34.20, change: 0.56, changePercent: 1.66, volume: 2800000,  high: 34.50, low: 33.54, open: 33.64, previousClose: 33.64 },
  { symbol: "GEDZA",  name: "Gediz Ambalaj Sanayi ve Ticaret A.Ş.",      price: 9.60,  change: -0.16, changePercent: -1.64, volume: 7200000, high: 9.82, low: 9.54, open: 9.76, previousClose: 9.76  },
  { symbol: "GOZDE",  name: "Gözde Girişim Sermayesi Yatırım Ortaklığı", price: 14.80, change: 0.24, changePercent: 1.65, volume: 5200000,  high: 14.90, low: 14.50, open: 14.56, previousClose: 14.56 },
  { symbol: "ODINE",  name: "Odine Teknoloji A.Ş.",                       price: 11.60, change: 0.19, changePercent: 1.66, volume: 6200000,  high: 11.72, low: 11.37, open: 11.41, previousClose: 11.41 },
  { symbol: "PASEU",  name: "Pasifik Avrupa Faktoring A.Ş.",              price: 8.80,  change: -0.15, changePercent: -1.67, volume: 7800000, high: 9.00, low: 8.74, open: 8.95, previousClose: 8.95  },
  { symbol: "PENGD",  name: "Penguen Gıda Sanayi A.Ş.",                   price: 19.40, change: 0.32, changePercent: 1.68, volume: 4000000,  high: 19.60, low: 19.02, open: 19.08, previousClose: 19.08 },
  { symbol: "DMRGD",  name: "Demirağ Sağlık Hizmetleri A.Ş.",            price: 14.20, change: -0.24, changePercent: -1.66, volume: 5600000, high: 14.52, low: 14.12, open: 14.44, previousClose: 14.44 },
  { symbol: "ETILR",  name: "Et ve Et Ürünleri A.Ş.",                    price: 22.40, change: 0.37, changePercent: 1.68, volume: 3600000,  high: 22.60, low: 21.96, open: 22.03, previousClose: 22.03 },
  { symbol: "AGSTS",  name: "Ağ Sistemleri ve Teknoloji A.Ş.",            price: 7.60,  change: 0.12, changePercent: 1.60, volume: 8400000,  high: 7.68, low: 7.45, open: 7.48, previousClose: 7.48  },
  { symbol: "AMNTA",  name: "Amnita Biyoteknoloji A.Ş.",                  price: 16.80, change: -0.28, changePercent: -1.64, volume: 4800000, high: 17.16, low: 16.70, open: 17.08, previousClose: 17.08 },
  { symbol: "APFIN",  name: "Apeks Finansman A.Ş.",                       price: 10.40, change: 0.17, changePercent: 1.66, volume: 6800000,  high: 10.50, low: 10.20, open: 10.23, previousClose: 10.23 },
  { symbol: "AVEN",   name: "Avenir Enerji A.Ş.",                         price: 13.60, change: -0.23, changePercent: -1.66, volume: 5800000, high: 13.90, low: 13.52, open: 13.83, previousClose: 13.83 },
  { symbol: "AYES",   name: "Ayes Çelik Hasır Sanayi A.Ş.",              price: 16.40, change: -0.28, changePercent: -1.68, volume: 5000000, high: 16.78, low: 16.30, open: 16.68, previousClose: 16.68 },
  { symbol: "GRSEL",  name: "Grsel Perakende Akaryakıt A.Ş.",             price: 24.60, change: 0.40, changePercent: 1.65, volume: 3200000,  high: 24.80, low: 24.12, open: 24.20, previousClose: 24.20 },
  { symbol: "INDES",  name: "Index Bilgisayar Sistemleri A.Ş.",           price: 72.40, change: -1.22, changePercent: -1.66, volume: 1600000, high: 73.90, low: 72.00, open: 73.62, previousClose: 73.62 },
  { symbol: "INTEM",  name: "İntem Müzik ve Eğlence A.Ş.",                price: 9.20,  change: 0.15, changePercent: 1.66, volume: 7600000,  high: 9.30, low: 9.02, open: 9.05, previousClose: 9.05  },
  { symbol: "INVEO",  name: "Inveo Yatırım Holding A.Ş.",                 price: 18.20, change: -0.31, changePercent: -1.68, volume: 4400000, high: 18.60, low: 18.10, open: 18.51, previousClose: 18.51 },
  { symbol: "QUAGR",  name: "Qua Granite Hadriye Çini A.Ş.",             price: 42.60, change: 0.70, changePercent: 1.67, volume: 2600000,  high: 42.96, low: 41.76, open: 41.90, previousClose: 41.90 },
  { symbol: "RALYH",  name: "Rally Holding A.Ş.",                         price: 8.40,  change: -0.14, changePercent: -1.64, volume: 7600000, high: 8.60, low: 8.36, open: 8.54, previousClose: 8.54  },
  { symbol: "RHEAG",  name: "Rhea Girişim Sermayesi A.Ş.",                price: 12.40, change: 0.20, changePercent: 1.64, volume: 6400000,  high: 12.52, low: 12.16, open: 12.20, previousClose: 12.20 },
  { symbol: "RTALB",  name: "Rota Lojistik A.Ş.",                         price: 15.80, change: -0.27, changePercent: -1.68, volume: 5000000, high: 16.14, low: 15.70, open: 16.07, previousClose: 16.07 },
  { symbol: "RYSGYO", name: "Rays Gayrimenkul Yatırım Ortaklığı A.Ş.",   price: 6.80,  change: 0.11, changePercent: 1.64, volume: 9400000,  high: 6.86, low: 6.67, open: 6.69, previousClose: 6.69  },
  { symbol: "SNKRN",  name: "Sanko Enerji Sanayi ve Ticaret A.Ş.",        price: 24.20, change: -0.41, changePercent: -1.67, volume: 3200000, high: 24.74, low: 24.08, open: 24.61, previousClose: 24.61 },
  { symbol: "SODSN",  name: "Soda Sanayii A.Ş.",                          price: 42.80, change: 0.70, changePercent: 1.66, volume: 2400000,  high: 43.12, low: 41.96, open: 42.10, previousClose: 42.10 },
  { symbol: "SURGY",  name: "Surgoo Medikal A.Ş.",                        price: 16.60, change: -0.28, changePercent: -1.66, volume: 4800000, high: 16.96, low: 16.52, open: 16.88, previousClose: 16.88 },
  { symbol: "TARKM",  name: "Tarkim Kimya Sanayi A.Ş.",                   price: 22.00, change: 0.36, changePercent: 1.67, volume: 3600000,  high: 22.20, low: 21.56, open: 21.64, previousClose: 21.64 },
  { symbol: "UCAK",   name: "Uçak Servisi A.Ş.",                          price: 36.40, change: -0.62, changePercent: -1.67, volume: 2200000, high: 37.18, low: 36.24, open: 37.02, previousClose: 37.02 },
  { symbol: "VAKKO",  name: "Vakko Tekstil ve Hazır Giyim Sanayi A.Ş.",  price: 48.60, change: 0.80, changePercent: 1.67, volume: 2000000,  high: 49.00, low: 47.64, open: 47.80, previousClose: 47.80 },
  { symbol: "YAPRK",  name: "Yaprak Süt ve Besicilik Sanayi A.Ş.",        price: 18.80, change: -0.32, changePercent: -1.67, volume: 4200000, high: 19.20, low: 18.70, open: 19.12, previousClose: 19.12 },
  { symbol: "YBTAS",  name: "Yıldız Boya ve Vernik Sanayi A.Ş.",         price: 14.40, change: 0.24, changePercent: 1.69, volume: 5400000,  high: 14.52, low: 14.12, open: 14.16, previousClose: 14.16 },
  { symbol: "YESIL",  name: "Yeşil Gayrimenkul Yatırım Ortaklığı A.Ş.", price: 8.20,  change: -0.14, changePercent: -1.68, volume: 7800000, high: 8.38, low: 8.14, open: 8.34, previousClose: 8.34  },
  { symbol: "YKSLN",  name: "Yükselen Çelik A.Ş.",                        price: 24.80, change: 0.41, changePercent: 1.68, volume: 3000000,  high: 25.02, low: 24.32, open: 24.39, previousClose: 24.39 },
  { symbol: "YUNSA",  name: "Yünsa Yünlü Sanayi ve Ticaret A.Ş.",        price: 32.60, change: -0.56, changePercent: -1.69, volume: 2400000, high: 33.30, low: 32.46, open: 33.16, previousClose: 33.16 },
  { symbol: "CELHA",  name: "Çelik Halat ve Tel Sanayi A.Ş.",             price: 44.20, change: 0.72, changePercent: 1.66, volume: 2200000,  high: 44.58, low: 43.34, open: 43.48, previousClose: 43.48 },
  { symbol: "LUKSK",  name: "Lüks Kadife Ticaret ve Sanayi A.Ş.",        price: 28.40, change: -0.48, changePercent: -1.66, volume: 2800000, high: 29.02, low: 28.26, open: 28.88, previousClose: 28.88 },
  { symbol: "MAALT",  name: "Marmara Altın İşletmeciliği A.Ş.",          price: 56.20, change: 0.92, changePercent: 1.66, volume: 1800000,  high: 56.68, low: 55.10, open: 55.28, previousClose: 55.28 },
  { symbol: "MIPAZ",  name: "Mipaz Mermer İşleme A.Ş.",                  price: 12.00, change: -0.20, changePercent: -1.64, volume: 6400000, high: 12.26, low: 11.94, open: 12.20, previousClose: 12.20 },
  { symbol: "MTRKS",  name: "Matriks Bilgi Dağıtım Hizmetleri A.Ş.",     price: 62.40, change: 1.02, changePercent: 1.66, volume: 1600000,  high: 62.92, low: 61.18, open: 61.38, previousClose: 61.38 },
  { symbol: "MZHLD",  name: "Mzho Holding A.Ş.",                          price: 8.40,  change: -0.14, changePercent: -1.64, volume: 7600000, high: 8.60, low: 8.36, open: 8.54, previousClose: 8.54  },
  { symbol: "NCTS",   name: "Niğde Çimento Sanayi A.Ş.",                  price: 22.60, change: 0.37, changePercent: 1.67, volume: 3400000,  high: 22.80, low: 22.16, open: 22.23, previousClose: 22.23 },
  { symbol: "NIBAS",  name: "Nibal Yapı Malzemeleri A.Ş.",                price: 11.80, change: -0.20, changePercent: -1.67, volume: 6600000, high: 12.06, low: 11.74, open: 12.00, previousClose: 12.00 },
  { symbol: "OBAMS",  name: "Obam Yapı Sanayi A.Ş.",                      price: 9.80,  change: 0.16, changePercent: 1.66, volume: 7200000,  high: 9.88, low: 9.61, open: 9.64, previousClose: 9.64  },
  { symbol: "OBASE",  name: "Otokar Baz Araç Sanayi ve Ticaret A.Ş.",    price: 46.80, change: -0.80, changePercent: -1.68, volume: 2000000, high: 47.80, low: 46.60, open: 47.60, previousClose: 47.60 },
  // Eksik hisseler – kullanıcı talebi
  { symbol: "UCAYM",  name: "Ucay Mühendislik ve İnşaat A.Ş.",             price: 29.50, change: 2.68, changePercent: 9.99,  volume: 25322426, high: 29.50, low: 26.26, open: 26.80, previousClose: 26.82 },
  { symbol: "DOHOL",  name: "Doğan Şirketler Grubu Holding A.Ş.",          price: 20.68, change: -0.22, changePercent: -1.05, volume: 8608817,  high: 20.80, low: 19.75, open: 20.18, previousClose: 20.90 },
  { symbol: "SANEL",  name: "Sanel Elektrik Sanayi ve Ticaret A.Ş.",       price: 34.88, change: -1.24, changePercent: -3.43, volume: 206041,   high: 35.96, low: 34.56, open: 35.96, previousClose: 36.12 },
  { symbol: "BRKVY",  name: "Birikim Varlık Yönetimi A.Ş.",                price: 89.55, change: 0.35, changePercent: 0.39,  volume: 510252,   high: 90.30, low: 86.40, open: 87.55, previousClose: 89.20 },
  { symbol: "SNGYO",  name: "Sinpaş Gayrimenkul Yatırım Ortaklığı A.Ş.",  price: 3.77,  change: -0.09, changePercent: -2.33, volume: 48824457, high: 3.84,  low: 3.65,  open: 3.84,  previousClose: 3.86  },
  { symbol: "PATEK",  name: "Patek Holding A.Ş.",                         price: 22.40, change: 0.40, changePercent: 1.82,  volume: 1254320,  high: 22.80, low: 21.60, open: 22.00, previousClose: 22.00 },
  { symbol: "ATLAS",  name: "Atlas Maden Enerji Sanayi ve Ticaret A.Ş.", price: 18.75, change: -0.25, changePercent: -1.32, volume: 3482150,  high: 19.20, low: 18.50, open: 19.00, previousClose: 19.00 },
  { symbol: "AKHAN", name: "Akhan Un Fabrikasi Ve Tarim Urunleri Gida Sanayi Ticaret Anonim Sirketi", price: 26.7, change: 0.00, changePercent: 0.00, volume: 0, high: 26.7, low: 26.7, open: 26.7, previousClose: 26.7 },
  { symbol: "AKSUE", name: "Aksu Enerji ve Ticaret A.S.", price: 29.04, change: 0.00, changePercent: 0.00, volume: 0, high: 29.04, low: 29.04, open: 29.04, previousClose: 29.04 },
  { symbol: "ALCTL", name: "Alcatel Lucent Teletas Telekomunikasyon A.S.", price: 134.4, change: 0.00, changePercent: 0.00, volume: 0, high: 134.4, low: 134.4, open: 134.4, previousClose: 134.4 },
  { symbol: "ALTIN", name: "DARPHANE ALTIN SERTIFIKASI", price: 81.85, change: 0.00, changePercent: 0.00, volume: 0, high: 81.85, low: 81.85, open: 81.85, previousClose: 81.85 },
  { symbol: "ALTNY", name: "ALTINAY SAVUNMA", price: 1, change: 0.00, changePercent: 0.00, volume: 0, high: 1, low: 1, open: 1, previousClose: 1 },
  { symbol: "ARASE", name: "Dogu Aras Enerji Yatirimlari AS", price: 89.9, change: 0.00, changePercent: 0.00, volume: 0, high: 89.9, low: 89.9, open: 89.9, previousClose: 89.9 },
  { symbol: "ARFYE", name: "ARF Bio Yenilenebilir Enerji Uretim AS", price: 27.96, change: 0.00, changePercent: 0.00, volume: 0, high: 27.96, low: 27.96, open: 27.96, previousClose: 27.96 },
  { symbol: "ARMGD", name: "Armada Gida Ticaret ve Sanayi Anonim Sirketi", price: 98.9, change: 0.00, changePercent: 0.00, volume: 0, high: 98.9, low: 98.9, open: 98.9, previousClose: 98.9 },
  { symbol: "ARZUM", name: "Arzum Elektrikli Ev Aletleri Sanayi ve Ticaret AS", price: 2.82, change: 0.00, changePercent: 0.00, volume: 0, high: 2.82, low: 2.82, open: 2.82, previousClose: 2.82 },
  { symbol: "AVPGY", name: "Avrupakent Gayrimenkul Yatirim Ortakligi A.S.", price: 49.7, change: 0.00, changePercent: 0.00, volume: 0, high: 49.7, low: 49.7, open: 49.7, previousClose: 49.7 },
  { symbol: "BALAT", name: "Balatacilar Balatacilik Sanayi ve Ticaret AS", price: 96.5, change: 0.00, changePercent: 0.00, volume: 0, high: 96.5, low: 96.5, open: 96.5, previousClose: 96.5 },
  { symbol: "BASCM", name: "Bastas Baskent Cimento Sanayi ve Ticaret A.S.", price: 13.36, change: 0.00, changePercent: 0.00, volume: 0, high: 13.36, low: 13.36, open: 13.36, previousClose: 13.36 },
  { symbol: "BEGYO", name: "Bati Ege Gayrimenkul Yatirim Ortakligi A.S.", price: 4.47, change: 0.00, changePercent: 0.00, volume: 0, high: 4.47, low: 4.47, open: 4.47, previousClose: 4.47 },
  { symbol: "BESLR", name: "Besler Gida Ve Kimya Sanayi Ve Ticaret AS", price: 13.43, change: 0.00, changePercent: 0.00, volume: 0, high: 13.43, low: 13.43, open: 13.43, previousClose: 13.43 },
  { symbol: "BESTE", name: "Best Brands Grup Enerji Yatirim as", price: 23.7, change: 0.00, changePercent: 0.00, volume: 0, high: 23.7, low: 23.7, open: 23.7, previousClose: 23.7 },
  { symbol: "BEYAZ", name: "Beyaz Filo Oto Kiralama AS", price: 27.38, change: 0.00, changePercent: 0.00, volume: 0, high: 27.38, low: 27.38, open: 27.38, previousClose: 27.38 },
  { symbol: "BIENY", name: "Bien Yapi Urunleri Sanayi Turizm Ve Ticaret Anonim Sirketi", price: 24.18, change: 0.00, changePercent: 0.00, volume: 0, high: 24.18, low: 24.18, open: 24.18, previousClose: 24.18 },
  { symbol: "BIGEN", name: "Birlesim Grup Enerji Yatirimlari AS", price: 9.22, change: 0.00, changePercent: 0.00, volume: 0, high: 9.22, low: 9.22, open: 9.22, previousClose: 9.22 },
  { symbol: "BIGTK", name: "Big Medya Teknoloji A.S.", price: 229.2, change: 0.00, changePercent: 0.00, volume: 0, high: 229.2, low: 229.2, open: 229.2, previousClose: 229.2 },
  { symbol: "BINBN", name: "Bin Ulasim Ve Akilli Sehir Teknolojileri AS", price: 162.7, change: 0.00, changePercent: 0.00, volume: 0, high: 162.7, low: 162.7, open: 162.7, previousClose: 162.7 },
  { symbol: "BINHO", name: "1000 Yatirimlar Holding AS", price: 9.32, change: 0.00, changePercent: 0.00, volume: 0, high: 9.32, low: 9.32, open: 9.32, previousClose: 9.32 },
  { symbol: "BLUME", name: "Blume Metal Kimya Anonim Sirketi", price: 43.44, change: 0.00, changePercent: 0.00, volume: 0, high: 43.44, low: 43.44, open: 43.44, previousClose: 43.44 },
  { symbol: "BMSCH", name: "BMS Celik Hasir Sanayi Ve Ticaret A.S.", price: 16.85, change: 0.00, changePercent: 0.00, volume: 0, high: 16.85, low: 16.85, open: 16.85, previousClose: 16.85 },
  { symbol: "BMSTL", name: "Bms Birlesik Metal Sanayi ve Ticaret A.S.", price: 85.2, change: 0.00, changePercent: 0.00, volume: 0, high: 85.2, low: 85.2, open: 85.2, previousClose: 85.2 },
  { symbol: "BOBET", name: "Bogazici Beton Sanayi ve Ticaret AS", price: 19.36, change: 0.00, changePercent: 0.00, volume: 0, high: 19.36, low: 19.36, open: 19.36, previousClose: 19.36 },
  { symbol: "BORSK", name: "Bor Seker A.S.", price: 6.87, change: 0.00, changePercent: 0.00, volume: 0, high: 6.87, low: 6.87, open: 6.87, previousClose: 6.87 },
  { symbol: "BRKSN", name: "Berkosan Yalitim ve Tecrit Maddeleri Uretim ve Ticaret A.S.", price: 9.01, change: 0.00, changePercent: 0.00, volume: 0, high: 9.01, low: 9.01, open: 9.01, previousClose: 9.01 },
  { symbol: "BVSAN", name: "BULBULOGLU VINC SANAYI VE TICARET A.S.", price: 107.8, change: 0.00, changePercent: 0.00, volume: 0, high: 107.8, low: 107.8, open: 107.8, previousClose: 107.8 },
  { symbol: "BYDNR", name: "Baydoner Restoranlari A.S.", price: 38.18, change: 0.00, changePercent: 0.00, volume: 0, high: 38.18, low: 38.18, open: 38.18, previousClose: 38.18 },
  { symbol: "CASA", name: "Casa Emtia Petrol Kimyevi ve Turevleri Sanayi Ticaret AS", price: 88, change: 0.00, changePercent: 0.00, volume: 0, high: 88, low: 88, open: 88, previousClose: 88 },
  { symbol: "CATES", name: "Cates Elektrik Uretim Anonim Sirketi", price: 44.04, change: 0.00, changePercent: 0.00, volume: 0, high: 44.04, low: 44.04, open: 44.04, previousClose: 44.04 },
  { symbol: "CEMZY", name: "CEM ZEYTIN ANONIM SIRKETI", price: 65.5, change: 0.00, changePercent: 0.00, volume: 0, high: 65.5, low: 65.5, open: 65.5, previousClose: 65.5 },
  { symbol: "CGCAM", name: "Cagdas Cam Sanayi ve Ticaret AS", price: 35.82, change: 0.00, changePercent: 0.00, volume: 0, high: 35.82, low: 35.82, open: 35.82, previousClose: 35.82 },
  { symbol: "CWENE", name: "CW ENERJI MUHENDISLIK TICARET VE SANAYI A.S.", price: 29.12, change: 0.00, changePercent: 0.00, volume: 0, high: 29.12, low: 29.12, open: 29.12, previousClose: 29.12 },
  { symbol: "DARDL", name: "Dardanel Onentas Gida San. A.S.", price: 1.94, change: 0.00, changePercent: 0.00, volume: 0, high: 1.94, low: 1.94, open: 1.94, previousClose: 1.94 },
  { symbol: "DCTTR", name: "DCT Trading Dis Ticaret Anonim Sirketi", price: 10.62, change: 0.00, changePercent: 0.00, volume: 0, high: 10.62, low: 10.62, open: 10.62, previousClose: 10.62 },
  { symbol: "DERIM", name: "Derimod Konfeksiyon Ayakkabi Deri Sanayi ve Ticaret A.S.", price: 34.7, change: 0.00, changePercent: 0.00, volume: 0, high: 34.7, low: 34.7, open: 34.7, previousClose: 34.7 },
  { symbol: "DGNMO", name: "Doganlar Mobilya Grubu Imalat Sanayi ve Ticaret A.S.", price: 3.85, change: 0.00, changePercent: 0.00, volume: 0, high: 3.85, low: 3.85, open: 3.85, previousClose: 3.85 },
  { symbol: "DIRIT", name: "Diriteks Dirilis Tekstil Sanayi ve Ticaret A.S.", price: 27.8, change: 0.00, changePercent: 0.00, volume: 0, high: 27.8, low: 27.8, open: 27.8, previousClose: 27.8 },
  { symbol: "DMLKT", name: "Emlak Konut Gayrimenkul Yatirim Ortakligi A.S. 0 % Certificates 2025-31.12.2199", price: 5.73, change: 0.00, changePercent: 0.00, volume: 0, high: 5.73, low: 5.73, open: 5.73, previousClose: 5.73 },
  { symbol: "DOFER", name: "Dofer Yapi Maizemeleri Sanayi ve Ticaret A.S.", price: 33.7, change: 0.00, changePercent: 0.00, volume: 0, high: 33.7, low: 33.7, open: 33.7, previousClose: 33.7 },
  { symbol: "DOKTA", name: "Doktas Dokumculuk Ticaret ve Sanayi A.S.", price: 23.28, change: 0.00, changePercent: 0.00, volume: 0, high: 23.28, low: 23.28, open: 23.28, previousClose: 23.28 },
  { symbol: "DUNYH", name: "Dunya Holding Anonim Sirketi", price: 102.6, change: 0.00, changePercent: 0.00, volume: 0, high: 102.6, low: 102.6, open: 102.6, previousClose: 102.6 },
  { symbol: "DURKN", name: "Durukan Sekerleme Sanayi ve Ticaret AS", price: 19.1, change: 0.00, changePercent: 0.00, volume: 0, high: 19.1, low: 19.1, open: 19.1, previousClose: 19.1 },
  { symbol: "EBEBK", name: "EBEBEK MAGAZACILIK ANONIM SIRKETI", price: 60.45, change: 0.00, changePercent: 0.00, volume: 0, high: 60.45, low: 60.45, open: 60.45, previousClose: 60.45 },
  { symbol: "EGEGY", name: "Egeyapi Avrupa Gayrimenkul Yatirim Ortakligi A.S.", price: 29.92, change: 0.00, changePercent: 0.00, volume: 0, high: 29.92, low: 29.92, open: 29.92, previousClose: 29.92 },
  { symbol: "EGEPO", name: "Nasmed Ozel Saglik Hizmetleri Ticaret A.S.", price: 14.13, change: 0.00, changePercent: 0.00, volume: 0, high: 14.13, low: 14.13, open: 14.13, previousClose: 14.13 },
  { symbol: "EKOS", name: "Ekos Teknoloji ve Elektrik AS", price: 5.46, change: 0.00, changePercent: 0.00, volume: 0, high: 5.46, low: 5.46, open: 5.46, previousClose: 5.46 },
  { symbol: "EKSUN", name: "Eksun Gida Tarim Sanayi ve Ticaret", price: 5.28, change: 0.00, changePercent: 0.00, volume: 0, high: 5.28, low: 5.28, open: 5.28, previousClose: 5.28 },
  { symbol: "ELITE", name: "Elite Naturel Organik Gida Sanayi ve Ticaret AS", price: 28.88, change: 0.00, changePercent: 0.00, volume: 0, high: 28.88, low: 28.88, open: 28.88, previousClose: 28.88 },
  { symbol: "EMNIS", name: "Eminis Ambalaj Sanayi ve Ticaret A.S.", price: 150.8, change: 0.00, changePercent: 0.00, volume: 0, high: 150.8, low: 150.8, open: 150.8, previousClose: 150.8 },
  { symbol: "ENDAE", name: "Enda Enerji Holding Anonim Sirketi", price: 15.76, change: 0.00, changePercent: 0.00, volume: 0, high: 15.76, low: 15.76, open: 15.76, previousClose: 15.76 },
  { symbol: "ENERY", name: "Enerya Enerji A.S.", price: 8.48, change: 0.00, changePercent: 0.00, volume: 0, high: 8.48, low: 8.48, open: 8.48, previousClose: 8.48 },
  { symbol: "ENJSA", name: "Enerjisa Enerji A.S.", price: 119.4, change: 0.00, changePercent: 0.00, volume: 0, high: 119.4, low: 119.4, open: 119.4, previousClose: 119.4 },
  { symbol: "ENTRA", name: "IC Enterra Yenilenebilir Enerji AS", price: 11.31, change: 0.00, changePercent: 0.00, volume: 0, high: 11.31, low: 11.31, open: 11.31, previousClose: 11.31 },
  { symbol: "ESCOM", name: "Escort Teknoloji Yatirim A.S.", price: 4.42, change: 0.00, changePercent: 0.00, volume: 0, high: 4.42, low: 4.42, open: 4.42, previousClose: 4.42 },
  { symbol: "ESEN", name: "Esenboga Elektrik Uretim AS", price: 3.85, change: 0.00, changePercent: 0.00, volume: 0, high: 3.85, low: 3.85, open: 3.85, previousClose: 3.85 },
  { symbol: "EUKYO", name: "Euro Kapital Yatirim Ortakligi AS", price: 21.22, change: 0.00, changePercent: 0.00, volume: 0, high: 21.22, low: 21.22, open: 21.22, previousClose: 21.22 },
  { symbol: "EUREN", name: "Europen Endustri Insaat Sanayi ve Ticaret A.S.", price: 4.52, change: 0.00, changePercent: 0.00, volume: 0, high: 4.52, low: 4.52, open: 4.52, previousClose: 4.52 },
  { symbol: "EUYO", name: "Euro Menkul Kiymet Yatirim Ortakligi A.S.", price: 17.84, change: 0.00, changePercent: 0.00, volume: 0, high: 17.84, low: 17.84, open: 17.84, previousClose: 17.84 },
  { symbol: "FORTE", name: "FORTE BILGI ILETISIM TEKNOLOJILERI VE SAVUNMA SANAYI A.S.", price: 107.6, change: 0.00, changePercent: 0.00, volume: 0, high: 107.6, low: 107.6, open: 107.6, previousClose: 107.6 },
  { symbol: "FRIGO", name: "Frigo-Pak Gida Maddeleri Sanayi ve Ticaret A.S.", price: 9.91, change: 0.00, changePercent: 0.00, volume: 0, high: 9.91, low: 9.91, open: 9.91, previousClose: 9.91 },
  { symbol: "FRMPL", name: "Formul Plastik Ve Metal Sanayi AS", price: 32.28, change: 0.00, changePercent: 0.00, volume: 0, high: 32.28, low: 32.28, open: 32.28, previousClose: 32.28 },
  { symbol: "GENIL", name: "Gen Ilac ve Saglik Urunleri Sanayi ve Ticaret A.S.", price: 10.83, change: 0.00, changePercent: 0.00, volume: 0, high: 10.83, low: 10.83, open: 10.83, previousClose: 10.83 },
  { symbol: "GENTS", name: "Gentas Dekoratif Yuzeyler Sanayi ve Ticaret A.S.", price: 8.66, change: 0.00, changePercent: 0.00, volume: 0, high: 8.66, low: 8.66, open: 8.66, previousClose: 8.66 },
  { symbol: "GESAN", name: "GIRISIM ELEKTRIK SANAYI TAAHHUT VE TICARET A.S.", price: 47.92, change: 0.00, changePercent: 0.00, volume: 0, high: 47.92, low: 47.92, open: 47.92, previousClose: 47.92 },
  { symbol: "GIPTA", name: "Gipta Ofis Kirtasiye ve Promosyon Urunleri Imalat Sanayi A.S.", price: 70.2, change: 0.00, changePercent: 0.00, volume: 0, high: 70.2, low: 70.2, open: 70.2, previousClose: 70.2 },
  { symbol: "GLCVY", name: "GELECEK VARLIK YONETIMI A.S", price: 63.75, change: 0.00, changePercent: 0.00, volume: 0, high: 63.75, low: 63.75, open: 63.75, previousClose: 63.75 },
  { symbol: "GLRMK", name: "Gulermak Agir Sanayi Insaat Ve Taahhut A.S.", price: 180.2, change: 0.00, changePercent: 0.00, volume: 0, high: 180.2, low: 180.2, open: 180.2, previousClose: 180.2 },
  { symbol: "GMTAS", name: "Gimat Magazacilik Insaat Sanayi ve Ticaret A.S.", price: 26.98, change: 0.00, changePercent: 0.00, volume: 0, high: 26.98, low: 26.98, open: 26.98, previousClose: 26.98 },
  { symbol: "GOKNR", name: "GOKNUR GIDA MADDELERI ENERJI IMALAT ITHALAT IHRACAT TICARET VE SANAYI A.S.", price: 21.82, change: 0.00, changePercent: 0.00, volume: 0, high: 21.82, low: 21.82, open: 21.82, previousClose: 21.82 },
  { symbol: "GRNYO", name: "Garanti Yatirim Ortakligi A.S.", price: 14.06, change: 0.00, changePercent: 0.00, volume: 0, high: 14.06, low: 14.06, open: 14.06, previousClose: 14.06 },
  { symbol: "GRTHO", name: "Grainturk Holding A.S.", price: 224.4, change: 0.00, changePercent: 0.00, volume: 0, high: 224.4, low: 224.4, open: 224.4, previousClose: 224.4 },
  { symbol: "GZNMI", name: "Gezinomi Seyahat Turizm Ticaret A.S.", price: 63.4, change: 0.00, changePercent: 0.00, volume: 0, high: 63.4, low: 63.4, open: 63.4, previousClose: 63.4 },
  { symbol: "HATSN", name: "Hat-San Gemi Insaa Bakim Onarim Deniz Nakliyat Sanayi ve Ticaret A.S.", price: 37.84, change: 0.00, changePercent: 0.00, volume: 0, high: 37.84, low: 37.84, open: 37.84, previousClose: 37.84 },
  { symbol: "HEDEF", name: "Hedef Holding AS", price: 137.4, change: 0.00, changePercent: 0.00, volume: 0, high: 137.4, low: 137.4, open: 137.4, previousClose: 137.4 },
  { symbol: "HKTM", name: "HIDROPAR HAREKET KONTROL TEKNOLOJILERI MERKEZI SANAYI VE TICARET ANONIM SIRKETI", price: 11.51, change: 0.00, changePercent: 0.00, volume: 0, high: 11.51, low: 11.51, open: 11.51, previousClose: 11.51 },
  { symbol: "HOROZ", name: "Horoz Lojistik Kargo Hizmetleri Ve Ticaret AS", price: 57.7, change: 0.00, changePercent: 0.00, volume: 0, high: 57.7, low: 57.7, open: 57.7, previousClose: 57.7 },
  { symbol: "HTTBT", name: "Hitit Bilgisayar Hizmetleri A.S.", price: 36.96, change: 0.00, changePercent: 0.00, volume: 0, high: 36.96, low: 36.96, open: 36.96, previousClose: 36.96 },
  { symbol: "IDGYO", name: "Idealist Gayrimenkul Yatirim Ortakligi A.S.", price: 4.18, change: 0.00, changePercent: 0.00, volume: 0, high: 4.18, low: 4.18, open: 4.18, previousClose: 4.18 },
  { symbol: "IEYHO", name: "Isiklar Enerji ve Yapi Holding A.S.", price: 92.65, change: 0.00, changePercent: 0.00, volume: 0, high: 92.65, low: 92.65, open: 92.65, previousClose: 92.65 },
  { symbol: "IHAAS", name: "Ihlas Haber Ajansi SA", price: 82.05, change: 0.00, changePercent: 0.00, volume: 0, high: 82.05, low: 82.05, open: 82.05, previousClose: 82.05 },
  { symbol: "IHYAY", name: "Ihlas Yayin Holding A.S.", price: 1.7, change: 0.00, changePercent: 0.00, volume: 0, high: 1.7, low: 1.7, open: 1.7, previousClose: 1.7 },
  { symbol: "INFO", name: "INFO YATIRIM MENKUL DEGERLER A.S", price: 3.25, change: 0.00, changePercent: 0.00, volume: 0, high: 3.25, low: 3.25, open: 3.25, previousClose: 3.25 },
  { symbol: "INGRM", name: "Ingram Micro Bilisim Sistemleri A.S.", price: 388.25, change: 0.00, changePercent: 0.00, volume: 0, high: 388.25, low: 388.25, open: 388.25, previousClose: 388.25 },
  { symbol: "INTEK", name: "Innosa Teknoloji Anonim Sirketi", price: 238.2, change: 0.00, changePercent: 0.00, volume: 0, high: 238.2, low: 238.2, open: 238.2, previousClose: 238.2 },
  { symbol: "INVES", name: "Investco Holding A.S.", price: 483.5, change: 0.00, changePercent: 0.00, volume: 0, high: 483.5, low: 483.5, open: 483.5, previousClose: 483.5 },
  { symbol: "ISBIR", name: "Isbir Holding AS", price: 71.1, change: 0.00, changePercent: 0.00, volume: 0, high: 71.1, low: 71.1, open: 71.1, previousClose: 71.1 },
  { symbol: "ISBTR", name: "Turkiye Is Bankasi Anonim Sirketi Class B", price: 410000, change: 0.00, changePercent: 0.00, volume: 0, high: 410000, low: 410000, open: 410000, previousClose: 410000 },
  { symbol: "ISKPL", name: "Isik Plastik Sanayi ve Dis Ticaret Pazarlama Anonim Sirketi", price: 16.36, change: 0.00, changePercent: 0.00, volume: 0, high: 16.36, low: 16.36, open: 16.36, previousClose: 16.36 },
  { symbol: "ISKUR", name: "Turkiye Is Bankasi Anonim Sirketi", price: 2702500, change: 0.00, changePercent: 0.00, volume: 0, high: 2702500, low: 2702500, open: 2702500, previousClose: 2702500 },
  { symbol: "ISSEN", name: "Isbir Sentetik Dokuma Sanayi AS", price: 7.57, change: 0.00, changePercent: 0.00, volume: 0, high: 7.57, low: 7.57, open: 7.57, previousClose: 7.57 },
  { symbol: "IZENR", name: "Izdemir Enerji Elektrik Uretim A.S.", price: 9.39, change: 0.00, changePercent: 0.00, volume: 0, high: 9.39, low: 9.39, open: 9.39, previousClose: 9.39 },
  { symbol: "KARTN", name: "Kartonsan Karton Sanayi ve Ticaret Anonim Sirketi", price: 62.65, change: 0.00, changePercent: 0.00, volume: 0, high: 62.65, low: 62.65, open: 62.65, previousClose: 62.65 },
  { symbol: "KLKIM", name: "Kalekim Kimyevi Maddeler Sanayi ve Ticaret AS", price: 36.56, change: 0.00, changePercent: 0.00, volume: 0, high: 36.56, low: 36.56, open: 36.56, previousClose: 36.56 },
  { symbol: "KLSER", name: "Kaleseramik Canakkale Kalebodur Seramik A.S.", price: 25.52, change: 0.00, changePercent: 0.00, volume: 0, high: 25.52, low: 25.52, open: 25.52, previousClose: 25.52 },
  { symbol: "KLYPV", name: "Kalyon Gunes Teknolojileri Uretim Anonim Sirketi", price: 62.5, change: 0.00, changePercent: 0.00, volume: 0, high: 62.5, low: 62.5, open: 62.5, previousClose: 62.5 },
  { symbol: "KOCMT", name: "Koc Metalurji AS", price: 2.5, change: 0.00, changePercent: 0.00, volume: 0, high: 2.5, low: 2.5, open: 2.5, previousClose: 2.5 },
  { symbol: "KORDS", name: "Kordsa Teknik Tekstil A.S.", price: 55.05, change: 0.00, changePercent: 0.00, volume: 0, high: 55.05, low: 55.05, open: 55.05, previousClose: 55.05 },
  { symbol: "KOTON", name: "Koton Magazacilik Tekstil Sanayi ve Ticaret A.S.", price: 14.74, change: 0.00, changePercent: 0.00, volume: 0, high: 14.74, low: 14.74, open: 14.74, previousClose: 14.74 },
  { symbol: "KRDMA", name: "Kardemir Karabiik Demir celik Sanayi ve Ticaret A.S. Class A", price: 29.36, change: 0.00, changePercent: 0.00, volume: 0, high: 29.36, low: 29.36, open: 29.36, previousClose: 29.36 },
  { symbol: "KRDMB", name: "Kardemir Karabük Demir Çelik Sanayi Ve Ticaret A.S.", price: 59.4, change: 0.00, changePercent: 0.00, volume: 0, high: 59.4, low: 59.4, open: 59.4, previousClose: 59.4 },
  { symbol: "KRONT", name: "Kron Teknoloji AS", price: 21, change: 0.00, changePercent: 0.00, volume: 0, high: 21, low: 21, open: 21, previousClose: 21 },
  { symbol: "KRTEK", name: "Karsu Tekstil Sanayii ve Ticaret A.S.", price: 23.74, change: 0.00, changePercent: 0.00, volume: 0, high: 23.74, low: 23.74, open: 23.74, previousClose: 23.74 },
  { symbol: "KRVGD", name: "Kervan Gida Sanayi ve Ticaret AS", price: 2.68, change: 0.00, changePercent: 0.00, volume: 0, high: 2.68, low: 2.68, open: 2.68, previousClose: 2.68 },
  { symbol: "KSTUR", name: "Kustur Kusadasi Turizm Endüstrisi A.S.", price: 2967.5, change: 0.00, changePercent: 0.00, volume: 0, high: 2967.5, low: 2967.5, open: 2967.5, previousClose: 2967.5 },
  { symbol: "KTSKR", name: "Kutahya Seker Fabrikasi AS", price: 77.25, change: 0.00, changePercent: 0.00, volume: 0, high: 77.25, low: 77.25, open: 77.25, previousClose: 77.25 },
  { symbol: "KUTPO", name: "Kutahya Porselen Sanayi A.S.", price: 88.5, change: 0.00, changePercent: 0.00, volume: 0, high: 88.5, low: 88.5, open: 88.5, previousClose: 88.5 },
  { symbol: "KUVVA", name: "Kuvva Gida Ticaret ve Sanayi Yatirimlari A.S.", price: 131, change: 0.00, changePercent: 0.00, volume: 0, high: 131, low: 131, open: 131, previousClose: 131 },
  { symbol: "KZBGY", name: "Kizilbuk Gayrimenkul Yatirim Ortakligi A.S.", price: 3.4, change: 0.00, changePercent: 0.00, volume: 0, high: 3.4, low: 3.4, open: 3.4, previousClose: 3.4 },
  { symbol: "KZGYO", name: "Kuzugrup Gayrimenkul Yatirim Ortakligi AS", price: 22.92, change: 0.00, changePercent: 0.00, volume: 0, high: 22.92, low: 22.92, open: 22.92, previousClose: 22.92 },
  { symbol: "LILAK", name: "Lila Kagit Sanayi Ve Ticaret Anonim Sirketi", price: 36.66, change: 0.00, changePercent: 0.00, volume: 0, high: 36.66, low: 36.66, open: 36.66, previousClose: 36.66 },
  { symbol: "LINK", name: "Link Bilgisayar Sistemleri Yazilimi ve Donanimi Sanayi ve Ticaret A.S.", price: 5.21, change: 0.00, changePercent: 0.00, volume: 0, high: 5.21, low: 5.21, open: 5.21, previousClose: 5.21 },
  { symbol: "LKMNH", name: "Lokman Hekim Engürüsag Saglik, Turizm, Egitim Hizmetleri ve Insaat Taahhüt A.S.", price: 14.98, change: 0.00, changePercent: 0.00, volume: 0, high: 14.98, low: 14.98, open: 14.98, previousClose: 14.98 },
  { symbol: "LYDHO", name: "Lydia Holding A.S.", price: 184.8, change: 0.00, changePercent: 0.00, volume: 0, high: 184.8, low: 184.8, open: 184.8, previousClose: 184.8 },
  { symbol: "LYDYE", name: "Lydia Yesil Enerji kaynaklari A.S.", price: 16812.5, change: 0.00, changePercent: 0.00, volume: 0, high: 16812.5, low: 16812.5, open: 16812.5, previousClose: 16812.5 },
  { symbol: "MAKIM", name: "MAKIM MAKINA TEKNOLOJILERI SANAYIVE TICARET A.S.", price: 16.92, change: 0.00, changePercent: 0.00, volume: 0, high: 16.92, low: 16.92, open: 16.92, previousClose: 16.92 },
  { symbol: "MAKTK", name: "Makina Takim Endustrisi A.S.", price: 13.43, change: 0.00, changePercent: 0.00, volume: 0, high: 13.43, low: 13.43, open: 13.43, previousClose: 13.43 },
  { symbol: "MARBL", name: "Tureks Turunc Madencilik Ic ve Dis Ticaret A.S.", price: 12.49, change: 0.00, changePercent: 0.00, volume: 0, high: 12.49, low: 12.49, open: 12.49, previousClose: 12.49 },
  { symbol: "MARMR", name: "Marmara Holding AS", price: 2.64, change: 0.00, changePercent: 0.00, volume: 0, high: 2.64, low: 2.64, open: 2.64, previousClose: 2.64 },
  { symbol: "MEDTR", name: "Meditera Tibbi Malzeme Sanayi Ve Ticaret A.S.", price: 27.4, change: 0.00, changePercent: 0.00, volume: 0, high: 27.4, low: 27.4, open: 27.4, previousClose: 27.4 },
  { symbol: "MEGMT", name: "Mega Metal Sanayi Ve Ticaret A.S.", price: 79.2, change: 0.00, changePercent: 0.00, volume: 0, high: 79.2, low: 79.2, open: 79.2, previousClose: 79.2 },
  { symbol: "MEPET", name: "Mepet Metro Petrol ve Tesisleri Sanayi Ticaret AS", price: 25.38, change: 0.00, changePercent: 0.00, volume: 0, high: 25.38, low: 25.38, open: 25.38, previousClose: 25.38 },
  { symbol: "MERCN", name: "MERCAN KIMYA SANAYI VE TICARET A.S.", price: 16.3, change: 0.00, changePercent: 0.00, volume: 0, high: 16.3, low: 16.3, open: 16.3, previousClose: 16.3 },
  { symbol: "MERIT", name: "Merit Turizm Yatirim ve Isletme Anonim Sirketi", price: 15.73, change: 0.00, changePercent: 0.00, volume: 0, high: 15.73, low: 15.73, open: 15.73, previousClose: 15.73 },
  { symbol: "MERKO", name: "Merko Gida Sanayi ve Ticaret A.S.", price: 16.59, change: 0.00, changePercent: 0.00, volume: 0, high: 16.59, low: 16.59, open: 16.59, previousClose: 16.59 },
  { symbol: "METRO", name: "Metro Ticari ve Mali Yatirimlar Holding A.S.", price: 5.24, change: 0.00, changePercent: 0.00, volume: 0, high: 5.24, low: 5.24, open: 5.24, previousClose: 5.24 },
  { symbol: "MEYSU", name: "Meysu Gida Sanayi Ve Ticaret A.S.", price: 14.49, change: 0.00, changePercent: 0.00, volume: 0, high: 14.49, low: 14.49, open: 14.49, previousClose: 14.49 },
  { symbol: "MHRGY", name: "MHR Gayrimenkul Yatirim Ortakligi Anonim Sirketi", price: 3.42, change: 0.00, changePercent: 0.00, volume: 0, high: 3.42, low: 3.42, open: 3.42, previousClose: 3.42 },
  { symbol: "MNDRS", name: "Menderes Tekstil Sanayi ve Ticaret Anonim Sirketi", price: 11.8, change: 0.00, changePercent: 0.00, volume: 0, high: 11.8, low: 11.8, open: 11.8, previousClose: 11.8 },
  { symbol: "MNDTR", name: "Mondi Turkey Oluklu Mukavva Kagit ve Ambalaj Sanayi A.S.", price: 5.62, change: 0.00, changePercent: 0.00, volume: 0, high: 5.62, low: 5.62, open: 5.62, previousClose: 5.62 },
  { symbol: "MOGAN", name: "Mogan Enerji Yatirim Holding", price: 13.5, change: 0.00, changePercent: 0.00, volume: 0, high: 13.5, low: 13.5, open: 13.5, previousClose: 13.5 },
  { symbol: "MOPAS", name: "Mopas Marketcilik Gida Sanayi Ve Ticaret A.S.", price: 39.62, change: 0.00, changePercent: 0.00, volume: 0, high: 39.62, low: 39.62, open: 39.62, previousClose: 39.62 },
  { symbol: "MRSHL", name: "Marshall Boya ve Vernik Sanayi A.S.", price: 1369, change: 0.00, changePercent: 0.00, volume: 0, high: 1369, low: 1369, open: 1369, previousClose: 1369 },
  { symbol: "MTRYO", name: "Metro Yatirim Ortakligi A.S.", price: 9.14, change: 0.00, changePercent: 0.00, volume: 0, high: 9.14, low: 9.14, open: 9.14, previousClose: 9.14 },
  { symbol: "NETCD", name: "Netcad Yazilim A.S.", price: 140.3, change: 0.00, changePercent: 0.00, volume: 0, high: 140.3, low: 140.3, open: 140.3, previousClose: 140.3 },
  { symbol: "NTGAZ", name: "Naturelgaz Sanayi Ve Ticaret A.S.", price: 11.85, change: 0.00, changePercent: 0.00, volume: 0, high: 11.85, low: 11.85, open: 11.85, previousClose: 11.85 },
  { symbol: "OFSYM", name: "Ofis Yem Gida Sanayi ve Ticaret A.S.", price: 60.4, change: 0.00, changePercent: 0.00, volume: 0, high: 60.4, low: 60.4, open: 60.4, previousClose: 60.4 },
  { symbol: "ORCAY", name: "ORCAY ORTAKOY CAY SANAYI VE TICARET A.S.", price: 3.24, change: 0.00, changePercent: 0.00, volume: 0, high: 3.24, low: 3.24, open: 3.24, previousClose: 3.24 },
  { symbol: "OSMEN", name: "Osmanli Yatirim Menkul Degerler a.s.", price: 7.05, change: 0.00, changePercent: 0.00, volume: 0, high: 7.05, low: 7.05, open: 7.05, previousClose: 7.05 },
  { symbol: "OSTIM", name: "Ostim Endustriyel Yatirimlar ve Isletme AS", price: 2.7, change: 0.00, changePercent: 0.00, volume: 0, high: 2.7, low: 2.7, open: 2.7, previousClose: 2.7 },
  { symbol: "OTTO", name: "Otto Holding A.S.", price: 324.5, change: 0.00, changePercent: 0.00, volume: 0, high: 324.5, low: 324.5, open: 324.5, previousClose: 324.5 },
  { symbol: "OYLUM", name: "Oylum Sinai Yatirimlar A.S.", price: 7.51, change: 0.00, changePercent: 0.00, volume: 0, high: 7.51, low: 7.51, open: 7.51, previousClose: 7.51 },
  { symbol: "OYYAT", name: "Oyak Yatirim Menkul Degerler A.S.", price: 51.9, change: 0.00, changePercent: 0.00, volume: 0, high: 51.9, low: 51.9, open: 51.9, previousClose: 51.9 },
  { symbol: "OZATD", name: "OZATA DENIZCILIK SANAYI VE TICARET AS", price: 226, change: 0.00, changePercent: 0.00, volume: 0, high: 226, low: 226, open: 226, previousClose: 226 },
  { symbol: "OZKGY", name: "Ozak Gayrimenkul Yatirim Ortakligi A.S.", price: 12.16, change: 0.00, changePercent: 0.00, volume: 0, high: 12.16, low: 12.16, open: 12.16, previousClose: 12.16 },
  { symbol: "OZRDN", name: "Ozerden Ambalaj Sanayi A.S.", price: 35.42, change: 0.00, changePercent: 0.00, volume: 0, high: 35.42, low: 35.42, open: 35.42, previousClose: 35.42 },
  { symbol: "OZSUB", name: "Ozsu Balik Uretim A.S.", price: 21.72, change: 0.00, changePercent: 0.00, volume: 0, high: 21.72, low: 21.72, open: 21.72, previousClose: 21.72 },
  { symbol: "OZYSR", name: "Ozyasar Tel ve Galvanizleme Sanayi Anonim Sirketi", price: 44.78, change: 0.00, changePercent: 0.00, volume: 0, high: 44.78, low: 44.78, open: 44.78, previousClose: 44.78 },
  { symbol: "PAGYO", name: "Panora Gayrimenkul Yatirim Ortakligi A.S.", price: 122.1, change: 0.00, changePercent: 0.00, volume: 0, high: 122.1, low: 122.1, open: 122.1, previousClose: 122.1 },
  { symbol: "PAHOL", name: "PASIFIK HOLDING A.S", price: 1.52, change: 0.00, changePercent: 0.00, volume: 0, high: 1.52, low: 1.52, open: 1.52, previousClose: 1.52 },
  { symbol: "PCILT", name: "PC Iletisim ve Medya Hizmetleri Sanayi Ticaret AS", price: 28.98, change: 0.00, changePercent: 0.00, volume: 0, high: 28.98, low: 28.98, open: 28.98, previousClose: 28.98 },
  { symbol: "PENTA", name: "Penta Teknoloji Urunleri Dagitim Ticaret AS", price: 12.97, change: 0.00, changePercent: 0.00, volume: 0, high: 12.97, low: 12.97, open: 12.97, previousClose: 12.97 },
  { symbol: "PETUN", name: "Pinar Entegre Et ve Un Sanayii Anonim Sirketi", price: 11.37, change: 0.00, changePercent: 0.00, volume: 0, high: 11.37, low: 11.37, open: 11.37, previousClose: 11.37 },
  { symbol: "PNSUT", name: "Pinar Sut Mamulleri Sanayii A.S.", price: 11.2, change: 0.00, changePercent: 0.00, volume: 0, high: 11.2, low: 11.2, open: 11.2, previousClose: 11.2 },
  { symbol: "PRKME", name: "Park Elektrik Üretim Madencilik Sanayi ve Ticaret A.S.", price: 18.07, change: 0.00, changePercent: 0.00, volume: 0, high: 18.07, low: 18.07, open: 18.07, previousClose: 18.07 },
  { symbol: "PSDTC", name: "Pergamon Status Dis Ticaret A.S.", price: 125.2, change: 0.00, changePercent: 0.00, volume: 0, high: 125.2, low: 125.2, open: 125.2, previousClose: 125.2 },
  { symbol: "PSGYO", name: "Pasifik Gayrimenkul Yatirim Ortakligi A.S.", price: 2.4, change: 0.00, changePercent: 0.00, volume: 0, high: 2.4, low: 2.4, open: 2.4, previousClose: 2.4 },
  { symbol: "QNBFK", name: "QNB Finansal Kiralama A.S.", price: 42.6, change: 0.00, changePercent: 0.00, volume: 0, high: 42.6, low: 42.6, open: 42.6, previousClose: 42.6 },
  { symbol: "QNBTR", name: "QNB Bank AS", price: 274.25, change: 0.00, changePercent: 0.00, volume: 0, high: 274.25, low: 274.25, open: 274.25, previousClose: 274.25 },
  { symbol: "RNPOL", name: "Rainbow Polikarbonat Sanayi Ticaret Anonim Sirketi", price: 2.38, change: 0.00, changePercent: 0.00, volume: 0, high: 2.38, low: 2.38, open: 2.38, previousClose: 2.38 },
  { symbol: "RODRG", name: "Rodrigo Tekstil Sanayi ve Ticaret AS", price: 19.79, change: 0.00, changePercent: 0.00, volume: 0, high: 19.79, low: 19.79, open: 19.79, previousClose: 19.79 },
  { symbol: "ROYAL", name: "Royal Hali Sanayi ve Ticaret A.S.", price: 6.8, change: 0.00, changePercent: 0.00, volume: 0, high: 6.8, low: 6.8, open: 6.8, previousClose: 6.8 },
  { symbol: "RUBNS", name: "Rubenis Tekstil Sanayi Ticaret AS", price: 45.08, change: 0.00, changePercent: 0.00, volume: 0, high: 45.08, low: 45.08, open: 45.08, previousClose: 45.08 },
  { symbol: "RUZYE", name: "Ruzy Madencilik Ve Enerji Yatirimlari Sanayi Ve Ticaret A.S.", price: 12.01, change: 0.00, changePercent: 0.00, volume: 0, high: 12.01, low: 12.01, open: 12.01, previousClose: 12.01 },
  { symbol: "SAFKR", name: "Safkar Ege Cooling Air Conditioning Cold Air Tes.Ihr.Ith.A.S", price: 27.2, change: 0.00, changePercent: 0.00, volume: 0, high: 27.2, low: 27.2, open: 27.2, previousClose: 27.2 },
  { symbol: "SEGMN", name: "Segmen Kardesler Gida Uretim ve Ambalaj Sanayi AS", price: 48.28, change: 0.00, changePercent: 0.00, volume: 0, high: 48.28, low: 48.28, open: 48.28, previousClose: 48.28 },
  { symbol: "SEGYO", name: "SEKER GAYRIMENKUL YATIRIM ORTAKLIGI A.S.", price: 4.44, change: 0.00, changePercent: 0.00, volume: 0, high: 4.44, low: 4.44, open: 4.44, previousClose: 4.44 },
  { symbol: "SEKFK", name: "Seker Finansal Kiralama A.S.", price: 10.69, change: 0.00, changePercent: 0.00, volume: 0, high: 10.69, low: 10.69, open: 10.69, previousClose: 10.69 },
  { symbol: "SEKUR", name: "Sekuro Plastik Ambalaj Sanayi A.S.", price: 7.3, change: 0.00, changePercent: 0.00, volume: 0, high: 7.3, low: 7.3, open: 7.3, previousClose: 7.3 },
  { symbol: "SELEC", name: "Selcuk Ecza Deposu Ticaret ve Sanayi A.S.", price: 80.3, change: 0.00, changePercent: 0.00, volume: 0, high: 80.3, low: 80.3, open: 80.3, previousClose: 80.3 },
  { symbol: "SERNT", name: "Seranit Granit Seramik Sanayi ve Ticaret A.S.", price: 8.7, change: 0.00, changePercent: 0.00, volume: 0, high: 8.7, low: 8.7, open: 8.7, previousClose: 8.7 },
  { symbol: "SILVR", name: "Silverline Endustri ve Ticaret A.S.", price: 2.62, change: 0.00, changePercent: 0.00, volume: 0, high: 2.62, low: 2.62, open: 2.62, previousClose: 2.62 },
  { symbol: "SKYLP", name: "Skyalp Finansal Teknolojiler ve Danismanlik A.S", price: 279.75, change: 0.00, changePercent: 0.00, volume: 0, high: 279.75, low: 279.75, open: 279.75, previousClose: 279.75 },
  { symbol: "SKYMD", name: "Seker Yatirim Menkul Degerler A.S.", price: 12.65, change: 0.00, changePercent: 0.00, volume: 0, high: 12.65, low: 12.65, open: 12.65, previousClose: 12.65 },
  { symbol: "SNICA", name: "Sanica Isi Sanayi A.S.", price: 3.87, change: 0.00, changePercent: 0.00, volume: 0, high: 3.87, low: 3.87, open: 3.87, previousClose: 3.87 },
  { symbol: "SNPAM", name: "Sonmez Pamuklu Sanayii A.S.", price: 21.26, change: 0.00, changePercent: 0.00, volume: 0, high: 21.26, low: 21.26, open: 21.26, previousClose: 21.26 },
  { symbol: "SOKE", name: "Soke Degirmencilik Sanayi ve Ticaret AS", price: 15.38, change: 0.00, changePercent: 0.00, volume: 0, high: 15.38, low: 15.38, open: 15.38, previousClose: 15.38 },
  { symbol: "SUMAS", name: "Sumas Suni Tahta ve Mobilya Sanayii AS", price: 258.75, change: 0.00, changePercent: 0.00, volume: 0, high: 258.75, low: 258.75, open: 258.75, previousClose: 258.75 },
  { symbol: "SUNTK", name: "Sun Tekstil Sanayi ve Ticaret A.S.", price: 33.96, change: 0.00, changePercent: 0.00, volume: 0, high: 33.96, low: 33.96, open: 33.96, previousClose: 33.96 },
  { symbol: "TABGD", name: "TAB Gida Sanayi ve Ticaret A.S.", price: 245.3, change: 0.00, changePercent: 0.00, volume: 0, high: 245.3, low: 245.3, open: 245.3, previousClose: 245.3 },
  { symbol: "TATEN", name: "Tatlipinar Enerji Uretim A.S.", price: 11.88, change: 0.00, changePercent: 0.00, volume: 0, high: 11.88, low: 11.88, open: 11.88, previousClose: 11.88 },
  { symbol: "TCKRC", name: "Kirac Galvaniz Telekominikasyon Metal Makine Insaat Elektrik Sanayi Ve Ticaret AS", price: 87.85, change: 0.00, changePercent: 0.00, volume: 0, high: 87.85, low: 87.85, open: 87.85, previousClose: 87.85 },
  { symbol: "TDGYO", name: "Trend Gayrimenkul Yatirim Ortakligi AS", price: 17.79, change: 0.00, changePercent: 0.00, volume: 0, high: 17.79, low: 17.79, open: 17.79, previousClose: 17.79 },
  { symbol: "TEHOL", name: "Tera Yatirim Teknoloji Holding A.S.", price: 16.82, change: 0.00, changePercent: 0.00, volume: 0, high: 16.82, low: 16.82, open: 16.82, previousClose: 16.82 },
  { symbol: "TEKTU", name: "Tek-Art Insaat Ticaret Turizm Sanayi ve Yatirimlar Anonim Sirketi", price: 9.54, change: 0.00, changePercent: 0.00, volume: 0, high: 9.54, low: 9.54, open: 9.54, previousClose: 9.54 },
  { symbol: "TERA", name: "Tera Yatirim Menkul Degerler AS", price: 344.75, change: 0.00, changePercent: 0.00, volume: 0, high: 344.75, low: 344.75, open: 344.75, previousClose: 344.75 },
  { symbol: "TGSAS", name: "TGS Dis Ticaret AS", price: 161.8, change: 0.00, changePercent: 0.00, volume: 0, high: 161.8, low: 161.8, open: 161.8, previousClose: 161.8 },
  { symbol: "TMPOL", name: "Temapol Polimer Plastik ve Insaat Sanayi Ticaret Anonim Sirketi", price: 571.5, change: 0.00, changePercent: 0.00, volume: 0, high: 571.5, low: 571.5, open: 571.5, previousClose: 571.5 },
  { symbol: "TMSN", name: "Tümosan Motor ve Traktör Sanayi A.S.", price: 100.9, change: 0.00, changePercent: 0.00, volume: 0, high: 100.9, low: 100.9, open: 100.9, previousClose: 100.9 },
  { symbol: "TNZTP", name: "TAPDI OKSIJEN OZEL SAGLIK VE EGITIM HIZMETLERI SANAYI TICARET A.S.", price: 21.78, change: 0.00, changePercent: 0.00, volume: 0, high: 21.78, low: 21.78, open: 21.78, previousClose: 21.78 },
  { symbol: "TRALT", name: "Turk Altin Isletmeleri A.S.", price: 43.4, change: 0.00, changePercent: 0.00, volume: 0, high: 43.4, low: 43.4, open: 43.4, previousClose: 43.4 },
  { symbol: "TRENJ", name: "TR Dogal Enerji Kaynaklari Arastirma ve Uretim Anonim Sirketi", price: 94.2, change: 0.00, changePercent: 0.00, volume: 0, high: 94.2, low: 94.2, open: 94.2, previousClose: 94.2 },
  { symbol: "TRMET", name: "TR Anadolu Metal Madencilik Isletmeleri Anonim Sirketi", price: 122.9, change: 0.00, changePercent: 0.00, volume: 0, high: 122.9, low: 122.9, open: 122.9, previousClose: 122.9 },
  { symbol: "TSGYO", name: "TSKB Gayrimenkul Yatirim Ortakligi A.S.", price: 6.52, change: 0.00, changePercent: 0.00, volume: 0, high: 6.52, low: 6.52, open: 6.52, previousClose: 6.52 },
  { symbol: "TSPOR", name: "Trabzonspor Sportif Yatirim ve Futbol Isletmeciligi Ticaret A.S.", price: 0.94, change: 0.00, changePercent: 0.00, volume: 0, high: 0.94, low: 0.94, open: 0.94, previousClose: 0.94 },
  { symbol: "TUCLK", name: "Tugcelik Aluminyum ve Metal Mamulleri Sanayi ve Ticaret A.S.", price: 4.16, change: 0.00, changePercent: 0.00, volume: 0, high: 4.16, low: 4.16, open: 4.16, previousClose: 4.16 },
  { symbol: "TUREX", name: "TUREKS TURIZM TASIMACILIK A.S.", price: 7.98, change: 0.00, changePercent: 0.00, volume: 0, high: 7.98, low: 7.98, open: 7.98, previousClose: 7.98 },
  { symbol: "UFUK", name: "Ufuk Yatirim Yonetim Ve Gayrimenkul A.S.", price: 1564, change: 0.00, changePercent: 0.00, volume: 0, high: 1564, low: 1564, open: 1564, previousClose: 1564 },
  { symbol: "ULUSE", name: "Ulusoy Elektrik Imalat Taahhut ve Ticaret AS", price: 159.2, change: 0.00, changePercent: 0.00, volume: 0, high: 159.2, low: 159.2, open: 159.2, previousClose: 159.2 },
  { symbol: "USAK", name: "Usak Seramik Sanayi A.S.", price: 1.61, change: 0.00, changePercent: 0.00, volume: 0, high: 1.61, low: 1.61, open: 1.61, previousClose: 1.61 },
  { symbol: "VAKFA", name: "Vakif Faktoring A.S.", price: 12.18, change: 0.00, changePercent: 0.00, volume: 0, high: 12.18, low: 12.18, open: 12.18, previousClose: 12.18 },
  { symbol: "VANGD", name: "Vanet Gida Sanayi Iç Ve Dis Ticaret Anonim Sirketi", price: 70.55, change: 0.00, changePercent: 0.00, volume: 0, high: 70.55, low: 70.55, open: 70.55, previousClose: 70.55 },
  { symbol: "VBTYZ", name: "VBT Yazilim AS", price: 19.74, change: 0.00, changePercent: 0.00, volume: 0, high: 19.74, low: 19.74, open: 19.74, previousClose: 19.74 },
  { symbol: "VERTU", name: "Verusaturk Girisim Anonim Sirketi", price: 39.5, change: 0.00, changePercent: 0.00, volume: 0, high: 39.5, low: 39.5, open: 39.5, previousClose: 39.5 },
  { symbol: "VERUS", name: "Verusa Holding AS", price: 463.75, change: 0.00, changePercent: 0.00, volume: 0, high: 463.75, low: 463.75, open: 463.75, previousClose: 463.75 },
  { symbol: "VKFYO", name: "Vakif Menkul Kiymet Yatirim Ortakligi A.S.", price: 32.1, change: 0.00, changePercent: 0.00, volume: 0, high: 32.1, low: 32.1, open: 32.1, previousClose: 32.1 },
  { symbol: "VKING", name: "Viking Kagit ve Seluloz A.S.", price: 25.92, change: 0.00, changePercent: 0.00, volume: 0, high: 25.92, low: 25.92, open: 25.92, previousClose: 25.92 },
  { symbol: "YAYLA", name: "Yayla Enerji Üretim Turizm ve Insaat Ticaret A.S.", price: 22.8, change: 0.00, changePercent: 0.00, volume: 0, high: 22.8, low: 22.8, open: 22.8, previousClose: 22.8 },
  { symbol: "YEOTK", name: "YEO Teknoloji Enerji ve Endustri A.S.", price: 54.3, change: 0.00, changePercent: 0.00, volume: 0, high: 54.3, low: 54.3, open: 54.3, previousClose: 54.3 },
  { symbol: "YGGYO", name: "Yeni Gimat Gayrimenkul Yatirim Ortakligi A.S.", price: 208, change: 0.00, changePercent: 0.00, volume: 0, high: 208, low: 208, open: 208, previousClose: 208 },
  { symbol: "YIGIT", name: "Yigit Aku Malzemeleri Nakliyat Turizm Insaat Sanayi Ve Ticaret", price: 23.62, change: 0.00, changePercent: 0.00, volume: 0, high: 23.62, low: 23.62, open: 23.62, previousClose: 23.62 },
  { symbol: "YONGA", name: "Yonga Mobilya SANAYI ve TICARET AS", price: 53.5, change: 0.00, changePercent: 0.00, volume: 0, high: 53.5, low: 53.5, open: 53.5, previousClose: 53.5 },
  { symbol: "YYAPI", name: "Yesil Yapi Endustrisi A.S.", price: 0.99, change: 0.00, changePercent: 0.00, volume: 0, high: 0.99, low: 0.99, open: 0.99, previousClose: 0.99 },
  { symbol: "ZEDUR", name: "Zedur Enerji ElekTrik Uretim A.S.", price: 8.36, change: 0.00, changePercent: 0.00, volume: 0, high: 8.36, low: 8.36, open: 8.36, previousClose: 8.36 },
  { symbol: "ZERGY", name: "Zeray Gayrimenkul Yatirim Ortakligi AS", price: 20.06, change: 0.00, changePercent: 0.00, volume: 0, high: 20.06, low: 20.06, open: 20.06, previousClose: 20.06 },
  { symbol: "ZGYO", name: "Z Gayrimenkul Yatirim Ortakligi A.S.", price: 27.7, change: 0.00, changePercent: 0.00, volume: 0, high: 27.7, low: 27.7, open: 27.7, previousClose: 27.7 },
  // XU100 index
  { symbol: "XU100", name: "BIST 100 Index", price: 13076.78, change: -208.88, changePercent: -1.57, volume: 7165200000, high: 13290.00, low: 13020.00, open: 13285.66, previousClose: 13285.66 },
];

// ── Live Price Cache ────────────────────────────────────────────────────────

const liveCache = new Map<string, StockData>();
let lastFetchTime = 0;
let fetchInProgress = false;
let initialized = false;

// Dynamic stock registry – loaded from DB and updated by discovery
const stockRegistry = new Map<string, { symbol: string; name: string }>();

function isMarketOpen(): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    hour: "numeric", minute: "numeric", hour12: false, weekday: "short",
  }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")?.value;
  const hour = Number(parts.find(p => p.type === "hour")?.value || 0);
  const minute = Number(parts.find(p => p.type === "minute")?.value || 0);
  if (!weekday || ["Sat", "Sun"].includes(weekday)) return false;
  const timeInMinutes = hour * 60 + minute;
  return timeInMinutes >= 580 && timeInMinutes < 1100; // 09:40 - 18:20 Istanbul
}

async function fetchBatch(symbols: string[]): Promise<void> {
  const yahooSymbols = symbols.map(s => s === "XU100" ? "XU100.IS" : `${s}.IS`);
  try {
    const quotes = await yf.quote(yahooSymbols, {}, { validateResult: false });
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    let updated = 0;
    for (const q of arr) {
      if (!q || !q.symbol || !q.regularMarketPrice) continue;
      const bist = q.symbol.replace(".IS", "");
      const reg = stockRegistry.get(bist);
      const name = reg?.name || q.longName || q.shortName || bist;

      // Auto-register stocks returned by Yahoo with TRY currency
      if (!reg && q.currency === "TRY") {
        stockRegistry.set(bist, { symbol: bist, name });
        // Persist to DB silently
        db.insert(bistStocksTable)
          .values({ symbol: bist, name, isAutoDiscovered: true, lastSeen: new Date() })
          .onConflictDoUpdate({ target: bistStocksTable.symbol, set: { lastSeen: new Date() } })
          .catch(() => {});
      }
      if (!stockRegistry.has(bist)) continue;

      const price = q.regularMarketPrice;
      const prevClose = q.regularMarketPreviousClose ?? price;
      const change = q.regularMarketChange ?? (price - prevClose);
      const changePct = q.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);
      liveCache.set(bist, {
        symbol: bist,
        name,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePct * 100) / 100,
        volume: q.regularMarketVolume ?? 0,
        high: Math.round((q.regularMarketDayHigh ?? price) * 100) / 100,
        low: Math.round((q.regularMarketDayLow ?? price) * 100) / 100,
        open: Math.round((q.regularMarketOpen ?? price) * 100) / 100,
        previousClose: Math.round(prevClose * 100) / 100,
      });
      updated++;
    }
    if (updated > 0) console.log(`[stocks] Batch: ${updated} prices updated (total live: ${liveCache.size})`);
  } catch (err: any) {
    console.error(`[stocks] Batch fetch error:`, err?.message?.slice(0, 80));
  }
}

/** Fetch ALL Turkey stocks from TradingView scanner and update liveCache for given symbols */
let tvAllCache: Map<string, { price: number; changePct: number; changeAbs: number; volume: number; high: number; low: number; open: number; prevClose: number }> = new Map();
let tvLastFetch = 0;

async function refreshTradingViewAll(): Promise<void> {
  try {
    const resp = await fetch("https://scanner.tradingview.com/turkey/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.tradingview.com",
        "Referer": "https://www.tradingview.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        filter: [{ left: "type", operation: "equal", right: "stock" }],
        options: { lang: "en" },
        markets: ["turkey"],
        symbols: { query: { types: [] }, tickers: [] },
        columns: ["name", "close", "change", "change_abs", "volume", "high", "low", "open", "close[1]"],
        sort: { sortBy: "name", sortOrder: "asc" },
        range: [0, 700],
      }),
    });
    if (!resp.ok) { console.error(`[stocks] TradingView scan HTTP ${resp.status}`); return; }
    const d = await resp.json() as { totalCount: number; data: Array<{ s: string; d: any[] }> };
    tvAllCache.clear();
    for (const item of d.data ?? []) {
      const sym = item.s.replace("BIST:", "");
      // columns: name, close, change(%), change_abs, volume, high, low, open, close[1]
      const [_n, close, changePct, changeAbs, volume, high, low, open, prevClose] = item.d;
      if (close && close > 0) {
        tvAllCache.set(sym, { price: close, changePct: changePct ?? 0, changeAbs: changeAbs ?? 0, volume: volume ?? 0, high: high ?? close, low: low ?? close, open: open ?? close, prevClose: prevClose ?? close });
      }
    }
    tvLastFetch = Date.now();
    console.log(`[stocks] TradingView cache refreshed: ${tvAllCache.size} stocks`);
  } catch (err: any) {
    console.error(`[stocks] TradingView cache error:`, err?.message?.slice(0, 80));
  }
}

async function fetchFromTradingView(symbols: string[]): Promise<void> {
  if (symbols.length === 0) return;
  // Refresh TV cache if stale (>5 min)
  if (Date.now() - tvLastFetch > 5 * 60 * 1000) await refreshTradingViewAll();
  let updated = 0;
  for (const sym of symbols) {
    const tv = tvAllCache.get(sym);
    if (!tv) continue;
    const reg = stockRegistry.get(sym);
    if (!reg) continue;
    const price = Math.round(tv.price * 100) / 100;
    liveCache.set(sym, {
      symbol: sym,
      name: reg.name,
      price,
      change: Math.round(tv.changeAbs * 100) / 100,
      changePercent: Math.round(tv.changePct * 100) / 100,
      volume: tv.volume,
      high: Math.round(tv.high * 100) / 100,
      low: Math.round(tv.low * 100) / 100,
      open: Math.round(tv.open * 100) / 100,
      previousClose: Math.round(tv.prevClose * 100) / 100,
    });
    updated++;
  }
  if (updated > 0) console.log(`[stocks] TradingView fallback: ${updated}/${symbols.length} prices applied`);
  else console.log(`[stocks] TradingView: no prices found for ${symbols.length} symbols`);
}

async function refreshAllPrices(): Promise<void> {
  if (fetchInProgress || !initialized) return;
  fetchInProgress = true;
  try {
    const allSymbols = [...stockRegistry.keys()].filter(s => !["XAUTRYG","XAGTRYG","BRENTOIL","WTIOIL"].includes(s));
    const BATCH = 80;
    for (let i = 0; i < allSymbols.length; i += BATCH) {
      await fetchBatch(allSymbols.slice(i, i + BATCH));
      if (i + BATCH < allSymbols.length) await new Promise(r => setTimeout(r, 300));
    }
    // TradingView fallback: symbols still not in liveCache after Yahoo pass
    const missingFromYahoo = allSymbols.filter(s => !liveCache.has(s));
    if (missingFromYahoo.length > 0) {
      console.log(`[stocks] ${missingFromYahoo.length} symbols not on Yahoo, trying TradingView...`);
      const TV_BATCH = 200;
      for (let i = 0; i < missingFromYahoo.length; i += TV_BATCH) {
        await fetchFromTradingView(missingFromYahoo.slice(i, i + TV_BATCH));
        if (i + TV_BATCH < missingFromYahoo.length) await new Promise(r => setTimeout(r, 400));
      }
    }
    // DB price fallback: symbols still not in liveCache after Yahoo + TV (e.g. CONSE)
    const stillMissing = allSymbols.filter(s => !liveCache.has(s));
    if (stillMissing.length > 0) {
      try {
        const { loadStocksWithPricesFromDb } = await import("./stockDiscovery.js");
        const dbRows = await loadStocksWithPricesFromDb();
        const dbPriceMap = new Map(dbRows.filter(r => r.lastPrice && r.lastPrice > 0).map(r => [r.symbol, r]));
        let dbFallbackCount = 0;
        for (const sym of stillMissing) {
          const row = dbPriceMap.get(sym);
          if (!row || !row.lastPrice) continue;
          const reg = stockRegistry.get(sym);
          if (!reg) continue;
          liveCache.set(sym, {
            symbol: sym,
            name: reg.name,
            price: row.lastPrice,
            change: 0,
            changePercent: 0,
            volume: 0,
            high: row.lastPrice,
            low: row.lastPrice,
            open: row.lastPrice,
            previousClose: row.lastPrice,
          });
          dbFallbackCount++;
        }
        if (dbFallbackCount > 0) console.log(`[stocks] DB price fallback: ${dbFallbackCount} stocks (e.g. CONSE)`);
      } catch (e: any) {
        console.error("[stocks] DB price fallback error:", e?.message?.slice(0, 80));
      }
    }
    lastFetchTime = Date.now();
  } finally {
    fetchInProgress = false;
  }
}

/** Immediately fetch prices for specific symbols and add to liveCache */
export async function fetchSymbolsNow(symbols: string[]): Promise<void> {
  await fetchBatch(symbols);
}

/** Reload registry from DB (called after discovery updates) */
export async function reloadRegistry(): Promise<void> {
  try {
    const { loadStocksFromDb } = await import("./stockDiscovery.js");
    const stocks = await loadStocksFromDb();
    for (const s of stocks) stockRegistry.set(s.symbol, s);
    console.log(`[stocks] Registry reloaded: ${stockRegistry.size} stocks`);
  } catch (e: any) {
    console.error("[stocks] Registry reload failed:", e?.message?.slice(0, 80));
  }
}

/**
 * Manually curated stock name overrides.
 * These names always win over Yahoo Finance or any other external source.
 * Add entries here whenever a stock name needs to be permanently fixed.
 */
const STOCK_NAME_OVERRIDES: Record<string, string> = {
  BAHKM: "Bahadir Kimya Sanayi ve Ticaret A.S.",
};

/** Apply name overrides to in-memory registry, bist_stocks table, and existing orders */
async function applyNameOverrides(): Promise<void> {
  for (const [symbol, name] of Object.entries(STOCK_NAME_OVERRIDES)) {
    stockRegistry.set(symbol, { symbol, name });
    try {
      await db.update(bistStocksTable)
        .set({ name })
        .where(eq(bistStocksTable.symbol, symbol));
    } catch { /* ignore if table not ready yet */ }
    try {
      await db.update(ordersTable)
        .set({ stockName: name })
        .where(eq(ordersTable.symbol, symbol));
    } catch { /* ignore if table not ready yet */ }
  }
  if (Object.keys(STOCK_NAME_OVERRIDES).length > 0) {
    console.log(`[stocks] Applied ${Object.keys(STOCK_NAME_OVERRIDES).length} name override(s) to registry, stocks table & orders`);
  }
}

/** Bootstrap: seed BASE_STOCKS into DB (always upsert new ones), then load from DB, then start discovery */
async function initStockSystem(): Promise<void> {
  try {
    // 1. Always upsert BASE_STOCKS into DB (onConflictDoNothing keeps existing names)
    const { loadStocksFromDb, runFullDiscovery, runLightDiscovery } = await import("./stockDiscovery.js");
    console.log("[stocks] Upserting BASE_STOCKS into DB...");
    for (const s of BASE_STOCKS) {
      await db.insert(bistStocksTable)
        .values({ symbol: s.symbol, name: s.name })
        .onConflictDoNothing()
        .catch(() => {});
    }

    // 2. Load from DB into registry
    const dbStocks = await loadStocksFromDb();
    for (const s of (dbStocks.length > 0 ? dbStocks : BASE_STOCKS.map(s => ({ symbol: s.symbol, name: s.name })))) {
      stockRegistry.set(s.symbol, s);
    }
    // Apply manual overrides immediately after loading
    await applyNameOverrides();
    console.log(`[stocks] Registry initialized: ${stockRegistry.size} stocks`);
    initialized = true;

    // 3. Initial price fetch
    await refreshAllPrices();

    // 4. Run full discovery in background (finds all 650+ stocks)
    setTimeout(async () => {
      await runFullDiscovery();
      await reloadRegistry();
      // Re-apply overrides after discovery (in case Yahoo overwrote anything)
      await applyNameOverrides();
      await refreshAllPrices();
    }, 5_000);

    // 5. Nightly light discovery for new IPOs (runs every 24h)
    setInterval(async () => {
      await runLightDiscovery();
      await reloadRegistry();
      await applyNameOverrides();
    }, 24 * 60 * 60 * 1000);

  } catch (err: any) {
    console.error("[stocks] Init error:", err?.message?.slice(0, 80));
    // Fallback to BASE_STOCKS
    for (const s of BASE_STOCKS) stockRegistry.set(s.symbol, s);
    initialized = true;
    refreshAllPrices().catch(console.error);
  }
}

// ── Değerli Metaller + Petrol (XAUTRYG / XAGTRYG / BRENTOIL / WTIOIL) ───────
// Fiyatlar USD cinsindendir (kaldıraçlı hesaplarda bakiye de USD olarak tutulur)
// Yahoo Finance: GC=F (Altın), SI=F (Gümüş), BZ=F (Brent), CL=F (WTI)
const METAL_SYMBOLS: { symbol: string; name: string; yahooFutures: string }[] = [
  { symbol: "XAUTRYG",  name: "Ons Altın",    yahooFutures: "GC=F" },
  { symbol: "XAGTRYG",  name: "Ons Gümüş",   yahooFutures: "SI=F" },
  { symbol: "BRENTOIL", name: "Brent Petrol", yahooFutures: "BZ=F" },
  { symbol: "WTIOIL",   name: "WTI Petrol",   yahooFutures: "CL=F" },
];

async function fetchMetalPrices(): Promise<void> {
  try {
    const symbols = METAL_SYMBOLS.map(m => m.yahooFutures);
    const quotes = await yf.quote(symbols, {}, { validateResult: false });
    const arr = Array.isArray(quotes) ? quotes : [quotes];

    for (const metal of METAL_SYMBOLS) {
      const q = arr.find((x: any) => x.symbol === metal.yahooFutures);
      if (!q?.regularMarketPrice) continue;
      const price = Math.round(q.regularMarketPrice * 100) / 100;
      const prevPrice = q.regularMarketPreviousClose ?? price;
      const change = Math.round((price - prevPrice) * 100) / 100;
      const changePct = prevPrice > 0 ? Math.round((change / prevPrice) * 10000) / 100 : 0;
      liveCache.set(metal.symbol, {
        symbol: metal.symbol,
        name: metal.name,
        price,
        change,
        changePercent: changePct,
        volume: q.regularMarketVolume ?? 0,
        high: Math.round((q.regularMarketDayHigh ?? price) * 100) / 100,
        low: Math.round((q.regularMarketDayLow ?? price) * 100) / 100,
        open: Math.round((q.regularMarketOpen ?? price) * 100) / 100,
        previousClose: Math.round(prevPrice * 100) / 100,
      });
    }
    console.log(`[metals/USD] XAUTRYG=${liveCache.get("XAUTRYG")?.price}, XAGTRYG=${liveCache.get("XAGTRYG")?.price}, BRENTOIL=${liveCache.get("BRENTOIL")?.price}, WTIOIL=${liveCache.get("WTIOIL")?.price}`);
  } catch (err: any) {
    console.error("[metals] Fetch error:", err?.message?.slice(0, 80));
  }
}

// Register metal symbols in registry
for (const m of METAL_SYMBOLS) {
  stockRegistry.set(m.symbol, { symbol: m.symbol, name: m.name });
}

// Start the system
initStockSystem().catch(console.error);

// Periodic price refresh
setInterval(() => {
  const interval = isMarketOpen() ? 30_000 : 300_000; // 30s open, 5min closed
  if (initialized && Date.now() - lastFetchTime >= interval) {
    refreshAllPrices().catch(console.error);
  }
}, 15_000);

// Metal prices: every 30 seconds (always on, 24/7 market)
fetchMetalPrices().catch(console.error);
setInterval(() => fetchMetalPrices().catch(console.error), 30_000);

// ── Public API ───────────────────────────────────────────────────────────────

export function getStocks(): StockData[] {
  const result: StockData[] = [];
  for (const [symbol, reg] of stockRegistry) {
    const cached = liveCache.get(symbol);
    if (cached && cached.price > 0) {
      result.push(cached);
    } else {
      // Fallback to BASE_STOCKS only if it has a valid price
      const base = BASE_STOCKS.find(s => s.symbol === symbol);
      if (base && base.price > 0) result.push(base);
      // If neither live nor base has a price, skip — do not show 0-priced stocks
    }
  }
  return result;
}

export function getStock(symbol: string): StockData | undefined {
  return liveCache.get(symbol) ?? BASE_STOCKS.find(s => s.symbol === symbol);
}

/** Returns only the live Yahoo Finance price — never falls back to static BASE_STOCKS.
 *  Use this for P&L calculation: if null, the live price isn't ready yet. */
export function getLivePrice(symbol: string): number | null {
  const cached = liveCache.get(symbol);
  return (cached && cached.price > 0) ? cached.price : null;
}

export function getStockName(symbol: string): string {
  return stockRegistry.get(symbol)?.name || symbol;
}

export function getLiveCacheSize(): number {
  return liveCache.size;
}

export function getLastFetchTime(): number {
  return lastFetchTime;
}

export function getRegistrySize(): number {
  return stockRegistry.size;
}

const chartCache = new Map<string, { data: any[]; expiresAt: number }>();

export async function getStockChart(symbol: string, range: string): Promise<any[]> {
  const cacheKey = `${symbol}:${range}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const now = new Date();
  let interval: string;
  let period1: Date;
  let ttl: number;

  switch (range) {
    case "1d":  interval = "5m";  period1 = new Date(now.getTime() - 2 * 86400_000); ttl = 2 * 60_000; break;
    case "5d":  interval = "60m"; period1 = new Date(now.getTime() - 5 * 86400_000); ttl = 5 * 60_000; break;
    case "1mo": interval = "1d";  period1 = new Date(now.getTime() - 30 * 86400_000); ttl = 15 * 60_000; break;
    case "3mo": interval = "1d";  period1 = new Date(now.getTime() - 90 * 86400_000); ttl = 15 * 60_000; break;
    default:    interval = "1d";  period1 = new Date(now.getTime() - 30 * 86400_000); ttl = 15 * 60_000;
  }

  const METAL_YAHOO_MAP: Record<string, string> = {
    XAUTRYG: "GC=F",
    XAGTRYG: "SI=F",
    BRENTOIL: "BZ=F",
    WTIOIL: "CL=F",
  };
  const sym = symbol.toUpperCase();
  const yahooSymbol = METAL_YAHOO_MAP[sym] ?? (sym === "XU100" ? "XU100.IS" : `${sym}.IS`);
  try {
    const result = await yf.chart(yahooSymbol, { period1, interval } as any, { validateResult: false });
    const data = ((result as any).quotes || [])
      .map((q: any) => ({
        t: q.date instanceof Date ? q.date.getTime() : new Date(q.date).getTime(),
        c: q.close,
        o: q.open,
        h: q.high,
        l: q.low,
        v: q.volume,
      }))
      .filter((q: any) => q.c != null && !isNaN(q.c));
    chartCache.set(cacheKey, { data, expiresAt: Date.now() + ttl });
    return data;
  } catch {
    return chartCache.get(cacheKey)?.data || [];
  }
}
