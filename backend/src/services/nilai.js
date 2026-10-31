const express = require('express');
const { db, requireGateway, withinAccessHours } = require('./common');
const app = express(); app.use(express.json({ limit: '32kb' }));
app.use(requireGateway);
app.get('/health', (_req,res) => res.json({ service:'nilai', status:'ok' }));
app.get('/nilai', (req,res) => {
  const user = req.identity;
  if (user.role === 'mahasiswa') {
    return res.json({ data: db.prepare('SELECT g.id,c.id AS class_id,c.code,c.name AS class_name,g.score,c.finalized FROM grades g JOIN classes c ON c.id=g.class_id WHERE g.student_id=? ORDER BY c.code').all(user.sub) });
  }
  if (user.role === 'dosen') {
    return res.json({ data: db.prepare('SELECT g.id,c.id AS class_id,c.code,c.name AS class_name,g.student_id,u.nim,u.full_name,g.score,c.finalized FROM grades g JOIN classes c ON c.id=g.class_id JOIN users u ON u.id=g.student_id WHERE c.lecturer_id=? ORDER BY c.code,u.nim').all(user.sub) });
  }
  return res.status(403).json({ error:'Role tidak dapat melihat nilai.' });
});
app.put('/nilai/:id', (req,res) => {
  if (req.identity.role !== 'dosen') return res.status(403).json({ error:'Hanya dosen yang dapat mengubah nilai.' });
  const score = req.body?.score;
  if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ error:'score harus berupa angka 0 sampai 100.' });
  if (!withinAccessHours()) return res.status(403).json({ error:'Perubahan nilai hanya diizinkan pukul 07.00–21.00.' });
  const grade = db.prepare('SELECT g.id,c.lecturer_id,c.finalized FROM grades g JOIN classes c ON c.id=g.class_id WHERE g.id=?').get(req.params.id);
  if (!grade) return res.status(404).json({ error:'Nilai tidak ditemukan.' });
  if (grade.lecturer_id !== req.identity.sub) return res.status(403).json({ error:'Kelas ini bukan kelas yang Anda ampu.' });
  if (grade.finalized) return res.status(409).json({ error:'Nilai kelas telah difinalisasi.' });
  db.prepare('UPDATE grades SET score=? WHERE id=?').run(score, grade.id);
  res.json({ message:'Nilai berhasil diperbarui.', id:grade.id, score });
});
app.post('/kelas/:id/finalisasi', async (req,res) => {
  if (req.identity.role !== 'dosen') return res.status(403).json({ error:'Hanya dosen yang dapat memfinalisasi kelas.' });
  if (!withinAccessHours()) return res.status(403).json({ error:'Finalisasi hanya diizinkan pukul 07.00–21.00.' });
  const klass = db.prepare('SELECT * FROM classes WHERE id=?').get(req.params.id);
  if (!klass) return res.status(404).json({ error:'Kelas tidak ditemukan.' });
  if (klass.lecturer_id !== req.identity.sub) return res.status(403).json({ error:'Kelas ini bukan kelas yang Anda ampu.' });
  if (klass.finalized) return res.status(409).json({ error:'Kelas telah difinalisasi.' });
  db.prepare('UPDATE classes SET finalized=1 WHERE id=?').run(klass.id);
  try {
    const authResponse = await fetch(`${process.env.GATEWAY_URL || 'http://localhost:3000'}/auth/service`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({clientId:process.env.SERVICE_CLIENT_ID,clientSecret:process.env.SERVICE_CLIENT_SECRET}) });
    if (!authResponse.ok) throw new Error(`Token service gagal (${authResponse.status}).`);
    const { accessToken } = await authResponse.json();
    const grades = db.prepare('SELECT u.nim,g.score FROM grades g JOIN users u ON u.id=g.student_id WHERE g.class_id=?').all(klass.id);
    const syncResponse = await fetch(`${process.env.GATEWAY_URL || 'http://localhost:3000'}/transkrip/sinkron`, { method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${accessToken}`}, body:JSON.stringify({classId:klass.id,classCode:klass.code,className:klass.name,grades}) });
    const body = await syncResponse.json();
    if (!syncResponse.ok) throw new Error(body.error || `Sinkronisasi gagal (${syncResponse.status}).`);
    return res.json({ message:'Kelas difinalisasi dan transkrip tersinkron.', classId:klass.id, sync:body });
  } catch (error) {
    db.prepare('UPDATE classes SET finalized=0 WHERE id=?').run(klass.id);
    return res.status(502).json({ error:'Finalisasi dibatalkan karena sinkronisasi transkrip gagal.', detail:error.message, retry:'Perbaiki ketersediaan gateway/transkrip lalu ulangi finalisasi.' });
  }
});
app.listen(Number(process.env.PORT_NILAI || 3001), () => console.log(`Service Nilai aktif pada port ${process.env.PORT_NILAI || 3001}`));

