/**
 * BIST Stock Auto-Discovery Service
 *
 * Automatically finds all BIST-listed stocks including new IPOs by:
 * 1. Probing a comprehensive list of known/potential BIST symbols via Yahoo Finance
 * 2. Persisting discovered stocks to the database
 * 3. Running nightly to auto-add new IPOs
 */
import _yfImport from "yahoo-finance2";
type YFType = typeof _yfImport;
const _raw = _yfImport as any;
const _YFClass = _raw?.default?.prototype?.quote ? _raw.default : _raw?.prototype?.quote ? _raw : _raw?.default;
const yf: YFType = new _YFClass() as YFType;
import { db, bistStocksTable } from "@workspace/db";
import { eq } from "drizzle-orm";


// ── Comprehensive seed of known BIST symbols ─────────────────────────────────
// Broad list — invalid tickers are silently ignored by Yahoo Finance
export const KNOWN_BIST_SYMBOLS: string[] = [
  // Blue chips & BIST100
  "AKBNK","ARCLK","ASELS","BIMAS","EKGYO","ENKAI","EREGL","FROTO","GARAN",
  "HALKB","ISCTR","KCHOL","KOZAL","PETKM","PGSUS","SAHOL","SASA","SISE",
  "TCELL","THYAO","TKFEN","TOASO","TSKB","TTKOM","TTRAK","TUPRS","TURGG",
  "ULKER","VAKBN","VESTL","YKBNK","AKGRT","ANHYT","ANSGR","AEFES","CCOLA",
  "AGHOL","AKSA","ASUZU","ATEKS","AYGAZ","BIOEN","BIZIM","BRISA","BUCIM",
  "CIMSA","CLEBI","DOAS","ECILC","EGPRO","EMKEL","EMPAE","GLYHO",
  "GOODY","GOZDE","GUBRF","GWIND","HEKTS","ICBCT","IMASM","JANTS",
  "KAREL","KCAER","KERVT","LOGO","MARTI","MAVI","MGROS","NUHCM","ODAS",
  "ORGE","OTKAR","PARSN","PKART","POLHO","SDTTR","SELGD","SEYKM","SODA",
  "TATGD","TBORG","TRCAS","TRGYO","TRKCM","TUKAS","UYUM","YYLGD",
  // Banks & financials
  "ALBRK","ALKLC","FINBN","GARFA","GEDIK","GEDZA","GLBMD","GLRYH","GSDDE",
  "GSDHO","ISYAT","ISFIN","ISGSY","ISGYO","ISMEN","KLGYO","KLNMA","KLRHO",
  "KLSYN","KFEIN","LIDER","LIDFA","MEKAG","MRGYO","MSGYO","OBASE","QNBFB",
  "RTALB","RYSAS","RYSGYO","TGBL","VAKFN","VBTS","VKGYO","YGYO",
  // Real estate (GYO)
  "ADGYO","AGYO","AKSGY","AVGYO","BRYAT","DGGYO","DZGYO","EYGYO","KRGYO",
  "MPARK","NUGYO","OYAYO","PRZMA","RYGYO","SRVGY","VRGYO","ZRGYO","SASE",
  // Energy & utilities
  "AKENR","AKFGY","AKFYE","AKSEN","AYEN","AYCES","EUPWR","KAPLM",
  "KONTR","ONRYT","SURGY","ZOREN","LRSHO","NATEN","ANEL","ANELE",
  "DAPGM","EGGUB","EGSER","ONCSM","ORMA","EPLAS",
  // Industrials & manufacturing
  "A1CAP","ACSEL","AFYON","AHGAZ","AHSGY","AKCNS","AKFGY","AKMGY","AKYHO",
  "ALCAR","ALKIM","ARDYZ","ARENA","ARSAN","ASTOR","AVGYO","AZTEK",
  "BAGFS","BAKAB","BANVT","BERA","BFREN","BJKAS","BMELK","BMEKS","BMSTL","BNTAS",
  "BORLS","BOYNR","BRMEN","BRSAN","BSOKE","BTCIM","BURCE","BURVA",
  "CANTE","CEMAS","CEMTS","CNKR","CUSAN","DAGHL","DAGI","DATA","DENGE",
  "DERHL","DESPC","DEVA","DGATE","DMSAS","DNISI","DOCO","DOGUB","DURDO",
  "DYOBY","ECZYT","EDIP","EFOR","EFORC","EGEEN","ENSRI",
  "ERBOS","ERCB","ERDMR","ERSU","ESAS","ESCAR","ETYAT","FADE",
  "FENER","FRNSA","GENKM","GEREL","GLBMD","GMSTR","GOLTS","GOODY","GRSEL",
  "GSRAY","HATEK","HDFGS","HILAL","HUNER","HURGZ","IDAS","IHEVA","IHLAS",
  "IHLGM","IHSAG","INDES","INTEM","INVEO","IPEKE","IZOCM","IZMDC",
  "KAPLM","KARFA","KARTON","KARSN","KATMR","KAYSE","KBORU","KENT",
  "KIMMR","KMPRO","KMPUR","KNFRT","KONKA","KONYA","KOPOL","KOZAA","KRDMD",
  "KRPLS","KTLEV","KUYAS","LMKDC","LUKSK","MAALT","MACKO","MAGEN",
  "MANAS","MEGAP","MIATK","MIPAZ","MTRKS","MZHLD","NCTS","NETAS","NIBAS",
  "NTTUR","NURO","OBAMS","OLVIP","ORTEN","PAMEL","PAPIL","PEHOL","PINSU",
  "PNLSN","POLTK","PRDGS","QUAGR","RALYH","RHEAG","SAMAT","SAMTS","SANFM",
  "SANKO","SAYAS","SELVA","SIGDE","SKTAS","SMART","SMRTG","SNKRN","SODSN",
  "SOKM","SONME","SUWEN","TARKM","TEZOL","ULUUN","UNLU","UMPAS",
  "VAKKO","YAPRK","YATAS","YBTAS","YESIL","YKSLN","YUNSA",
  // Retail & consumer
  "ADESE","DOCO","GOLTS","GOODY","SELVA","TUKAS","YYLGD",
  // Tech & telecom
  "ALRDN","ARDYZ","KAREL","LOGO","NETAS","SMART","SMRTG",
  // Holding companies
  "AGROT","AKYHO","ALARK","ATAKP","ATATP","ATSYH","DYHOL","ECILC",
  "ECOGR","EUHOL","EYHOL","FLAP","FMIZP","IHGZT","KCHOL","KOZAA",
  "PEHOL","TURSG",
  // Media & entertainment
  "BJKAS","DSTKF","GSRAY","IHLAS","IHSAG","MZHLD",
  // Healthcare & pharma
  "DEVA","ECZYT","HEKTS",
  // Transportation & logistics
  "ASUZU","CLEBI","DOAS","FROTO","OTKAR","PGSUS","THYAO","TOASO","TTRAK",
  "UCAK","ULUUN","RYSAS",
  // Newer IPOs (2020-2026)
  "AGSTS","AMBR","AMNTA","APFIN","AVEN","AYES","AYCES","BAFRA",
  "BALTAS","BARMA","BASGZ","BAYRK","BINNJ","BKFIN","BRLSM",
  "CMBTN","COELKR","COSMO","CRDFA","CRFSA","CUSAN","DGKLB",
  "DIABO","DITAS","DJIST","DMRGD","EFORC","ENSRI",
  "ETILR","EUPWR","GRSEL","HUNER","IDAS","INDES",
  "INTEM","INVEO","IZOCM","KGYO","KMPRO","KNFRT",
  "KONKA","KOPOL","KRPLS","KTLEV","KUYAS","LIDFA","LMKDC","LUKSK",
  "MANAS","MEKAG","MEKSA","MRGYO","MTRKS","NATEN","NIBAS","NURO",
  "OBAMS","OBASE","ODINE","OLVIP","ONRYT","ORTEN","OYAYO","PASEU",
  "PENGD","PRDGS","QUAGR","RALYH","RHEAG","RTALB","RYSGYO","SAMAT",
  "SAMTS","SANFM","SASE","SMRTG","SNKRN","SODSN","SONME","SRVGY",
  "SURGY","TARKM","UCAK","UNLU","UMPAS","VAKFN","VAKKO","VBTS",
  "VKGYO","VRGYO","YAPRK","YBTAS","YESIL","YKSLN","YUNSA","XU100",
  // Eksik / gözden kaçan semboller
  "GUNDG","GUNDZ","GLBMD","GLRYH","GEDIK","GEDZA","GOZDE","ODINE","PASEU",
  "PENGD","DMRGD","ETILR","AGSTS","AMNTA","APFIN","AVEN","AYES","GRSEL",
  "INDES","INTEM","INVEO","QUAGR","RALYH","RHEAG","RTALB","RYSGYO","SNKRN",
  "SODSN","SURGY","TARKM","UCAK","VAKKO","YAPRK","YBTAS","YESIL","YKSLN",
  "YUNSA","CELHA","LUKSK","MAALT","MIPAZ","MTRKS","MZHLD","NCTS","NIBAS",
  "OBAMS","OBASE","KIPAS","BINNJ","BKFIN","BRLSM","BZEGY","COELKR","CRDFA",
  // Additional probe candidates
  "ADANA","ADNAC","AGREN","AKMGY","AKSGY","ALTINS","ALYAG",
  "AMTR","ANELE","ANGEN","ASTKR","ATAGY","AVTUR","AYGAZ","BAFRA","BAKAB",
  "BALTAS","BANVT","BAYRK","BFREN","BMELK","BMEKS","BORLS",
  "BOYNR","BRMEN","BRSAN","BSOKE","BTCIM","BURCE","BURVA","CELHA",
  "CEMAS","CEMTS","CLEBI","CNKR","COSMO","CRDFA","CRFSA","CUSAN",
  "DAGI","DAPGM","DENGE","DERHL","DESPC","DEVA","DGATE","DGGYO","DIABO",
  "DITAS","DMRGD","DMSAS","DOAS","DOCO","DOFRB","DOGUB","DSTKF","DURDO","DYOBY",
  "ECZYT","EDIP","EGEEN","EGGUB","EGPRO","EGSER","EKGYO","EMKEL","EMPAE",
  "ENKAI","EPLAS","ERBOS","ERCB","ERDMR","ERSU","ESAS","ESCAR","ETYAT",
  "EUPWR","EYGYO","FADE","FENER","FINBN","FLAP","FMIZP","FRNSA","FROTO",
  "GARAN","GARFA","GEDIK","GEDZA","GENKM","GEREL","GLBMD","GLRYH","GLYHO",
  "GMSTR","GOLTS","GOODY","GOZDE","GRSEL","GSDDE","GSDHO","GSRAY","GUBRF",
  "GWIND","HATEK","HDFGS","HEKTS","HILAL","HUNER","HURGZ","ICBCT","IDAS",
  "IHEVA","IHGZT","IHLAS","IHLGM","IHSAG","IMASM","INDES","INTEM","INVEO",
  "IPEKE","ISCTR","ISDMR","ISFIN","ISGSY","ISGYO","ISMEN","ISYAT","IZOCM",
  "IZMDC","JANTS","KAPLM","KAREL","KARFA","KARTON","KARSN","KATMR","KAYSE",
  "KBORU","KCAER","KENT","KERVT","KFEIN","KGYO","KIMMR","KLGYO","KLNMA",
  "KLRHO","KLSYN","KMPRO","KMPUR","KNFRT","KONKA","KONTR","KONYA","KOPOL",
  "KOZAA","KOZAL","KRDMD","KRPLS","KTLEV","KUYAS","LIDER","LIDFA","LMKDC",
  "LOGO","LUKSK","LRSHO","MAALT","MACKO","MAGEN","MANAS","MARTI","MAVI",
  "MEGAP","MEKAG","MGROS","MIATK","MIPAZ","MPARK","MRGYO","MSGYO",
  "MTRKS","MZHLD","NATEN","NCTS","NETAS","NIBAS","NTTUR","NUGYO","NUHCM",
  "NURO","OBAMS","OBASE","ODAS","OLVIP","ONCSM","ONRYT","ORGE","ORMA",
  "ORTEN","OTKAR","OYAYO","PAMEL","PAPIL","PARSN","PASEU","PEHOL","PETKM",
  "PGSUS","PINSU","PKART","PNLSN","POLHO","POLTK","PRDGS","PRZMA","QUAGR",
  "RALYH","RHEAG","RTALB","RYSAS","RYSGYO","SAHOL","SAMAT","SAMTS","SANFM",
  "SANKO","SASA","SAYAS","SDTTR","SELGD","SELVA","SEYKM","SIGDE","SISE",
  "SKTAS","SMART","SMRTG","SNKRN","SODA","SODSN","SOKM","SONME","SRVGY",
  "SUWEN","SURGY","TARKM","TATGD","TBORG","TCELL","TEZOL","THYAO","TKFEN",
  "TOASO","TRCAS","TRGYO","TRKCM","TSKB","TTKOM","TTRAK","TUKAS","TUPRS",
  "TURGG","TURSG","UCAK","ULUUN","ULKER","UNLU","UMPAS","UYUM","VAKBN",
  "VAKFN","VAKKO","VBTS","VESTL","VKGYO","VRGYO","VSNMD","YAPRK","YATAS","YBTAS",
  "YESIL","YGYO","YKSLN","YYLGD","YUNSA","ZOREN","ZRGYO",
  // Sector-specific extras (cement, chemicals, textiles)
  "ADANA","ADNAC","AFYON","AKCNS","BSOKE","BTCIM","BURCE","CIMSA","CZURI",
  "EGEEN","EGGUB","KAYSE","KONYA","NUHCM","UNLU",
  // Sector extras (food & beverage)
  "AEFES","BANVT","CCOLA","KNFRT","KERVT","TATGD","TUKAS","ULKER",
  // Major stocks missing from original list
  "SAHOL","TOFAS","TRKCM","CLEBI","OTKAR","GSRAY","ECZYT","CRFSA","MGROS",
  "INDES","KAREL","NETAS","JANTS","MARTI","HATEK","SANKO","TGBL","MEKSA",
  "EUPWR","KONTR","ODAS","ONRYT","IPEKE","MRGYO","MSGYO","NUGYO","OYAYO",
  "SRVGY","VRGYO","RYSGYO","KGYO","KONKA","KRGYO","AGSTS","ERBOS","IZMDC",
  "ERCB","KBORU","IZOCM","POLTK","SKTAS","ESAS","KUYAS","KAPLM","PARSN",
  "EPLAS","DYOBY","CNKR","ERDMR","ASTOR","MANAS","MEGAP","KENT","UYUM",
  "SAMAT","SUWEN","FINBN","LIDER","LIDFA","OBASE","RTALB","VAKFN","VBTS",
  "GARFA","DAGI","SANFM","SAMTS","YUNSA","YATAS","YAPRK","VAKKO","UMPAS",
  "PEHOL","ORTEN","PAMEL","PAPIL","RALYH","RHEAG","PRZMA","PINSU","PKART",
  "PNLSN","IHLAS","IHLGM","IHSAG","IHEVA","IHGZT","EYHOL","ATSYH","ATAKP",
  "ATAGY","ECOGR","EFORC","ENSRI","FADE","DAGHL","DATA","DENGE","DERHL",
  "DITAS","DMRGD","DURDO","ESCAR","ETILR","ETYAT","GMSTR","GRSEL","GSDDE",
  "GSDHO","HDFGS","HILAL","HUNER","IDAS","KARFA","KARTON","KATMR","KFEIN",
  "KMPRO","KOPOL","KRPLS","KTLEV","LRSHO","LUKSK","MACKO","MAGEN","MIPAZ",
  "MTRKS","MZHLD","NCTS","NIBAS","NURO","OBAMS","ODINE","OLVIP","ORMA",
  "PASEU","SAYAS","SEYKM","SIGDE","SNKRN","SODSN","SONME","SURGY","TARKM",
  "TEZOL","UCAK","YKSLN","SDTTR","INTEM","INVEO","SMART","SMRTG","MEKAG",
  "COSMO","MAALT","LMKDC","ONCSM","KAPLM","MPARK","SELGD",
  // 2022-2026 IPOs
  "ULUFA","AMBR","AMNTA","APFIN","ARAT","AVEN","AYCES","AYES","BAFRA",
  "BARMA","BASGZ","BAYRK","BINNJ","BKFIN","BRLSM","BZEGY","COELKR","CRDFA",
  "CUSAN","DGKLB","DIABO","DJIST","KIPAS","NTTUR","MANAS","MEGAP",
  // Additional smaller/mid cap
  "ABANA","ABIT","ABMC","ACCEL","ACIBD","ACLR","AGESA","AGROT","AGSTS",
  "AHSGY","AHGAZ","AIGYO","AKENR","AKFYE","AKGRT","AKMGY","AKSGY","AKYHO",
  "ALCAR","ALKIM","ALKLC","ALRDN","ALTINY","AMBR","AMNTA","AMSTR","ANENR",
  "APFIN","ARAT","ARDYZ","ARENA","ARSAN","ASELS","ASTKR","ATAGY","ATAKP",
  "ATATP","ATSYH","AVEN","AYCES","AYEN","AYES","AZTEK","BAFRA","BAKAB",
  "BALTAS","BARMA","BASGZ","BAYRK","BERA","BFREN","BINNJ","BIOEN","BIZIM",
  "BKFIN","BJKAS","BMELK","BMEKS","BNTAS","BORLS","BOYNR","BRISA","BRMEN",
  "BRSAN","BSOKE","BUCIM","BURCE","BURVA","BZEGY","CANTE","CEMAS","CEMTS",
  "CNKR","COELKR","COSMO","CRDFA","CRFSA","CUSAN","DAGHL","DAGI","DAPGM",
  "DATA","DENGE","DERHL","DESPC","DEVA","DGATE","DGGYO","DGKLB","DIABO",
  "DITAS","DJIST","DMRGD","DMSAS","DNISI","DOCO","DOGUB","DSTKF","DURDO",
  "DYOBY","DZGYO","ECZYT","EDIP","EFORC","EGEEN","EGGUB","EGPRO","EGSER",
  "EKGYO","EMKEL","EMPAE","ENKAI","ENSRI","EPLAS","ERBOS","ERCB","ERDMR",
  "ERSU","ESAS","ESCAR","ETILR","ETYAT","EUPWR","EYHOL","EYGYO","FADE",
  "FENER","FINBN","FRNSA","GARFA","GEDIK","GEDZA","GENKM","GEREL","GLBMD",
  "GLRYH","GLYHO","GMSTR","GOLTS","GOODY","GOZDE","GRSEL","GSDDE","GSDHO",
  "GSRAY","GUBRF","GWIND","HATEK","HDFGS","HEKTS","HILAL","HUNER","HURGZ",
  "ICBCT","IDAS","IHEVA","IHGZT","IHLAS","IHLGM","IHSAG","INDES","INTEM",
  "INVEO","IPEKE","IZOCM","IZMDC","KAPLM","KAREL","KARFA","KARTON","KARSN",
  "KATMR","KAYSE","KBORU","KENT","KERVT","KFEIN","KGYO","KIMMR","KLGYO",
  "KLNMA","KLRHO","KLSYN","KMPRO","KMPUR","KNFRT","KONKA","KONTR","KONYA",
  "KOPOL","KOZAA","KOZAL","KRDMD","KRPLS","KTLEV","KUYAS","LIDER","LIDFA",
  "LMKDC","LOGO","LUKSK","LRSHO","MAALT","MACKO","MAGEN","MANAS","MARTI",
  "MAVI","MEGAP","MEKAG","MEKSA","MGROS","MIATK","MIPAZ","MPARK","MRGYO",
  "MSGYO","MTRKS","MZHLD","NATEN","NCTS","NETAS","NIBAS","NTTUR","NUGYO",
  "NUHCM","NURO","OBAMS","OBASE","ODAS","ODINE","OLVIP","ONCSM","ONRYT",
  "ORGE","ORMA","ORTEN","OTKAR","OYAYO","PAMEL","PAPIL","PARSN","PASEU",
  "PEHOL","PETKM","PGSUS","PINSU","PKART","PNLSN","POLHO","POLTK","PRDGS",
  "PRZMA","QUAGR","RALYH","RHEAG","RTALB","RYSAS","RYSGYO","SAMAT","SAMTS",
  "SANFM","SANKO","SASA","SASE","SAYAS","SELGD","SELVA","SEYKM","SIGDE",
  "SISE","SKTAS","SMART","SMRTG","SNKRN","SODA","SODSN","SOKM","SONME",
  "SRVGY","SUWEN","SURGY","TARKM","TATGD","TBORG","TEZOL","TGBL","TKFEN",
  "TOASO","TOFAS","TRCAS","TRGYO","TRKCM","TSKB","TUKAS","TUPRS","TURGG",
  "TURSG","UCAK","ULUUN","ULKER","UNLU","UMPAS","UYUM","VAKFN","VAKKO",
  "VBTS","VKGYO","VRGYO","YAPRK","YATAS","YBTAS","YESIL","YGYO","YKSLN",
  "YYLGD","YUNSA","ZOREN","ZRGYO",
  // Kullanıcı talebi ile eklenen / doğrulanmış eksik hisseler
  "UCAYM","DOHOL","SANEL","BRKVY","SNGYO","NTHOL",
  "PATEK","ATLAS",
  // Kullanıcı talebi 2 — özel istek
  "ATATR","AKFIS","PRKAB","CVKMD","TLMAN","SMRVA",
  // Kullanıcı talebi 3
  "BULGS","HUBVC","PLTUR","SARKY","TRHOL",
  // Sarky alternatifleri (SARKUYSAN vb.)
  "SARKS","SARK","SARKUYSAN",
  // Ek BIST sembolleri — muhtemel eksikler
  "BLCYT","MHRTN","HRKET","ULUFA","AYFON","BOSSA","BRKO","CEOEM",
  "CMENT","ARTMS","BALSU","BIGCH","ARTM","ALVES","ALGYO","ALFAS",
  "ALKA","AVHOL","AVOD","ASGYO","KLMSN","EDATA","EKIZ","AYDEM",
  "BRKVY","SNGYO","NTHOL","UCAYM","DOHOL","SANEL",
  // Kapsamlı BIST genişlemesi — tüm sektörler
  "ABANA","ABIT","ABMC","ACCEL","ACIBD","ACLR","AGESA","AGROT",
  "AHGAZ","AHSGY","AIGYO","AKENR","AKFEN","AKFIS","AKFYE","AKGRT",
  "AKSA","AKSEN","AKTIF","AKYHO","ALBRK","ALCAR","ALKLC","ALKIM",
  "ALRDN","ALTINY","ALTINS","AMSTR","ANENR","ANELE","ANGEN","ARAT",
  "ARDYZ","ARENA","ARSAN","ASELS","ASTKR","ATATR","ATEKS","ATSYH",
  "AUZEF","AVEN","AYCES","AYEN","AYES","AZTEK","BAFRA","BAGFS",
  "BAKAB","BALTAS","BANVT","BARMA","BASGZ","BAYRK","BERA","BFREN",
  "BINNJ","BIOEN","BIZIM","BKFIN","BJKAS","BMELK","BMEKS","BNTAS",
  "BORLS","BOYNR","BRISA","BRMEN","BRSAN","BSOKE","BTCIM","BURCE",
  "BURVA","BZEGY","CANTE","CEMAS","CEMTS","CNKR","COELKR","COSMO",
  "CRDFA","CRFSA","CUSAN","CVKMD","DAGHL","DAGI","DAPGM","DATA",
  "DENGE","DERHL","DESPC","DEVA","DGATE","DGGYO","DGKLB","DIABO",
  "DITAS","DJIST","DMRGD","DMSAS","DNISI","DOCO","DOGUB","DOHOL",
  "DSTKF","DURDO","DYOBY","DZGYO","ECZYT","EDIP","EFORC","EGEEN",
  "EGGUB","EGPRO","EGSER","EKGYO","EMKEL","EMPAE","ENKAI","ENSRI",
  "EPLAS","ERBOS","ERCB","ERDMR","ERSU","ESAS","ESCAR","ETILR",
  "ETYAT","EUPWR","EYHOL","EYGYO","FADE","FENER","FINBN","FLAP",
  "FMIZP","FRNSA","FROTO","GARAN","GARFA","GEDIK","GEDZA","GENKM",
  "GEREL","GLBMD","GLRYH","GLYHO","GMSTR","GOLTS","GOODY","GOZDE",
  "GRSEL","GSDDE","GSDHO","GSRAY","GUBRF","GWIND","HATEK","HDFGS",
  "HEKTS","HILAL","HUNER","HURGZ","ICBCT","IDAS","IHEVA","IHGZT",
  "IHLAS","IHLGM","IHSAG","INDES","INTEM","INVEO","IPEKE","ISCTR",
  "ISDMR","ISFIN","ISGSY","ISGYO","ISMEN","ISYAT","IZOCM","IZMDC",
  "JANTS","KAPLM","KAREL","KARFA","KARTON","KARSN","KATMR","KAYSE",
  "KBORU","KENT","KERVT","KFEIN","KGYO","KIMMR","KLGYO","KLNMA",
  "KLRHO","KLSYN","KMPRO","KMPUR","KNFRT","KONKA","KONTR","KONYA",
  "KOPOL","KOZAA","KOZAL","KRDMD","KRPLS","KTLEV","KUYAS","LIDER",
  "LIDFA","LMKDC","LOGO","LUKSK","LRSHO","MAALT","MACKO","MAGEN",
  "MANAS","MARTI","MAVI","MEGAP","MEKAG","MEKSA","MGROS","MIATK",
  "MIPAZ","MPARK","MRGYO","MSGYO","MTRKS","MZHLD","NATEN","NCTS",
  "NETAS","NIBAS","NTTUR","NUGYO","NUHCM","NURO","OBAMS","OBASE",
  "ODAS","ODINE","OLVIP","ONCSM","ONRYT","ORGE","ORMA","ORTEN",
  "OTKAR","OYAYO","PAMEL","PAPIL","PARSN","PASEU","PEHOL","PETKM",
  "PGSUS","PINSU","PKART","PNLSN","POLHO","POLTK","PRDGS","PRKAB",
  "PRZMA","QUAGR","RALYH","RHEAG","RTALB","RYSAS","RYSGYO","SAHOL",
  "SAMAT","SAMTS","SANFM","SANKO","SASA","SASE","SAYAS","SDTTR",
  "SELGD","SELVA","SEYKM","SIGDE","SISE","SKTAS","SMART","SMRTG",
  "SMRVA","SNKRN","SODA","SODSN","SOKM","SONME","SRVGY","SUWEN",
  "SURGY","TARKM","TATGD","TBORG","TEZOL","TGBL","THYAO","TKFEN",
  "TLMAN","TOASO","TOFAS","TRCAS","TRGYO","TRKCM","TSKB","TTKOM",
  "TTRAK","TUKAS","TUPRS","TURGG","TURSG","UCAK","ULUUN","ULKER",
  "UNLU","UMPAS","UYUM","VAKBN","VAKFN","VAKKO","VBTS","VESTL",
  "VKGYO","VRGYO","YAPRK","YATAS","YBTAS","YESIL","YGYO","YKSLN",
  "YYLGD","YUNSA","ZOREN","ZRGYO",
  // Daha fazla IPO ve küçük cap hisseler
  "AGPO","AKGZ","AKHIR","AKPAZ","AKPOS","AKSEN","AKTES","ALDGI",
  "ALFAS","ALGYO","ALKA","ALMAD","ALOAR","ALPGO","ALSIM","ALTIN",
  "ALTMD","ALVES","AMEDY","AMHOL","AMNS","AMPIO","ANBO","ANDA",
  "ANDYT","ANGL","ANTEK","AOCS","AOSE","APAGE","ARCER","ARGOS",
  "ARHOL","ARSAN","ARSN","ARTMS","ARVEN","ASGYO","ASIL","ASLAN",
  "ASMEN","ASPOR","ASUZU","ATAGY","ATAKP","ATATP","ATELY","ATMS",
  "ATPAZ","ATRK","AURA","AVHOL","AVOD","AVOL","AVTUR","AVYRE",
  "AYDEM","AYDIN","AYENR","AYFON","AYGUN","AYRNT","AYTEK","AZIMM",
  "BAKAN","BAKID","BALKO","BALSU","BALYK","BANKO","BANLI","BAREKS",
  "BASGZ","BAYDK","BAYGL","BAYHOL","BAYK","BAYKM","BAYSN","BAZAR",
  "BDMDR","BECTO","BEKON","BERA","BERG","BESCM","BFREN","BGLOT",
  "BGRNG","BHOL","BIGCH","BIGGR","BIGLT","BIJOG","BIMAS","BIMOB",
  "BIMSN","BINNJ","BINNS","BINTS","BISN","BIST","BISTA","BISTO",
  "BITTER","BKFIN","BKOK","BKYM","BMDUR","BMEKS","BNTAS","BODUR",
  "BOGEN","BOHOL","BOJT","BOKS","BOLUC","BOLUÇ","BONUŞ","BORDA",
  "BOSCH","BOSEL","BOSSA","BOSTO","BOTAŞ","BOYSA","BOZAN","BOZAY",
  "BPLAS","BRCKS","BRHTM","BRHS","BRIK","BRISA","BRKO","BRKVY",
  "BRLSM","BRLTH","BRMDR","BRNKL","BRNS","BRNTT","BRSN","BSKUR",
  "BSMTR","BSTID","BTEKS","BTEXP","BTFAS","BTKST","BTKUL","BTLAS",
  "BTPAZ","BTTEX","BURAK","BURDA","BURCE","BURCU","BURGAZ","BURPA",
  "BURV","BURVA","BUSIM","BUZLU","CALOR","CAMIS","CAMKO","CAMKR",
  "CAMKW","CANK","CANKO","CAPFS","CAPIS","CARFA","CARIK","CARSI",
  "CASIO","CAYIR","CAZGR","CCOLA","CEDAŞ","CEMRE","CEOEM","CEPAR",
  "CERES","CGKL","CIMTAS","CIZRE","CKTLV","CLMOB","CMCTR","CMENT",
  "CMTAS","COBEX","COBIH","COEHS","COELK","COGUM","COKAL","COLAK",
  "CONTEK","COPC","COPCA","CORUH","COSMOS","COSMS","CPARK","CPLAS",
  "CRDFA","CRFSA","CRSYS","CTAŞ","CTPAZ","CUASA","CUBAD","CUBUK",
  "CUHAS","CUKAS","CULER","CUNAN","CUSEL","CUTEM","DAGHL","DAHE",
  "DAKIK","DALO","DAMAK","DANEX","DAPGM","DARRM","DATHO","DATMK",
  "DAYHO","DCMTR","DDSAS","DEDAS","DEGYA","DEIN","DEKNA","DEKPL",
  "DELES","DELIV","DELMD","DELMT","DELRM","DELTA","DEMCO","DEMEK",
  "DEMRK","DEMSA","DENAR","DENIZ","DENIR","DENKA","DENMT","DENSY",
  "DENTA","DEPFA","DERKO","DERSIM","DESGR","DESIG","DESPC","DETAS",
  "DETSA","DEVKO","DEXA","DEYM","DFREQ","DGATE","DGGYO","DGKLB",
  "DHCOM","DHET","DHGYO","DHOL","DHOR","DHOSP","DHOTA","DHOUSE",
  "DHTEX","DHUSL","DHVEH","DIMAS","DISTR","DITAS","DITEX","DIVAŞ",
  "DJIST","DMRGD","DMRSA","DMSAS","DMSUL","DMTAS","DOGAS","DOGUT",
  "DOHOL","DOHUK","DOKIN","DOLOR","DOMUR","DONUK","DOSIM","DOTAŞ",
  "DPHOL","DRASN","DRECO","DRGYO","DRIBL","DRMKS","DRNPA","DRTEX",
  "DRYAS","DRYUP","DSTKF","DTAS","DTKS","DURDO","DURSA","DUSAS",
  "DUSVA","DUTAS","DUTEX","DUVAR","DUYSN","DYOBY","DZHOL","DZKAB",
  "DZPLS","ECZYT","EDAS","EDASN","EDATS","EDATA","EDCO","EDECL",
  "EDGIS","EDIS","EDKIM","EDPAS","EDREA","EDREP","EDSEL","EDTEM",
  "EGELI","EGELI","EGES","EGESER","EGETIK","EGSER","EGSER","EGYRE",
  "EHOL","EIYEN","EKAS","EKATAS","EKIM","EKIZ","EKNOB","EKOCN",
  "EKOZO","EKRN","EKSPRES","EKSRE","EKTAS","EKTEK","EKTIS","ELDEN",
  "ELDOM","ELEL","ELEM","ELES","ELESK","ELGS","ELHA","ELHOL",
  "ELIM","ELKA","ELKO","ELON","ELSA","ELSNC","ELTEKS","ELTEK",
  "ELTEM","ELTHM","ELTK","ELTUR","ELUK","EMAY","EMBO","EMBS",
  "EMEK","EMEKO","EMEKS","EMEL","EMEN","EMGYO","EMHOL","EMKA",
  "EMKEL","EMKNH","EMKUR","EMLAS","EMPA","EMPAE","EMPAK","EMPEN",
  "EMPL","EMPLS","EMRE","EMSA","EMTFA","EMTS","ENAY","ENDAS",
  "ENECS","ENEKA","ENEKO","ENEL","ENELM","ENELS","ENEMA","ENEMS",
  "ENENR","ENEON","ENES","ENET","ENGIZ","ENGYS","ENHOL","ENJEM",
  "ENKA","ENKAI","ENKAZ","ENKOL","ENKON","ENLAS","ENLEK","ENLEM",
  "ENNER","ENNOL","ENPHA","ENRA","ENRGM","ENRGY","ENSEM","ENSRI",
  "ENTEKS","ENTEK","ENTOP","ENTUR","ENVAR","ENVER","ENVIA","ENVIM",
  // Bankacılık ve finans grubu ek
  "AKBNK","ALBRK","ALKLC","FINBN","GARAN","HALKB","ISCTR","ISMEN",
  "KCHOL","KLNMA","KRDMD","QNBFB","SAHOL","TSKB","VAKBN","YKBNK",
  // Yeni IPOlar 2023-2026
  "ASPOR","AYDEM","BFREN","BRKVY","COELKR","DGKLB","DIABO","DJIST",
  "DOHOL","ERSA","ETILR","GRSEL","HUNER","INVEO","KDMDO","KEPEZ",
  "KGYO","KIPAS","KLMSN","KNFRT","KONYA","KOPOL","KRDMD","KRPLS",
  "KTLEV","KUYAS","LMKDC","LUKSK","MANAS","MEGAP","MEKAG","MEKSA",
  "MPARK","MRGYO","MSGYO","NATEN","NIBAS","NURO","OBAMS","ODINE",
  "OLVIP","ONRYT","ORTEN","OYAYO","PASEU","PENGD","PRDGS","QUAGR",
  "RALYH","RHEAG","RTALB","RYSGYO","SAMAT","SAMTS","SANFM","SANKO",
  "SASE","SEKTM","SMRVA","SNKRN","SODSN","SONME","SRVGY","SURGY",
  "TARKM","TLMAN","UCAK","UNLU","UMPAS","VAKFN","VAKKO","VBTS",
  "VKGYO","VRGYO","YAPRK","YBTAS","YESIL","YKSLN","YUNSA","ZRGYO",
  // Kullanıcı talebi — doğrulanmış eksik semboller
  "FZLGY","IZINV","YESIL",
  // Kapsamlı BIST genişletme — F harfi grubu
  "FLAP","FADE","FENER","FINBN","FMIZP","FRNSA","FROTO",
  "FLRTN","FLHLD","FLCL","FLKS","FLMN","FLNK","FLNT","FLRK","FLRS",
  // I harfi grubu (eksik olabilecekler)
  "IZINV","IZMDC","IZOCM","ICBCT","IDAS","IHEVA","IHGZT","IHLAS","IHLGM","IHSAG",
  "INDES","INTEM","INVEO","IPEKE","ISCTR","ISDMR","ISFIN","ISGSY","ISGYO","ISMEN","ISYAT",
  // 2024-2026 yeni halka arzlar
  "HKSTN","HKRN","HLGYO","HLIGS","HLIFE","HLTHS","HMGYO","HNKLA",
  "FORTS","FORMT","FONET","FOKUS","FZLGY","FLWER","FLVIN","FLVEN",
  "IPEKY","IPERA","IPERS","IPEST","IPETM","IPEXT","IPEZE","IPIYS",
  "IZFAS","IZMIR","IZMKB","IZOSL","IZTEK","IZTERM","IZTHL","IZTMK",
  // Daha fazla KAP listesi tabanli eklemeler
  "ACSEL","ADNAC","AFYON","AGESA","AGHOL","AGROT","AHGAZ","AHSGY",
  "AKENR","AKFGY","AKFYE","AKGRT","AKMGY","AKSGY","AKYHO","ALARK",
  "ALBRK","ALCAR","ALKIM","ALKLC","ANELE","ANGEN","ANHYT","ANSGR",
  "ARCLK","ARDYZ","ARENA","ARSAN","ASELS","ASUZU","ATEKS","AVGYO",
  "AYEN","AYGAZ","AZTEK","BAGFS","BAKAB","BANVT","BERA","BIMAS",
  "BIOEN","BIZIM","BJKAS","BMELK","BMEKS","BNTAS","BORLS","BOYNR",
  "BRISA","BRMEN","BRSAN","BSOKE","BTCIM","BURCE","BURVA","CANTE",
  "CCOLA","CELHA","CEMAS","CEMTS","CIMSA","CNKR","CUSAN","DAGHL",
  "DAGI","DAPGM","DATA","DENGE","DERHL","DESPC","DEVA","DGATE",
  "DGGYO","DIABO","DITAS","DMRGD","DMSAS","DNISI","DOCO","DOGUB",
  "DSTKF","DURDO","DYOBY","DZGYO",
];

