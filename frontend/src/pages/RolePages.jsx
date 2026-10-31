import { useCallback, useMemo, useState } from 'react';
import { apiRequest } from '../services/api.js';
import useApiResource from '../hooks/useApiResource.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Icon from '../components/Icon.jsx';
import { decodeTokenExpiry, formatDate, formatScore, roleLabels } from '../utils/format.js';

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}

function MetricCard({ label, value, detail, icon, accent = 'blue' }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-${accent}`}><Icon name={icon} size={19} /></div>
      <div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function LoadingState({ label = 'Memuat data…' }) {
  return <div className="state-card"><span className="spinner" /><span>{label}</span></div>;
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card state-error">
      <span className="state-icon"><Icon name="shield" size={19} /></span>
      <span><strong>Data belum dapat dimuat</strong><small>{message}</small></span>
      {onRetry ? <button className="button button-secondary button-small" type="button" onClick={onRetry}>Coba lagi</button> : null}
    </div>
  );
}

function EmptyState({ title, message, icon = 'grades' }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={22} /></span><strong>{title}</strong><p>{message}</p></div>;
}

function StatusBadge({ finalized }) {
  const isFinal = Number(finalized) === 1 || finalized === true;
  return <span className={`status-badge ${isFinal ? 'status-success' : 'status-pending'}`}><i />{isFinal ? 'Final' : 'Dalam proses'}</span>;
}

function Table({ columns, rows, emptyTitle = 'Belum ada data', emptyMessage = 'Data akan muncul di sini setelah tersedia.' }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr>{columns.map(column => <th key={column.key} className={column.align === 'right' ? 'align-right' : ''}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.classId || row.nim || `${row.endpoint}-${row.occurred_at}-${index}`}>
              {columns.map(column => <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function gradeColumns() {
  return [
    { key: 'code', label: 'Mata kuliah', render: row => <span className="course-cell"><strong>{row.code}</strong><small>{row.class_name}</small></span> },
    { key: 'nim', label: 'NIM / Mahasiswa', render: row => row.nim ? <span className="course-cell"><strong>{row.nim}</strong><small>{row.full_name}</small></span> : <span className="muted">Mata kuliah Anda</span> },
    { key: 'score', label: 'Nilai', render: row => <strong className="score-value">{formatScore(row.score)}</strong> },
    { key: 'finalized', label: 'Status', render: row => <StatusBadge finalized={row.finalized} /> },
  ];
}

function useGrades() {
  const load = useCallback(async () => {
    const response = await apiRequest('/nilai');
    return response.data || [];
  }, []);
  return useApiResource(load, []);
}

function getClasses(grades = []) {
  const byId = new Map();
  for (const grade of grades) {
    if (!byId.has(grade.class_id)) {
      byId.set(grade.class_id, {
        id: grade.class_id,
        code: grade.code,
        name: grade.class_name,
        finalized: grade.finalized,
        students: new Set(),
        gradeCount: 0,
      });
    }
    const classData = byId.get(grade.class_id);
    classData.gradeCount += 1;
    if (grade.student_id) classData.students.add(grade.student_id);
  }
  return [...byId.values()].map(item => ({ ...item, studentCount: item.students.size }));
}

function StudentDashboard({ session, setPage }) {
  const load = useCallback(async () => {
    const [gradeResponse, transcript] = await Promise.all([
      apiRequest('/nilai'),
      apiRequest(`/transkrip/${encodeURIComponent(session.user.nim)}`),
    ]);
    return { grades: gradeResponse.data || [], transcript };
  }, [session.user.nim]);
  const { data, loading, error, reload } = useApiResource(load, [load]);
  const grades = data?.grades || [];
  const scores = grades.map(grade => Number(grade.score)).filter(Number.isFinite);
  const average = scores.length ? formatScore(scores.reduce((total, score) => total + score, 0) / scores.length) : '—';

  return (
    <>
      <PageHeading eyebrow="DASHBOARD MAHASISWA" title={`Selamat datang, ${session.user.name.split(' ')[0]}`} description="Berikut ringkasan akademik yang terhubung ke data Anda." />
      <div className="metric-grid">
        <MetricCard label="Mata kuliah bernilai" value={loading ? '—' : grades.length} detail="Data dari Service Nilai" icon="book" />
        <MetricCard label="Rata-rata nilai" value={loading ? '—' : average} detail="Dihitung dari nilai yang tersedia" icon="grades" accent="violet" />
        <MetricCard label="Transkrip tercatat" value={loading ? '—' : (data?.transcript?.transkrip?.length ?? 0)} detail="Data dari Service Transkrip" icon="transcript" accent="green" />
      </div>
      <div className="dashboard-grid dashboard-grid-main">
        <Panel title="Nilai terbaru" description="Mata kuliah yang tercatat untuk akun Anda." action={<button className="text-button" type="button" onClick={() => setPage('grades')}>Lihat semua <Icon name="arrow" size={15} /></button>}>
          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <Table columns={gradeColumns().filter(column => column.key !== 'nim')} rows={grades.slice(0, 5)} />}
        </Panel>
        <Panel title="Identitas mahasiswa" description="Profil yang dikembalikan oleh Gateway.">
          <div className="identity-card">
            <span className="identity-avatar">{session.user.name.slice(0, 1).toUpperCase()}</span>
            <div><strong>{session.user.name}</strong><small>Mahasiswa Informatika</small></div>
          </div>
          <div className="identity-details"><span>NIM</span><strong>{session.user.nim || '—'}</strong><span>Status sesi</span><strong><span className="status-dot" /> Aktif dan terverifikasi</strong></div>
          <button className="button button-secondary identity-button" type="button" onClick={() => setPage('security')}>Lihat informasi keamanan <Icon name="arrow" size={15} /></button>
        </Panel>
      </div>
    </>
  );
}

function StudentGrades() {
  const { data, loading, error, reload } = useGrades();
  return (
    <>
      <PageHeading eyebrow="AKADEMIK / NILAI" title="Nilai Saya" description="Nilai yang ditampilkan dibatasi oleh Gateway untuk akun mahasiswa yang sedang masuk." />
      <Panel title="Daftar nilai" description={`${data?.length ?? 0} mata kuliah tercatat`}>
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <Table columns={gradeColumns().filter(column => column.key !== 'nim')} rows={data || []} emptyTitle="Belum ada nilai" emptyMessage="Nilai akan muncul setelah tersedia untuk akun Anda." />}
      </Panel>
    </>
  );
}

function StudentTranscript({ session }) {
  const load = useCallback(async () => apiRequest(`/transkrip/${encodeURIComponent(session.user.nim)}`), [session.user.nim]);
  const { data, loading, error, reload } = useApiResource(load, [load]);
  const items = data?.transkrip || [];
  const average = items.length ? formatScore(items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length) : '—';
  return (
    <>
      <PageHeading eyebrow="AKADEMIK / TRANSKRIP" title="Transkrip Akademik" description="Transkrip hanya diminta untuk NIM akun Anda dari API Gateway." />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <section className="transcript-banner">
            <div className="transcript-banner-mark"><Icon name="transcript" size={24} /></div>
            <div><span>TRANSKRIP MAHASISWA</span><h2>{data?.nama || session.user.name}</h2><p>NIM {data?.nim || session.user.nim || '—'}</p></div>
            <div className="transcript-updated"><small>Pembaruan terakhir</small><strong>{formatDate(data?.updatedAt, true)}</strong></div>
          </section>
          <div className="metric-grid metric-grid-compact">
            <MetricCard label="Mata kuliah" value={items.length} detail="Tercatat pada transkrip" icon="book" />
            <MetricCard label="Rata-rata nilai" value={average} detail="Dihitung dari data transkrip" icon="grades" accent="violet" />
          </div>
          <Panel title="Rincian transkrip" description="Nilai yang sudah disinkronkan setelah finalisasi kelas.">
            <Table columns={[
              { key: 'classCode', label: 'Kode' },
              { key: 'className', label: 'Mata kuliah' },
              { key: 'score', label: 'Nilai', render: item => <strong className="score-value">{formatScore(item.score)}</strong> },
            ]} rows={items} emptyTitle="Transkrip masih kosong" emptyMessage="Transkrip akan terisi setelah dosen memfinalisasi nilai kelas." />
          </Panel>
        </>
      )}
    </>
  );
}

function TeacherDashboard({ session, setPage }) {
  const { data, loading, error, reload } = useGrades();
  const classes = useMemo(() => getClasses(data || []), [data]);
  const studentCount = new Set((data || []).map(row => row.student_id).filter(Boolean)).size;
  const pendingCount = classes.filter(item => !Number(item.finalized)).length;
  return (
    <>
      <PageHeading eyebrow="DASHBOARD DOSEN" title={`Selamat datang, ${session.user.name.split(' ')[0]}`} description="Kelola nilai hanya pada kelas yang tercatat sebagai kelas ampuan Anda." />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="metric-grid">
            <MetricCard label="Kelas diampu" value={classes.length} detail="Berdasarkan data Service Nilai" icon="classes" />
            <MetricCard label="Mahasiswa dengan nilai" value={studentCount} detail="Mahasiswa unik pada kelas ampuan" icon="users" accent="violet" />
            <MetricCard label="Belum difinalisasi" value={pendingCount} detail="Kelas yang masih dapat dikelola" icon="activity" accent="amber" />
          </div>
          <div className="dashboard-grid dashboard-grid-main">
            <Panel title="Kelas yang Anda ampu" description="Status kelas diperoleh dari nilai backend." action={<button className="text-button" type="button" onClick={() => setPage('classes')}>Semua kelas <Icon name="arrow" size={15} /></button>}>
              <ClassCards classes={classes.slice(0, 4)} onManage={() => setPage('manage')} />
            </Panel>
            <Panel title="Ruang kerja" description="Aksi yang tersedia mengikuti kebijakan Gateway.">
              <div className="action-list">
                <button type="button" className="action-list-item" onClick={() => setPage('manage')}><span className="action-list-icon action-blue"><Icon name="grades" /></span><span><strong>Kelola nilai</strong><small>Perbarui nilai kelas ampuan</small></span><Icon name="arrow" size={16} /></button>
                <button type="button" className="action-list-item" onClick={() => setPage('finalize')}><span className="action-list-icon action-green"><Icon name="check" /></span><span><strong>Finalisasi kelas</strong><small>Sinkronkan nilai ke transkrip</small></span><Icon name="arrow" size={16} /></button>
              </div>
              <div className="notice notice-neutral"><Icon name="shield" size={16} /><span>Jam akses dan hak pengampu tetap diputuskan oleh backend.</span></div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function ClassCards({ classes, onManage }) {
  if (!classes.length) return <EmptyState title="Belum ada kelas" message="Tidak ada data kelas yang dapat ditampilkan untuk akun ini." icon="classes" />;
  return (
    <div className="class-card-list">
      {classes.map(item => (
        <article className="class-card" key={item.id}>
          <div className="class-card-top"><span className="class-code">{item.code}</span><StatusBadge finalized={item.finalized} /></div>
          <h3>{item.name}</h3>
          <div className="class-card-meta"><span><Icon name="users" size={15} /> {item.studentCount || item.gradeCount} mahasiswa</span><span>{item.gradeCount} nilai</span></div>
          <button className="class-card-link" type="button" onClick={onManage}>Kelola kelas <Icon name="arrow" size={15} /></button>
        </article>
      ))}
    </div>
  );
}

function TeacherClasses({ setPage }) {
  const { data, loading, error, reload } = useGrades();
  const classes = useMemo(() => getClasses(data || []), [data]);
  return (
    <>
      <PageHeading eyebrow="RUANG DOSEN / KELAS" title="Kelas Saya" description="Daftar kelas dibentuk dari data nilai yang dikembalikan untuk dosen ini." />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : <ClassCards classes={classes} onManage={() => setPage('manage')} />}
    </>
  );
}

function GradeManagement({ notify }) {
  const { data, loading, error, reload } = useGrades();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [confirmGrade, setConfirmGrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const classes = useMemo(() => getClasses(data || []), [data]);
  const activeClass = selectedClassId || classes[0]?.id || '';
  const rows = (data || []).filter(row => row.class_id === activeClass);

  async function saveGrade() {
    if (!confirmGrade) return;
    const score = Number(drafts[confirmGrade.id] ?? confirmGrade.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      notify('Nilai harus berupa angka dari 0 sampai 100.', 'error');
      setConfirmGrade(null);
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest(`/nilai/${confirmGrade.id}`, { method: 'PUT', body: { score } });
      notify(result?.message || 'Nilai berhasil diperbarui.');
      setConfirmGrade(null);
      setDrafts(current => ({ ...current, [confirmGrade.id]: String(result.score) }));
      await reload();
    } catch (requestError) {
      notify(requestError.message, 'error');
      setConfirmGrade(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="RUANG DOSEN / PENILAIAN" title="Kelola Nilai" description="Perubahan dikirim ke Gateway dan divalidasi ulang terhadap kelas ampuan, status final, dan jam akses." action={classes.length ? <label className="select-label">Kelas<select value={activeClass} onChange={event => setSelectedClassId(event.target.value)}>{classes.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label> : null} />
      <Panel title={classes.find(item => item.id === activeClass)?.name || 'Daftar nilai'} description="Simpan perubahan satu per satu. Nilai final bersifat terkunci.">
        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? <EmptyState title="Tidak ada nilai" message="Belum ada data nilai pada kelas ini." /> : (
          <div className="table-scroll"><table className="data-table manage-table"><thead><tr><th>Mahasiswa</th><th>NIM</th><th>Nilai</th><th>Status</th><th className="align-right">Aksi</th></tr></thead>
            <tbody>{rows.map(row => {
              const finalized = Number(row.finalized) === 1;
              const value = drafts[row.id] ?? String(row.score ?? '');
              const changed = value !== String(row.score ?? '');
              return <tr key={row.id}>
                <td><span className="student-name-cell"><span className="avatar avatar-table">{row.full_name?.slice(0, 1) || 'M'}</span><strong>{row.full_name}</strong></span></td>
                <td className="muted">{row.nim}</td>
                <td><input className="score-input" type="number" min="0" max="100" step="0.1" value={value} disabled={finalized} onChange={event => setDrafts(current => ({ ...current, [row.id]: event.target.value }))} aria-label={`Nilai ${row.full_name}`} /></td>
                <td><StatusBadge finalized={row.finalized} /></td>
                <td className="align-right"><button className="button button-small button-primary" type="button" disabled={finalized || !changed} onClick={() => setConfirmGrade(row)}>Simpan</button></td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </Panel>
      <div className="notice notice-neutral page-note"><Icon name="lock" size={16} /><span>Perubahan hanya berhasil jika kebijakan backend mengizinkan. Hak akses tidak ditentukan oleh antarmuka.</span></div>
      {confirmGrade ? <ConfirmDialog title="Simpan perubahan nilai?" message={`Nilai ${confirmGrade.full_name} akan diperbarui menjadi ${formatScore(drafts[confirmGrade.id] ?? confirmGrade.score)}. Gateway akan memeriksa ulang hak akses.`} confirmLabel="Simpan nilai" busy={saving} onConfirm={saveGrade} onClose={() => setConfirmGrade(null)} /> : null}
    </>
  );
}

function GradeFinalization({ notify }) {
  const { data, loading, error, reload } = useGrades();
  const [pendingClass, setPendingClass] = useState(null);
  const [saving, setSaving] = useState(false);
  const classes = useMemo(() => getClasses(data || []), [data]);

  async function finalize() {
    if (!pendingClass) return;
    setSaving(true);
    try {
      const result = await apiRequest(`/kelas/${encodeURIComponent(pendingClass.id)}/finalisasi`, { method: 'POST', body: {} });
      const synced = result?.sync?.count;
      notify(synced === undefined ? result?.message || 'Kelas berhasil difinalisasi.' : `Kelas difinalisasi. Sinkronisasi transkrip berhasil untuk ${synced} mahasiswa.`);
      setPendingClass(null);
      await reload();
    } catch (requestError) {
      notify(requestError.message, 'error');
      setPendingClass(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="RUANG DOSEN / FINALISASI" title="Finalisasi Nilai" description="Finalisasi mengunci kelas dan meminta backend menyinkronkan nilai ke transkrip." />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : !classes.length ? <EmptyState title="Belum ada kelas" message="Kelas ampuan akan muncul ketika data nilai tersedia." icon="classes" /> : (
        <div className="finalize-grid">
          {classes.map(item => {
            const finalized = Number(item.finalized) === 1;
            return <article className="finalize-card" key={item.id}>
              <div className="finalize-card-top"><span className="class-code">{item.code}</span><StatusBadge finalized={item.finalized} /></div>
              <h2>{item.name}</h2>
              <div className="finalize-stats"><span><Icon name="users" size={15} /> {item.studentCount || item.gradeCount} mahasiswa</span><span><Icon name="grades" size={15} /> {item.gradeCount} nilai</span></div>
              <button className={`button ${finalized ? 'button-secondary' : 'button-primary'} finalize-button`} type="button" disabled={finalized} onClick={() => setPendingClass(item)}>
                <Icon name={finalized ? 'check' : 'lock'} size={16} />{finalized ? 'Sudah difinalisasi' : 'Finalisasi kelas'}
              </button>
              {finalized ? <p className="finalized-note">Nilai kelas telah dikunci oleh backend.</p> : <p className="muted-note">Gateway akan memeriksa pengampu dan jam akses sebelum proses.</p>}
            </article>;
          })}
        </div>
      )}
      {pendingClass ? <ConfirmDialog title={`Finalisasi ${pendingClass.code}?`} message="Nilai kelas akan dikunci. Service Nilai akan meminta sinkronisasi transkrip melalui Gateway; tindakan ini tidak dapat dibatalkan dari dashboard." confirmLabel="Ya, finalisasi" busy={saving} onConfirm={finalize} onClose={() => setPendingClass(null)} /> : null}
    </>
  );
}

function AuditTable({ rows }) {
  const items = (rows || []).slice(0, 20);
  return <Table columns={[
    { key: 'occurred_at', label: 'Waktu', render: row => formatDate(row.occurred_at, true) },
    { key: 'subject', label: 'Subject', render: row => <span className="mono-text">{row.subject || '—'}</span> },
    { key: 'endpoint', label: 'Endpoint', render: row => <span className="mono-text">{row.method} {row.endpoint}</span> },
    { key: 'device_id', label: 'Device', render: row => <span className="mono-text">{row.device_id || '—'}</span> },
    { key: 'decision', label: 'Keputusan', render: row => <span className={`decision-badge ${row.decision === 'allow' ? 'decision-allow' : 'decision-deny'}`}><i />{row.decision === 'allow' ? 'Diizinkan' : 'Ditolak'}</span> },
    { key: 'reason', label: 'Alasan' },
  ]} rows={items} emptyTitle="Belum ada aktivitas" emptyMessage="Belum ada catatan audit yang dikembalikan Gateway." />;
}

function AdminDashboard() {
  const load = useCallback(async () => apiRequest('/admin/audit'), []);
  const { data, loading, error, reload } = useApiResource(load, [load]);
  const rows = data?.data || [];
  const allowed = rows.filter(row => row.decision === 'allow').length;
  const denied = rows.filter(row => row.decision === 'deny').length;
  return (
    <>
      <PageHeading eyebrow="DASHBOARD ADMIN" title="Ringkasan Sistem" description="Aktivitas yang ditampilkan berasal dari audit log Gateway. Statistik mahasiswa tidak tersedia dari endpoint backend saat ini." />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="metric-grid">
            <MetricCard label="Catatan audit terbaru" value={rows.length} detail="Maksimum 200 event dari Gateway" icon="activity" />
            <MetricCard label="Keputusan allow" value={allowed} detail="Pada catatan yang dimuat" icon="check" accent="green" />
            <MetricCard label="Keputusan deny" value={denied} detail="Pada catatan yang dimuat" icon="shield" accent="amber" />
          </div>
          <Panel title="Aktivitas keamanan" description="Data asli dari `GET /admin/audit`.">
            <AuditTable rows={rows} />
          </Panel>
        </>
      )}
    </>
  );
}

function AdminTranscripts() {
  const [nim, setNim] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(event) {
    event.preventDefault();
    const normalizedNim = nim.trim();
    if (!normalizedNim) return;
    setLoading(true);
    setError('');
    setTranscript(null);
    try {
      setTranscript(await apiRequest(`/transkrip/${encodeURIComponent(normalizedNim)}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="ADMINISTRATOR / DATA AKADEMIK" title="Data Transkrip" description="Admin dapat memeriksa transkrip mahasiswa melalui endpoint yang disediakan Gateway." />
      <Panel title="Cari transkrip" description="Masukkan NIM untuk mengambil data dari `GET /transkrip/:nim`.">
        <form className="search-form" onSubmit={search}>
          <label className="search-input-wrap"><Icon name="search" size={18} /><input value={nim} onChange={event => setNim(event.target.value)} placeholder="Cari berdasarkan NIM" inputMode="numeric" aria-label="NIM mahasiswa" /></label>
          <button className="button button-primary" type="submit" disabled={loading || !nim.trim()}>{loading ? <span className="spinner spinner-light" /> : <Icon name="search" size={16} />}{loading ? 'Mencari…' : 'Cari transkrip'}</button>
        </form>
        <div className="notice notice-neutral search-note"><Icon name="activity" size={16} /><span>Backend belum menyediakan endpoint daftar mahasiswa atau pencarian berdasarkan nama. Halaman ini mencari satu NIM agar tidak menampilkan data buatan.</span></div>
      </Panel>
      {loading ? <LoadingState label="Meminta transkrip melalui Gateway…" /> : error ? <ErrorState message={error} onRetry={() => search({ preventDefault() {} })} /> : transcript ? (
        <Panel title="Hasil transkrip" description="Informasi mahasiswa dan nilai berasal dari Service Transkrip melalui Gateway.">
          <div className="transcript-result-head"><span className="avatar avatar-large">{transcript.nama?.slice(0, 1) || 'M'}</span><span><strong>{transcript.nama}</strong><small>NIM {transcript.nim}</small></span><span className="updated-chip">Diperbarui {formatDate(transcript.updatedAt)}</span></div>
          <Table columns={[
            { key: 'classCode', label: 'Kode' },
            { key: 'className', label: 'Mata kuliah' },
            { key: 'score', label: 'Nilai', render: row => <strong className="score-value">{formatScore(row.score)}</strong> },
          ]} rows={transcript.transkrip || []} emptyTitle="Belum ada nilai dalam transkrip" emptyMessage="Mahasiswa ini belum memiliki kelas yang disinkronkan." />
        </Panel>
      ) : <div className="search-placeholder"><span className="empty-icon"><Icon name="transcript" size={22} /></span><strong>Pilih transkrip mahasiswa</strong><p>Masukkan NIM untuk melihat data yang diizinkan oleh backend.</p></div>}
    </>
  );
}

