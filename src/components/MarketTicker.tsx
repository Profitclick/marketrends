import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketData {
  label: string;
  value: string;
  change?: number;
}

export const MarketTicker = () => {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch("https://api.exchangerate-api.com/v4/latest/NOK");
        const data = await response.json();
        setMarkets([
          { label: "USD/NOK", value: (1 / data.rates.USD).toFixed(2) },
          { label: "EUR/NOK", value: (1 / data.rates.EUR).toFixed(2) },
          { label: "GBP/NOK", value: (1 / data.rates.GBP).toFixed(2) },
          { label: "SEK/NOK", value: (1 / data.rates.SEK).toFixed(2) },
        ]);
      } catch {
        setMarkets([
          { label: "USD/NOK", value: "10.85" },
          { label: "EUR/NOK", value: "11.42" },
        ]);
      }
    };
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 300000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Oslo" });
  const formatDate = (d: Date) =>
    d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });

  return (
    <div className="bg-header-footer border-b border-header-footer-foreground/10">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between py-1.5 text-[11px]" style={{ fontFamily: "'Inter', sans-serif" }}>
          <div className="flex min-w-0 items-center gap-4 sm:gap-6 overflow-hidden">
            <span className="hidden md:inline shrink-0 text-header-footer-foreground/50 whitespace-nowrap capitalize">
              {formatDate(currentTime)} · {formatTime(currentTime)}
            </span>
            <span className="md:hidden shrink-0 text-header-footer-foreground/50 whitespace-nowrap tabular-nums">
              {formatTime(currentTime)}
            </span>
            {markets.map((market, idx) => (
              <div\n                key={idx}\n                className={`items-center gap-1.5 whitespace-nowrap shrink-0 ${idx === 2 ? "hidden sm:flex" : idx >= 3 ? "hidden md:flex" : "flex"}`}\n              >
                <span className="text-header-footer-foreground/50">{market.label}</span>
                <span className="font-semibold text-header-footer-foreground">{market.value}</span>
                {market.change !== undefined && (
                  <span className={`flex items-center gap-0.5 ${market.change >= 0 ? "text-market-positive" : "text-market-negative"}`}>
                    {market.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(market.change)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
