const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
require('dotenv').config();
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
  throw new Error('JWT_SECRET harus diatur di .env dengan nilai acak minimal 32 karakter.');
}
function issueUserToken(user) {
  return jwt.sign({ role: user.role, typ: 'access', ...(user.nim ? { nim: user.nim } : {}) }, secret, { subject: user.id, expiresIn: process.env.ACCESS_TOKEN_TTL || '10m' });
}
function issueServiceToken() {
  return jwt.sign({ role: 'service', typ: 'service', client_id: process.env.SERVICE_CLIENT_ID }, secret, { subject: 'nilai-service', expiresIn: process.env.SERVICE_TOKEN_TTL || '5m' });
}
function verifyToken(token, expectedType) {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (payload.typ !== expectedType) { throw new Error('Jenis token tidak sesuai.'); }
  return payload;
}
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function bearer(req) {
  const value = req.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) { throw new Error('Bearer token wajib disertakan.'); }
  return match[1];
}
module.exports = { issueUserToken, issueServiceToken, verifyToken, hashToken, bearer };