function accessState(event) {
  if (event.status === null) return { label: 'Gateway tidak terjangkau', className: 'decision-deny' };
  if (event.allowed) return { label: 'Akses diberikan', className: 'decision-allow' };
  if (event.status === 401) return { label: 'Token atau autentikasi tidak valid', className: 'decision-deny' };
  if (event.status === 403 && /device/i.test(event.message)) return { label: 'Perangkat tidak terdaftar', className: 'decision-deny' };
  if (event.status === 403 && /07\.00|21\.00/i.test(event.message)) return { label: 'Di luar jam akses', className: 'decision-deny' };
  if (event.status === 403) return { label: 'Akses ditolak oleh kebijakan', className: 'decision-deny' };
  return { label: `Ditolak (${event.status})`, className: 'decision-deny' };
}

function SecurityPage({ session, accessEvents }) {
  const loadHealth = useCallback(() => apiRequest('/health', { auth: false }), []);
  const health = useApiResource(loadHealth, [loadHealth]);
  const expiry = decodeTokenExpiry(session.accessToken);
  const tokenIsUnexpired = expiry && expiry.getTime() > Date.now();
  const roleLabel = roleLabels[session.user.role] || session.user.role;
  const admin = session.user.role === 'admin';
  const auditLoad = useCallback(() => admin ? apiRequest('/admin/audit') : Promise.resolve({ data: [] }), [admin]);
  const audit = useApiResource(auditLoad, [auditLoad]);

  return (
    <>
      <PageHeading eyebrow="KEAMANAN AKADEMIK" title="Informasi Keamanan" description="Status sesi dan hasil permintaan ditampilkan dari identitas lokal dan respons aktual Gateway." />
      <div className="security-grid">
        <Panel title="Sesi terautentikasi" description="Informasi identitas dari respons login dan token sesi.">
          <div className="security-identity">
            <span className="identity-avatar"><Icon name="shield" size={22} /></span>
            <span><strong>{session.user.name}</strong><small>{session.user.username}</small></span>
            <span className="status-badge status-success"><i />Terverifikasi</span>
          </div>
          <div className="security-facts">
            <div><span>Role</span><strong>{roleLabel}</strong></div>
            {session.user.nim ? <div><span>NIM</span><strong>{session.user.nim}</strong></div> : null}
            <div><span>Device ID</span><strong className="mono-text">{session.deviceId}</strong></div>
            <div><span>Perkiraan status token</span><strong><span className={`status-dot ${tokenIsUnexpired ? '' : 'status-dot-expired'}`} />{tokenIsUnexpired ? 'Belum kedaluwarsa' : 'Perlu diperbarui'}</strong></div>
            <div><span>Perkiraan kedaluwarsa access token</span><strong>{formatDate(expiry, true)}</strong></div>
            <div><span>Koneksi API Gateway</span><strong>{health.loading ? 'Memeriksa…' : health.error ? <span className="text-danger">Tidak terhubung</span> : <span className="text-success">Terhubung · {health.data?.service}</span>}</strong></div>
          </div>
          {health.error ? <div className="security-health-error"><span>{health.error}</span><button className="text-button" type="button" onClick={health.reload}>Coba lagi</button></div> : null}
          <div className="notice notice-blue"><Icon name="shield" size={17} /><span>Setiap request operasional dikirim ke Gateway untuk pemeriksaan Policy Engine.</span></div>
          <p className="token-note">Waktu expiry dibaca dari klaim JWT untuk informasi saja; backend tetap memverifikasi token pada setiap request.</p>
        </Panel>
        <Panel title="Prinsip Zero Trust" description="Kontrol diterapkan oleh backend, bukan hanya oleh antarmuka.">
          <div className="principle-list">
            <article><span className="principle-number">01</span><div><h3>Never Trust, Always Verify</h3><p>JWT, masa berlaku, dan device diverifikasi pada request; service memeriksa token kembali.</p></div></article>
            <article><span className="principle-number">02</span><div><h3>Least Privilege</h3><p>Role dan kepemilikan data menentukan akses sesuai kebijakan di Gateway dan service.</p></div></article>
            <article><span className="principle-number">03</span><div><h3>Assume Breach</h3><p>Service lokal tetap membutuhkan gateway secret dan token yang valid.</p></div></article>
          </div>
        </Panel>
      </div>

      <Panel title="Status akses sesi ini" description="Feedback berasal dari status HTTP dan pesan yang diterima dari Gateway.">
        {!accessEvents.length ? <EmptyState title="Belum ada request" message="Status request akan muncul di sini setelah Anda menggunakan dashboard." icon="activity" /> : (
          <div className="access-event-list">
            {accessEvents.slice(0, 8).map(event => {
              const state = accessState(event);
              return <article className="access-event" key={event.id}>
                <span className={`decision-icon ${event.allowed ? 'decision-icon-allow' : 'decision-icon-deny'}`}><Icon name={event.allowed ? 'check' : 'close'} size={16} /></span>
                <span className="access-event-main"><strong>{state.label}</strong><small className="mono-text">{event.endpoint}</small><small>{event.message}</small></span>
                <span className={`decision-badge ${state.className}`}><i />{event.status === null ? 'Offline' : `HTTP ${event.status}`}</span>
                <time>{formatDate(event.createdAt, true)}</time>
              </article>;
            })}
          </div>
        )}
      </Panel>

      {admin ? <Panel title="Audit log Gateway" description={audit.error ? 'Audit log tidak dapat dimuat.' : 'Data nyata dari endpoint admin, maksimal 200 catatan terbaru.'}>
        {audit.loading ? <LoadingState /> : audit.error ? <ErrorState message={audit.error} onRetry={audit.reload} /> : <AuditTable rows={audit.data?.data || []} />}
      </Panel> : <div className="notice notice-neutral page-note"><Icon name="lock" size={16} /><span>Audit log lengkap hanya tersedia untuk Admin melalui `GET /admin/audit`; halaman ini tidak membuat log tiruan.</span></div>}
    </>
  );
}

export function RolePage({ page, session, setPage, notify, accessEvents }) {
  if (page === 'security') return <SecurityPage session={session} accessEvents={accessEvents} />;
  if (session.user.role === 'mahasiswa') {
    if (page === 'grades') return <StudentGrades />;
    if (page === 'transcript') return <StudentTranscript session={session} />;
    return <StudentDashboard session={session} setPage={setPage} />;
  }
  if (session.user.role === 'dosen') {
    if (page === 'classes') return <TeacherClasses setPage={setPage} />;
    if (page === 'manage') return <GradeManagement notify={notify} />;
    if (page === 'finalize') return <GradeFinalization notify={notify} />;
    return <TeacherDashboard session={session} setPage={setPage} />;
  }
  if (session.user.role === 'admin') {
    if (page === 'transcripts') return <AdminTranscripts />;
    return <AdminDashboard />;
  }
  return <EmptyState title="Role tidak dikenal" message="Akun ini tidak memiliki dashboard yang tersedia." icon="shield" />;
}
