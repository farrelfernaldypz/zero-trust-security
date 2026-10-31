import { useCallback, useState } from 'react';
import Icon from './Icon.jsx';
import { apiRequest } from '../services/api.js';
import useApiResource from '../hooks/useApiResource.js';
import { initials, roleLabels } from '../utils/format.js';

const navigation = {
  mahasiswa: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'grades', label: 'Nilai Saya', icon: 'grades' },
    { id: 'transcript', label: 'Transkrip', icon: 'transcript' },
    { id: 'security', label: 'Informasi Keamanan', icon: 'shield' },
    { id: 'logout', label: 'Keluar', icon: 'logout' },
  ],
  dosen: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'classes', label: 'Kelas Saya', icon: 'classes' },
    { id: 'manage', label: 'Kelola Nilai', icon: 'grades' },
    { id: 'finalize', label: 'Finalisasi Nilai', icon: 'check' },
    { id: 'security', label: 'Informasi Keamanan', icon: 'shield' },
    { id: 'logout', label: 'Keluar', icon: 'logout' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'transcripts', label: 'Data Transkrip', icon: 'transcript' },
    { id: 'security', label: 'Informasi Keamanan', icon: 'shield' },
    { id: 'logout', label: 'Keluar', icon: 'logout' },
  ],
};

const pageTitles = {
  dashboard: { mahasiswa: 'Dashboard Mahasiswa', dosen: 'Dashboard Dosen', admin: 'Dashboard Admin' },
  grades: 'Nilai Saya',
  transcript: 'Transkrip Akademik',
  classes: 'Kelas Saya',
  manage: 'Kelola Nilai',
  finalize: 'Finalisasi Nilai',
  transcripts: 'Data Transkrip',
  security: 'Informasi Keamanan',
};

export default function DashboardLayout({ session, page, setPage, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const loadGateway = useCallback(() => apiRequest('/health', { auth: false }), []);
  const gateway = useApiResource(loadGateway, [loadGateway]);
  const items = navigation[session.user.role] || navigation.mahasiswa;
  const roleLabel = roleLabels[session.user.role] || session.user.role;
  const pageTitle = page === 'dashboard' ? pageTitles.dashboard[session.user.role] : pageTitles[page];

  function navigate(id) {
    if (id === 'logout') {
      onLogout();
      return;
    }
    setPage(id);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      {menuOpen ? <button type="button" className="mobile-scrim" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark brand-mark-small"><Icon name="book" size={19} /></span>
          <span className="brand-copy"><strong>Sistem Nilai Informatika</strong><small>ZERO TRUST SECURITY</small></span>
          <button className="icon-button mobile-close" type="button" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-emblem">IF</span>
          <span><strong>Informatika</strong><small>Universitas Siliwangi</small></span>
          <span className="workspace-chevron">⌄</span>
        </div>

        <div className="nav-section-label">MENU UTAMA</div>
        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {items.map(item => (
            <button type="button" key={item.id} onClick={() => navigate(item.id)} className={`nav-item ${page === item.id ? 'nav-item-active' : ''}`} aria-current={page === item.id ? 'page' : undefined}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {page === item.id ? <span className="nav-active-mark" /> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security-card">
            <span className="security-card-icon"><Icon name="shield" size={16} /></span>
            <div><strong>Sesi terlindungi</strong><small>Verifikasi aktif</small></div>
            <span className="status-dot" />
          </div>
          <div className="sidebar-profile">
            <span className="avatar avatar-sidebar">{initials(session.user.name)}</span>
            <span className="profile-copy"><strong>{session.user.name}</strong><small>{roleLabel}</small></span>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label="Buka menu" onClick={() => setMenuOpen(true)}><Icon name="menu" size={21} /></button>
          <div className="breadcrumb"><span>Akademik</span><span className="breadcrumb-divider">/</span><strong>{pageTitle || 'Dashboard'}</strong></div>
          <div className="topbar-actions">
            <div className={`gateway-status ${gateway.error ? 'gateway-offline' : ''}`} title={gateway.error || 'API Gateway'}><span className="status-dot" /><span>{gateway.loading ? 'Gateway…' : gateway.error ? 'Gateway terputus' : 'Gateway aktif'}</span></div>
            <div className="topbar-divider" />
            <button className="topbar-user" type="button" onClick={() => setPage('security')} title="Lihat informasi sesi">
              <span className="avatar avatar-topbar">{initials(session.user.name)}</span>
              <span className="topbar-user-copy"><strong>{session.user.name}</strong><small>{roleLabel}</small></span>
              <span className="user-chevron">⌄</span>
            </button>
          </div>
        </header>

        <main className="page-content">
          <div className="page-content-inner">{children}</div>
          <footer className="app-footer"><span>© 2026 Sistem Nilai Informatika</span><span><Icon name="shield" size={14} /> Dilindungi oleh Zero Trust</span></footer>
        </main>
      </div>
    </div>
  );
}

