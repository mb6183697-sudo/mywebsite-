import { createContext, useContext, useState } from "react";
import { Stock } from "@workspace/api-client-react";
import TradeModal from "@/components/trade/TradeModal";

interface TradeContextType {
  openTrade: (stock: Stock) => void;
  closeTrade: () => void;
}

const TradeContext = createContext<TradeContextType | null>(null);

export function TradeProvider({ children }: { children: React.ReactNode }) {
  const [activeStock, setActiveStock] = useState<Stock | null>(null);

  const openTrade = (stock: Stock) => {
    setActiveStock(stock);
  };

  const closeTrade = () => {
    setActiveStock(null);
  };

  return (
    <TradeContext.Provider value={{ openTrade, closeTrade }}>
      {children}
      {activeStock && <TradeModal stock={activeStock} onClose={closeTrade} />}
    </TradeContext.Provider>
  );
}

export function useTrade() {
  const context = useContext(TradeContext);
  if (!context) {
    throw new Error("useTrade must be used within a TradeProvider");
  }
  return context;
}
