import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './auth';
import { Brand } from './components/ui';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Private from './pages/Private';

function Protected() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <SessionCheck />;
  // remember where they were headed, so signing in can bring them back
  return user ? <Outlet /> : <Navigate to="/" replace state={{ from: pathname }} />;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <SessionCheck />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Home />;
}

function SessionCheck() {
  return (
    <div className="session-check" role="status">
      <Brand />
      <div className="session-check-bar" />
      <p>Checking your session…</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Protected />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/private" element={<Private />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
