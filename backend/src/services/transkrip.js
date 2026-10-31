const express = require('express');
const { db, requireGateway, requireService } = require('./common');
const app = express(); app.use(express.json({ limit:'32kb' }));
app.use(requireGateway);
app.get('/health', (_req,res) => res.json({ service:'transkrip', status:'ok' }));
app.get('/transkrip/:nim', (req,res) => {
  const user = req.identity;
  const target = db.prepare('SELECT id,nim,full_name FROM users WHERE nim=? AND role=\'mahasiswa\'').get(req.params.nim);
  if (!target) return res.status(404).json({error:'Mahasiswa tidak ditemukan.'});
  if (user.role === 'mahasiswa' && user.sub !== target.id) return res.status(403).json({error:'Mahasiswa hanya dapat melihat transkrip miliknya.'});
  if (!['mahasiswa','admin'].includes(user.role)) return res.status(403).json({error:'Role tidak dapat melihat transkrip.'});
  const row = db.prepare('SELECT data,updated_at FROM transcripts WHERE student_id=?').get(target.id);
  return res.json({nim:target.nim,nama:target.full_name,transkrip:JSON.parse(row?.data || '[]'),updatedAt:row?.updated_at || null});
});
app.post('/transkrip/sinkron', requireService, (req,res) => {
  const {classId,classCode,className,grades} = req.body || {};
  if (typeof classId !== 'string' || typeof classCode !== 'string' || typeof className !== 'string' || !Array.isArray(grades)) return res.status(400).json({error:'Payload sinkronisasi tidak valid.'});
  const update = db.prepare('UPDATE transcripts SET data=?,updated_at=? WHERE student_id=?');
  const tx = db.transaction(() => {
    for (const item of grades) {
      if (!item || typeof item.nim !== 'string' || !Number.isFinite(item.score)) throw new Error('Baris nilai tidak valid.');
      const student = db.prepare('SELECT id FROM users WHERE nim=? AND role=\'mahasiswa\'').get(item.nim);
      if (!student) throw new Error(`Mahasiswa ${item.nim} tidak dikenal.`);
      const row = db.prepare('SELECT data FROM transcripts WHERE student_id=?').get(student.id);
      const transcript = JSON.parse(row?.data || '[]').filter(entry => entry.classId !== classId);
      transcript.push({classId,classCode,className,score:item.score});
      update.run(JSON.stringify(transcript),new Date().toISOString(),student.id);
    }
  });
  try { tx(); return res.json({message:'Transkrip tersinkron.',classId,count:grades.length}); }
  catch (error) { return res.status(400).json({error:error.message}); }
});
app.listen(Number(process.env.PORT_TRANSKRIP || 3002), () => console.log(`Service Transkrip aktif pada port ${process.env.PORT_TRANSKRIP || 3002}`));
