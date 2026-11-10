import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "@/pages/AuthPage";
import ChatPage from "@/pages/ChatPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";


function App() {
  const hasHydrated = useAuthStore.persist.hasHydrated();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route 
            path="/" 
            element={
              hasHydrated
                ? (isAuthenticated ? <Navigate to="/chat" /> : <Navigate to="/auth" />)
                : null
            }
          />

          <Route 
            path="/auth" 
            element={
              isAuthenticated 
                ? <Navigate to="/chat" replace /> 
                : <AuthPage />
            }
          />

          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}


export default App;
