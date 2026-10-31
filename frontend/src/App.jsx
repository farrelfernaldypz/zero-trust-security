import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from './components/DashboardLayout.jsx';
import Toast from './components/Toast.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { RolePage } from './pages/RolePages.jsx';
import { apiRequest, logoutSession, setAccessReporter } from './services/api.js';
import { readSession, writeSession } from './services/session.js';

export default function App() {
  const [session, setSession] = useState(() => readSession());
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [accessEvents, setAccessEvents] = useState([]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setAccessReporter(event => {
      setAccessEvents(current => [event, ...current].slice(0, 12));
      if (event.status === 401 || event.endpoint === '/auth/refresh') {
        setSession(readSession());
      }
    });
    return () => setAccessReporter(() => {});
  }, []);

  async function login(credentials) {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username: credentials.username, password: credentials.password },
      deviceId: credentials.deviceId,
      auth: false,
    });
    const nextSession = {
      user: result.user,
      deviceId: credentials.deviceId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
    writeSession(nextSession);
    setSession(nextSession);
    setPage('dashboard');
    notify(`Selamat datang, ${result.user.name}.`);
  }

  async function logout() {
    try {
      await logoutSession();
      notify('Sesi berakhir dan refresh token telah dicabut.');
    } catch (error) {
      notify(error.message || 'Refresh token tidak dapat dicabut. Sesi lokal tetap dihapus.', 'error');
    } finally {
      setSession(null);
      setAccessEvents([]);
      setPage('dashboard');
    }
  }

  if (!session?.user || !session.accessToken) {
    return <><LoginPage onLogin={login} /><Toast toast={toast} onDismiss={() => setToast(null)} /></>;
  }

  return (
    <>
      <DashboardLayout session={session} page={page} setPage={setPage} onLogout={logout}>
        <RolePage page={page} session={session} setPage={setPage} notify={notify} accessEvents={accessEvents} />
      </DashboardLayout>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