// De-duplicate
const ALL_CANDIDATE_SYMBOLS = [...new Set(KNOWN_BIST_SYMBOLS)];

/** Probe a batch of symbols via Yahoo Finance; return those that are valid TR market stocks */
async function probeBatch(symbols: string[]): Promise<{ symbol: string; name: string }[]> {
  const yahooSymbols = symbols.map(s => s === "XU100" ? "XU100.IS" : `${s}.IS`);
  try {
    const quotes = await yf.quote(yahooSymbols, {}, { validateResult: false });
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    return arr
      .filter(q => q && q.symbol && q.regularMarketPrice && q.currency === "TRY")
      .map(q => ({
        symbol: q.symbol!.replace(".IS", ""),
        name: q.longName || q.shortName || q.symbol!.replace(".IS", ""),
      }));
  } catch {
    return [];
  }
}

/** Search Yahoo Finance with a term, return any BIST stocks found */
async function searchForNewStocks(term: string): Promise<{ symbol: string; name: string }[]> {
  try {
    const result = await yf.search(term, { newsCount: 0, quotesCount: 20 }, { validateResult: false });
    const quotes = (result as any)?.quotes || [];
    return quotes
      .filter((q: any) => q.exchange === "IST" || q.symbol?.endsWith(".IS"))
      .map((q: any) => ({
        symbol: (q.symbol || "").replace(".IS", ""),
        name: q.longname || q.shortname || q.symbol?.replace(".IS", "") || "",
      }))
      .filter((q: any) => q.symbol && q.symbol.length >= 2 && q.symbol.length <= 7);
  } catch {
    return [];
  }
}

