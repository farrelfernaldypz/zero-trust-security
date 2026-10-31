import { useState } from 'react';
import Icon from '../components/Icon.jsx';

const demoAccounts = [
  { username: 'admin', password: 'Admin123!', deviceId: 'device-admin-001', role: 'Admin', name: 'Admin Informatika' },
  { username: 'dosen1', password: 'Dosen123!', deviceId: 'device-dosen-001', role: 'Dosen · IF101', name: 'Dr. Dosen Satu' },
  { username: 'dosen2', password: 'Dosen123!', deviceId: 'device-dosen-002', role: 'Dosen · IF102', name: 'Dr. Dosen Dua' },
  { username: 'mhs1', password: 'Mhs123!', deviceId: 'device-mhs-001', role: 'Mahasiswa · 227006001', name: 'Mahasiswa Satu' },
  { username: 'mhs2', password: 'Mhs123!', deviceId: 'device-mhs-002', role: 'Mahasiswa · 227006002', name: 'Mahasiswa Dua' },
  { username: 'mhs3', password: 'Mhs123!', deviceId: 'device-mhs-003', role: 'Mahasiswa · 227006003', name: 'Mahasiswa Tiga' },
];

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin({ username, password, deviceId });
    } catch (loginError) {
      setError(loginError.message || 'Login gagal. Periksa kredensial dan Device ID.');
    } finally {
      setLoading(false);
    }
  }

  function chooseAccount(account) {
    setUsername(account.username);
    setPassword(account.password);
    setDeviceId(account.deviceId);
    setError('');
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark"><Icon name="book" size={21} /></span>
          <span className="brand-copy"><strong>Sistem Nilai Informatika</strong><small>Zero Trust Security</small></span>
        </div>

        <div className="login-heading">
          <div className="login-kicker"><Icon name="lock" size={14} /> ZERO TRUST SECURITY</div>
          <h1>Sistem Nilai<br /><span>Informatika</span></h1>
          <p>Platform pengelolaan nilai akademik dengan penerapan prinsip Zero Trust Security.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="username">Username</label>
          <div className="input-wrap">
            <span className="input-leading">@</span>
            <input id="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Masukkan username" required />
          </div>

          <label className="field-label" htmlFor="password">Password</label>
          <div className="input-wrap">
            <span className="input-leading"><Icon name="lock" size={16} /></span>
            <input id="password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Masukkan password" required />
            <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>

          <label className="field-label" htmlFor="device">Device ID</label>
          <div className="input-wrap">
            <span className="input-leading device-leading"><span /></span>
            <input id="device" autoComplete="off" value={deviceId} onChange={event => setDeviceId(event.target.value)} placeholder="Contoh: device-mhs-001" required />
          </div>
          <p className="field-hint">Gunakan perangkat yang telah terdaftar pada akun Anda.</p>

          {error ? <div className="form-error" role="alert"><Icon name="shield" size={17} /><span>{error}</span></div> : null}

          <button className="button button-primary login-submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner spinner-light" /> : null}
            {loading ? 'Memverifikasi akses…' : 'Masuk ke Dashboard'}
            {!loading ? <Icon name="arrow" size={18} /> : null}
          </button>
        </form>

        {demoMode ? (
          <section className="demo-accounts">
            <div className="demo-heading"><span>Akun demonstrasi</span><span className="demo-badge">MODE DEMO</span></div>
            <div className="demo-list">
              {demoAccounts.map(account => (
                <button className="demo-account" type="button" key={account.username} onClick={() => chooseAccount(account)}>
                  <span className="demo-avatar">{account.username.slice(0, 1).toUpperCase()}</span>
                  <span className="demo-account-copy"><strong>{account.name}</strong><small>{account.role}</small></span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="login-footnote"><span className="status-dot" /> Akses dilindungi oleh verifikasi identitas dan perangkat</div>
      </section>
      <aside className="login-side-note">
        <span className="side-note-line" />
        <p>Pengelolaan akademik yang aman untuk lingkungan Informatika.</p>
        <small>INFORMATIKA UNIVERSITAS SILIWANGI</small>
        <small>TUGAS PRAKTIKUM KEAMANAN INFORMASI</small>
      </aside>
    </main>
  );
}
