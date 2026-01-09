import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Learn from "./pages/Learn";
import LocalLearn from "./pages/LocalLearn";
import WordBook from "./pages/WordBook";
import Statistics from "./pages/Statistics";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminVideos from "./pages/admin/Videos";
import AdminCategories from "./pages/admin/Categories";
import AdminUsers from "./pages/admin/Users";
import AdminAuthCodes from "./pages/admin/AuthCodes";
import AdminAppCodes from "./pages/admin/AppCodes";
import AdminDictionary from "./pages/admin/Dictionary";
import AdminProfessionalProviders from "./pages/admin/ProfessionalProviders";
import TranslationProviders from "./pages/admin/TranslationProviders";
import AdminDevices from "./pages/admin/Devices";

const queryClient = new QueryClient();

// 这些组件必须在 AuthProvider 内部使用
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/learn" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
    <Route path="/learn/:videoId" element={<ProtectedRoute><Learn /></ProtectedRoute>} />
    <Route path="/local-learn" element={<ProtectedRoute><LocalLearn /></ProtectedRoute>} />
    <Route path="/wordbook" element={<ProtectedRoute><WordBook /></ProtectedRoute>} />
    <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/videos" element={<AdminRoute><AdminVideos /></AdminRoute>} />
    <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
    <Route path="/admin/devices" element={<AdminRoute><AdminDevices /></AdminRoute>} />
    <Route path="/admin/app-codes" element={<AdminRoute><AdminAppCodes /></AdminRoute>} />
    <Route path="/admin/pro-codes" element={<AdminRoute><AdminAuthCodes /></AdminRoute>} />
    <Route path="/admin/professional" element={<AdminRoute><AdminProfessionalProviders /></AdminRoute>} />
    <Route path="/admin/dictionary" element={<AdminRoute><AdminDictionary /></AdminRoute>} />
    <Route path="/admin/translation" element={<AdminRoute><TranslationProviders /></AdminRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// 确保 AuthProvider 在 BrowserRouter 内部
const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;