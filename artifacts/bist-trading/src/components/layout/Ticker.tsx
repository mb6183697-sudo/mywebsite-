import { useGetStocks } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function Ticker() {
  const { data: stocks } = useGetStocks();

  if (!stocks || stocks.length === 0) return null;

  // Duplicate stocks for infinite scroll effect
  const displayStocks = [...stocks, ...stocks, ...stocks];

  return (
    <div className="w-full bg-secondary text-secondary-foreground overflow-hidden h-10 flex items-center border-b border-secondary-foreground/10">
      <div className="flex animate-ticker whitespace-nowrap">
        {displayStocks.map((stock, i) => {
          const isUp = stock.change >= 0;
          return (
            <div
              key={`${stock.symbol}-${i}`}
              className="flex items-center gap-2 px-6 border-r border-secondary-foreground/10"
            >
              <span className="font-bold font-display text-sm">{stock.symbol}</span>
              <span className="text-sm">{formatCurrency(stock.price)}</span>
              <span
                className={`flex items-center text-xs font-medium ${
                  isUp ? "text-success" : "text-destructive"
                }`}
              >
                {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {formatPercent(stock.changePercent)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
