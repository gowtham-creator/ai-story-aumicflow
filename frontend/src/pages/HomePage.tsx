import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';

function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
  const isAuthed = useAuthStore.getState().checkAuth();
  navigate(isAuthed ? "/chat" : "/auth", { replace: true });
}, []);

  return null;
}

export default HomePage;