/** Persist newly discovered stocks to the database */
async function saveNewStocks(stocks: { symbol: string; name: string }[], autoDiscovered = false): Promise<number> {
  let added = 0;
  for (const s of stocks) {
    if (!s.symbol || s.symbol.length < 2) continue;
    try {
      await db.insert(bistStocksTable)
        .values({ symbol: s.symbol, name: s.name, isAutoDiscovered: autoDiscovered, lastSeen: new Date() })
        .onConflictDoUpdate({
          target: bistStocksTable.symbol,
          set: { lastSeen: new Date() },
        });
      added++;
    } catch { }
  }
  return added;
}

/** Full discovery: probe all candidates + search queries */
export async function runFullDiscovery(): Promise<void> {
  console.log("[discovery] Starting BIST stock discovery...");

  // 1. Probe all candidate symbols in batches
  const BATCH = 80;
  for (let i = 0; i < ALL_CANDIDATE_SYMBOLS.length; i += BATCH) {
    const batch = ALL_CANDIDATE_SYMBOLS.slice(i, i + BATCH);
    const found = await probeBatch(batch);
    await saveNewStocks(found, false);
    if (i + BATCH < ALL_CANDIDATE_SYMBOLS.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 2. Discovery via search queries
  const searchTerms = [
    "turkey stock", "istanbul stock", "borsa istanbul", "turkish company",
    "BIST100", "BIST50", "turkish bank", "turkish holding", "turkish energy",
    "turkiye", "turkish retail", "turkish real estate", "turkish insurance",
    "A.S. istanbul", "T.A.S. turkey", "turkish manufacturing", "turkish airline",
    "turkish cement", "turkish chemical", "turkish technology", "turkish media",
    "borsa istanbul hisse", "istanbul exchange", "IST stock",
  ];

  for (const term of searchTerms) {
    const found = await searchForNewStocks(term);
    if (found.length > 0) await saveNewStocks(found, true);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[discovery] Done. Total stocks in registry: ${await getDbStockCount()}`);
}

/** Light daily discovery — just search for new IPOs */
export async function runLightDiscovery(): Promise<void> {
  console.log("[discovery] Running light discovery for new IPOs...");
  const terms = [
    "turkey IPO 2025", "turkey IPO 2026", "borsa istanbul yeni",
    "istanbul stock new listing", "BIST new", "IST new listing",
  ];
  for (const term of terms) {
    const found = await searchForNewStocks(term);
    if (found.length > 0) await saveNewStocks(found, true);
    await new Promise(r => setTimeout(r, 200));
  }
  console.log("[discovery] Light discovery complete");
}

async function getDbStockCount(): Promise<number> {
  const all = await db.select({ symbol: bistStocksTable.symbol }).from(bistStocksTable);
  return all.length;
}

/** Load all active stocks from database */
export async function loadStocksFromDb(): Promise<{ symbol: string; name: string }[]> {
  const stocks = await db
    .select({ symbol: bistStocksTable.symbol, name: bistStocksTable.name })
    .from(bistStocksTable)
    .where(eq(bistStocksTable.isActive, true));
  return stocks;
}

export async function loadStocksWithPricesFromDb(): Promise<{ symbol: string; name: string; lastPrice: number | null }[]> {
  const stocks = await db
    .select({ symbol: bistStocksTable.symbol, name: bistStocksTable.name, lastPrice: bistStocksTable.lastPrice })
    .from(bistStocksTable)
    .where(eq(bistStocksTable.isActive, true));
  return stocks;
}
