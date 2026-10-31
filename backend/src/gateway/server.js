const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../shared/db');
const { issueUserToken, issueServiceToken, verifyToken, hashToken, bearer } = require('../shared/tokens');
const { evaluate } = require('./policy');
require('dotenv').config();
const app = express(); app.use(express.json({limit:'32kb'}));
const ports = { nilai:Number(process.env.PORT_NILAI || 3001), transkrip:Number(process.env.PORT_TRANSKRIP || 3002) };
const audit = db.prepare('INSERT INTO audit_logs(occurred_at,subject,endpoint,device_id,decision,reason,method) VALUES(?,?,?,?,?,?,?)');
function log(req, subject, decision, reason) { audit.run(new Date().toISOString(),subject,req.path,req.get('x-device-id') || null,decision,reason,req.method); }
function fail(res, status, error) { return res.status(status).json({error}); }
function getToken(req,type) { return verifyToken(bearer(req),type); }
function isDeviceRegistered(userId,deviceId) { return Boolean(deviceId && db.prepare('SELECT 1 FROM devices WHERE user_id=? AND device_id=?').get(userId,deviceId)); }
function getBody(req) { return JSON.stringify(req.body ?? {}); }
app.get('/health',(req,res)=>{ log(req,null,'allow','Health check gateway.'); return res.json({service:'gateway',status:'ok'}); });
app.post('/auth/login',(req,res)=>{
  const {username,password} = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !req.get('x-device-id')) { log(req,username || null,'deny','Kredensial atau X-Device-ID tidak lengkap.'); return fail(res,400,'username, password, dan X-Device-ID wajib diisi.'); }
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || !bcrypt.compareSync(password,user.password_hash)) { log(req,username,'deny','Kredensial tidak valid.'); return fail(res,401,'Username atau password salah.'); }
  if (!isDeviceRegistered(user.id,req.get('x-device-id'))) { log(req,user.id,'deny','Device tidak terdaftar.'); return fail(res,403,'Device tidak terdaftar untuk akun ini.'); }
  const accessToken = issueUserToken(user); const refreshToken = require('node:crypto').randomBytes(48).toString('base64url');
  db.prepare('INSERT INTO refresh_tokens(token_hash,user_id,expires_at,revoked_at) VALUES(?,?,?,NULL)').run(hashToken(refreshToken),user.id,Date.now()+Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 86400)*1000);
  log(req,user.id,'allow','Kredensial dan device valid.');
  return res.json({accessToken,refreshToken,tokenType:'Bearer',expiresIn:process.env.ACCESS_TOKEN_TTL || '10m',user:{id:user.id,username:user.username,name:user.full_name,role:user.role,nim:user.nim}});
});
app.post('/auth/refresh',(req,res)=>{
  const token = req.body?.refreshToken;
  if (typeof token !== 'string') { log(req,null,'deny','Refresh token tidak disertakan.'); return fail(res,400,'refreshToken wajib diisi.'); }
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash=?').get(hashToken(token));
  if (!row || row.revoked_at || row.expires_at <= Date.now()) { log(req,row?.user_id || null,'deny','Refresh token tidak valid, kedaluwarsa, atau dicabut.'); return fail(res,401,'Refresh token tidak valid atau telah dicabut/kedaluwarsa.'); }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(row.user_id);
  db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE token_hash=?').run(Date.now(),row.token_hash);
  const newRefresh = require('node:crypto').randomBytes(48).toString('base64url');
  db.prepare('INSERT INTO refresh_tokens(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(newRefresh),user.id,Date.now()+Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 86400)*1000);
  log(req,user.id,'allow','Refresh token valid; rotasi berhasil.');
  return res.json({accessToken:issueUserToken(user),refreshToken:newRefresh,tokenType:'Bearer',expiresIn:process.env.ACCESS_TOKEN_TTL || '10m'});
});
app.post('/auth/logout',(req,res)=>{
  const token = req.body?.refreshToken;
  if (typeof token !== 'string') { log(req,null,'deny','Refresh token tidak disertakan.'); return fail(res,400,'refreshToken wajib diisi.'); }
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash=?').get(hashToken(token));
  if (!row || row.revoked_at || row.expires_at <= Date.now()) { log(req,row?.user_id || null,'deny','Refresh token tidak valid atau telah dicabut.'); return fail(res,401,'Refresh token tidak valid atau telah dicabut.'); }
  db.prepare('UPDATE refresh_tokens SET revoked_at=? WHERE token_hash=?').run(Date.now(),row.token_hash);
  log(req,row.user_id,'allow','Refresh token dicabut.'); return res.json({message:'Logout berhasil; refresh token dicabut.'});
});
app.post('/auth/service',(req,res)=>{
  const valid = req.body?.clientId === process.env.SERVICE_CLIENT_ID && typeof process.env.SERVICE_CLIENT_SECRET === 'string' && bcryptSafeEqual(req.body?.clientSecret,process.env.SERVICE_CLIENT_SECRET);
  if (!valid) { log(req,req.body?.clientId || null,'deny','Kredensial service tidak valid.'); return fail(res,401,'Kredensial service tidak valid.'); }
  log(req,'nilai-service','allow','Kredensial service valid.'); return res.json({accessToken:issueServiceToken(),tokenType:'Bearer',expiresIn:process.env.SERVICE_TOKEN_TTL || '5m'});
});
function bcryptSafeEqual(actual,expected) {
  if (typeof actual !== 'string') { return false; }
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && require('node:crypto').timingSafeEqual(actualBuffer,expectedBuffer);
}
async function proxy(req,res) {
  let identity;
  try {
    const raw = bearer(req);
    identity = verifyToken(raw,'access');
  } catch {
    try { identity = verifyToken(bearer(req),'service'); }
    catch { log(req,null,'deny','Token hilang, tidak valid, kedaluwarsa, atau jenis token salah.'); return fail(res,401,'Access token tidak valid atau kedaluwarsa.'); }
  }
  const device = req.get('x-device-id');
  if (identity.typ === 'access' && !isDeviceRegistered(identity.sub,device)) { log(req,identity.sub,'deny','Device tidak terdaftar untuk pengguna.'); return fail(res,403,'X-Device-ID tidak terdaftar untuk pengguna ini.'); }
  if (identity.typ === 'service' && device) { /* service identity is separately authenticated by its signed token */ }
  const policy = evaluate({method:req.method,path:req.path,identity,body:req.body});
  if (!policy.allow) { log(req,identity.sub || identity.client_id,'deny',policy.reason); return fail(res,identity.typ === 'service' ? 403 : 403,policy.reason); }
  log(req,identity.sub || identity.client_id,'allow',policy.reason);
  const target = req.path.startsWith('/nilai') || req.path.startsWith('/kelas/') ? ports.nilai : ports.transkrip;
  try {
    const headers = {'x-gateway-secret':process.env.GATEWAY_SECRET,'authorization':req.get('authorization')};
    if (req.get('content-type')) headers['content-type']=req.get('content-type');
    if (device) headers['x-device-id']=device;
    const response = await fetch(`http://127.0.0.1:${target}${req.originalUrl}`,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:getBody(req)})});
    const contentType = response.headers.get('content-type'); if (contentType) res.set('content-type',contentType);
    return res.status(response.status).send(await response.text());
  } catch { return fail(res,502,'Service tujuan tidak tersedia. Pastikan semua service sudah berjalan.'); }
}
app.all(['/nilai','/nilai/:id','/kelas/:id/finalisasi','/transkrip/:nim','/transkrip/sinkron'],(req,res)=>proxy(req,res));
app.get('/admin/audit',(req,res)=>{
  try {
    const user = getToken(req,'access');
    if (user.role !== 'admin') { log(req,user.sub,'deny','Hanya admin dapat melihat audit log.'); return fail(res,403,'Akses admin diperlukan.'); }
    if (!isDeviceRegistered(user.sub,req.get('x-device-id'))) { log(req,user.sub,'deny','Device tidak terdaftar.'); return fail(res,403,'Device tidak terdaftar.'); }
    log(req,user.sub,'allow','Admin melihat audit log.');
    return res.json({data:db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all()});
  } catch { log(req,null,'deny','Token admin tidak valid.'); return fail(res,401,'Access token tidak valid.'); }
});
app.use((req,res)=>{ log(req,null,'deny','Endpoint atau metode tidak tersedia.'); return fail(res,404,'Endpoint tidak ditemukan.'); });
app.listen(Number(process.env.PORT_GATEWAY || 3000),()=>console.log(`API Gateway / PEP aktif pada port ${process.env.PORT_GATEWAY || 3000}`));
