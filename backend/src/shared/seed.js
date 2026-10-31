const bcrypt = require('bcryptjs');
const db = require('./db');
const users = [
  ['admin-1','admin','Admin Informatika','Admin123!','admin',null,'device-admin-001'],
  ['dosen-1','dosen1','Dr. Dosen Satu','Dosen123!','dosen',null,'device-dosen-001'],
  ['dosen-2','dosen2','Dr. Dosen Dua','Dosen123!','dosen',null,'device-dosen-002'],
  ['mhs-1','mhs1','Mahasiswa Satu','Mhs123!','mahasiswa','227006001','device-mhs-001'],
  ['mhs-2','mhs2','Mahasiswa Dua','Mhs123!','mahasiswa','227006002','device-mhs-002'],
  ['mhs-3','mhs3','Mahasiswa Tiga','Mhs123!','mahasiswa','227006003','device-mhs-003']
];
const addUser = db.prepare('INSERT OR IGNORE INTO users(id,username,full_name,password_hash,role,nim) VALUES(?,?,?,?,?,?)');
const addDevice = db.prepare('INSERT OR IGNORE INTO devices(user_id,device_id) VALUES(?,?)');
for (const [id, username, name, password, role, nim, device] of users) {
  addUser.run(id, username, name, bcrypt.hashSync(password, 10), role, nim);
  addDevice.run(id, device);
}
const addClass = db.prepare('INSERT OR IGNORE INTO classes(id,code,name,lecturer_id,finalized) VALUES(?,?,?,?,0)');
addClass.run('if101','IF101','Algoritma dan Pemrograman','dosen-1');
addClass.run('if102','IF102','Keamanan Informasi','dosen-2');
const addGrade = db.prepare('INSERT OR IGNORE INTO grades(class_id,student_id,score) VALUES(?,?,?)');
[['if101','mhs-1',85],['if101','mhs-2',90],['if101','mhs-3',78],['if102','mhs-1',88],['if102','mhs-2',82],['if102','mhs-3',91]].forEach(row => addGrade.run(...row));
const addTranscript = db.prepare("INSERT OR IGNORE INTO transcripts(student_id,data,updated_at) VALUES(?,'[]',?)");
for (const id of ['mhs-1','mhs-2','mhs-3']) { addTranscript.run(id, new Date().toISOString()); }
console.log(`Database siap di ${process.env.DB_PATH || './data/zero-trust.sqlite'}; ${users.length} user, 2 kelas, 6 nilai demo.`);
