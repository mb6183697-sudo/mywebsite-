import { ReactNode, useEffect } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { MarketTicker } from "@/components/MarketTicker";
import { useLocation } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      {/* Scrolling market ticker — fixed below navbar */}
      <div className="fixed top-[88px] left-0 right-0 z-40">
        <MarketTicker />
      </div>
      <main className="flex-1 w-full pt-[134px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
