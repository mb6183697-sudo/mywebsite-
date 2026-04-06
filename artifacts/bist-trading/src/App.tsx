import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { TradeProvider } from "@/hooks/use-trade";
import { Layout } from "@/components/layout/Layout";

// Pages
import AuthPage from "@/pages/auth";
import Home from "@/pages/home";
import Stocks from "@/pages/stocks";
import PortfolioPage from "@/pages/portfolio";
import Profile from "@/pages/profile";
import NewsPage from "@/pages/news";
import NotFound from "@/pages/not-found";
import ChangePasswordForcePage from "@/pages/change-password-force";

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Redirect href="/auth" />;
  
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/sifre-degistir" component={ChangePasswordForcePage} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/hisseler" component={() => <ProtectedRoute component={Stocks} />} />
      <Route path="/portfoy" component={() => <ProtectedRoute component={PortfolioPage} />} />
      <Route path="/profil" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/haberler" component={() => <ProtectedRoute component={NewsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <TradeProvider>
              <Router />
            </TradeProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
