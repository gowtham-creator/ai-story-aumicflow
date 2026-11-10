import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore.persist.hasHydrated();

  // While Zustand is loading localStorage → show nothing (or loader)
  if (!hasHydrated) return null;

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}
