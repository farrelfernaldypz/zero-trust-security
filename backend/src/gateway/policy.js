const db = require('../shared/db');
const { isWithinAccessHours } = require('../shared/access-window');
function evaluate({method,path,identity,body}) {
  const denied = reason => ({allow:false,reason});
  if (path === '/transkrip/sinkron' && method === 'POST') return identity?.typ === 'service' && identity.role === 'service' ? {allow:true,reason:'Token service valid untuk sinkronisasi.'} : denied('Sinkronisasi hanya untuk token service.');
  if (path === '/nilai' && method === 'GET') return ['mahasiswa','dosen'].includes(identity?.role) ? {allow:true,reason:identity.role === 'mahasiswa' ? 'Mahasiswa melihat nilai sendiri.' : 'Dosen melihat nilai kelas ampuan.'} : denied('Role tidak diizinkan melihat nilai.');
  const gradeMatch = path.match(/^\/nilai\/(\d+)$/);
  if (gradeMatch && method === 'PUT') {
    if (identity?.role !== 'dosen') return denied('Hanya dosen yang dapat mengubah nilai.');
    if (!isWithinAccessHours()) return denied('Perubahan nilai hanya diizinkan pukul 07.00–21.00.');
    const grade = db.prepare('SELECT c.lecturer_id,c.finalized FROM grades g JOIN classes c ON c.id=g.class_id WHERE g.id=?').get(Number(gradeMatch[1]));
    if (!grade) return denied('Nilai tidak ditemukan.');
    if (grade.lecturer_id !== identity.sub) return denied('Kelas bukan ampuan dosen ini.');
    if (grade.finalized) return denied('Kelas telah difinalisasi.');
    return {allow:true,reason:'Dosen pengampu, nilai belum final.'};
  }
  const finalMatch = path.match(/^\/kelas\/([\w-]+)\/finalisasi$/);
  if (finalMatch && method === 'POST') {
    if (identity?.role !== 'dosen') return denied('Hanya dosen yang dapat memfinalisasi kelas.');
    if (!isWithinAccessHours()) return denied('Finalisasi hanya diizinkan pukul 07.00–21.00.');
    const klass = db.prepare('SELECT lecturer_id,finalized FROM classes WHERE id=?').get(finalMatch[1]);
    if (!klass) return denied('Kelas tidak ditemukan.');
    if (klass.lecturer_id !== identity.sub) return denied('Kelas bukan ampuan dosen ini.');
    if (klass.finalized) return denied('Kelas telah difinalisasi.');
    return {allow:true,reason:'Dosen pengampu kelas; jam akses diverifikasi service.'};
  }
  const transcriptMatch = path.match(/^\/transkrip\/([\d]+)$/);
  if (transcriptMatch && method === 'GET') {
    const student = db.prepare("SELECT id FROM users WHERE nim=? AND role='mahasiswa'").get(transcriptMatch[1]);
    if (!student) return denied('Mahasiswa tidak ditemukan.');
    if (identity?.role === 'admin') return {allow:true,reason:'Admin dapat melihat transkrip semua mahasiswa.'};
    if (identity?.role === 'mahasiswa' && identity.sub === student.id) return {allow:true,reason:'Mahasiswa melihat transkrip sendiri.'};
    return denied('Mahasiswa hanya dapat melihat transkrip sendiri; role tidak diizinkan.');
  }
  return denied('Endpoint atau metode tidak tersedia.');
}
module.exports = { evaluate };


