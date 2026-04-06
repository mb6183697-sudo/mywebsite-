import { useEffect, useRef } from "react";

export function MarketTicker() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "BIST:XU100",         title: "BIST 100" },
        { proName: "FX_IDC:USDTRY",      title: "USD/TRY" },
        { proName: "FX_IDC:EURTRY",      title: "EUR/TRY" },
        { proName: "FX_IDC:GBPTRY",      title: "GBP/TRY" },
        { proName: "BITSTAMP:BTCUSD",    title: "Bitcoin" },
        { proName: "BITSTAMP:ETHUSD",    title: "Ethereum" },
        { proName: "NASDAQ:NDX",         title: "NASDAQ 100" },
        { proName: "INDEX:DEU40",        title: "GER40" },
        { proName: "SP:SPX",             title: "S&P 500" },
        { proName: "BIST:THYAO",         title: "THYAO" },
        { proName: "BIST:GARAN",         title: "GARAN" },
        { proName: "BIST:EREGL",         title: "EREGL" },
        { proName: "BIST:AKBNK",         title: "AKBNK" },
        { proName: "BIST:KCHOL",         title: "KCHOL" },
        { proName: "BIST:SISE",          title: "SISE" },
        { proName: "COMEX:GC1!",         title: "Altın" },
        { proName: "NYMEX:CL1!",         title: "Petrol" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "tr",
    });

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(widgetDiv);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div className="w-full bg-background/80 backdrop-blur-sm border-b border-border/40 overflow-hidden">
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: "46px" }}
      />
    </div>
  );
}
