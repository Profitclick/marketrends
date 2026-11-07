import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NewsView from "./pages/NewsView";
import NotFound from "./pages/NotFound";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { ScrollToTop } from "./components/ScrollToTop";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const About = lazy(() => import("./pages/About"));
const TopicPage = lazy(() => import("./pages/TopicPage"));
const EntityPage = lazy(() => import("./pages/EntityPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const Academy = lazy(() => import("./pages/Academy"));
const Tools = lazy(() => import("./pages/Tools"));
const Trending = lazy(() => import("./pages/Trending"));
const ClusterPage = lazy(() => import("./pages/ClusterPage"));
const SearchIntentPage = lazy(() => import("./pages/SearchIntentPage"));
const VerticalPage = lazy(() => import("./pages/VerticalPage"));
const Resources = lazy(() => import("./pages/Resources"));
const Newsletter = lazy(() => import("./pages/Newsletter"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-dvh flex items-center justify-center text-sm text-muted-foreground">
    Laster…
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<NewsView />} />
            <Route path="/kategori/:slug" element={<CategoryPage />} />
            <Route path="/om-oss" element={<About />} />
            <Route path="/topic/:slug" element={<TopicPage />} />
            <Route path="/entity/:slug" element={<EntityPage />} />
            <Route path="/knowledge/:slug" element={<KnowledgePage />} />
            <Route path="/compare/:slug" element={<ComparePage />} />
            <Route path="/guide/:slug" element={<GuidePage />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/cluster/:slug" element={<ClusterRedirect />} />
            <Route path="/intent/:slug" element={<SearchIntentPage />} />
            <Route path="/ai" element={<VerticalPage />} />
            <Route path="/krypto" element={<VerticalPage />} />
            <Route path="/fintech" element={<VerticalPage />} />
            <Route path="/startup" element={<VerticalPage />} />
            <Route path="/investering" element={<VerticalPage />} />
            <Route path="/daytrading" element={<VerticalPage />} />
            <Route path="/ressurser" element={<Resources />} />
            <Route path="/ressurser/:type" element={<Resources />} />
            <Route path="/newsletter" element={<Newsletter />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/:slug" element={<NewsView />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
