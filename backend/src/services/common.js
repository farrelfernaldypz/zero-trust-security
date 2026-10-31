const db = require('../shared/db');
const { verifyToken, bearer } = require('../shared/tokens');
const { isWithinAccessHours } = require('../shared/access-window');
function requireGateway(req, res, next) {
  if (!process.env.GATEWAY_SECRET || req.get('x-gateway-secret') !== process.env.GATEWAY_SECRET) {
    return res.status(403).json({ error: 'Akses langsung ditolak: gateway secret tidak valid.' });
  }
  try { req.identity = verifyToken(bearer(req), 'access'); next(); }
  catch { try { req.identity = verifyToken(bearer(req), 'service'); next(); } catch { return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa.' }); } }
}
function requireService(req, res, next) {
  if (!process.env.GATEWAY_SECRET || req.get('x-gateway-secret') !== process.env.GATEWAY_SECRET) { return res.status(403).json({ error: 'Gateway secret tidak valid.' }); }
  try {
    const identity = verifyToken(bearer(req), 'service');
    if (identity.role !== 'service' || identity.client_id !== process.env.SERVICE_CLIENT_ID) { return res.status(403).json({ error: 'Token service tidak berwenang.' }); }
    req.identity = identity; next();
  } catch { return res.status(401).json({ error: 'Token service tidak valid atau kedaluwarsa.' }); }
}
module.exports = { db, requireGateway, requireService, withinAccessHours: isWithinAccessHours };

