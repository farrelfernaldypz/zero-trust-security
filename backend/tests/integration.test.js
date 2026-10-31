const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const { isWithinAccessHours } = require('../src/shared/access-window');

const root = path.resolve(__dirname, '../..');
const dbPath = path.join(root, 'data', 'integration-test.sqlite');
const ports = { gateway: 3100, nilai: 3101, transkrip: 3102 };
const env = {
  ...process.env,
  DB_PATH: dbPath,
  PORT_GATEWAY: String(ports.gateway),
  PORT_NILAI: String(ports.nilai),
  PORT_TRANSKRIP: String(ports.transkrip),
  GATEWAY_URL: `http://127.0.0.1:${ports.gateway}`,
  JWT_SECRET: 'test-jwt-secret-which-is-at-least-32-characters-long',
  GATEWAY_SECRET: 'test-gateway-secret-which-is-long-enough',
  SERVICE_CLIENT_ID: 'nilai-service',
  SERVICE_CLIENT_SECRET: 'test-service-secret',
  ACCESS_START_HOUR: '0',
  ACCESS_END_HOUR: '24',
  TIMEZONE: 'UTC',
};
const base = `http://127.0.0.1:${ports.gateway}`;
let children = [];

async function request(route, options = {}) {
  const response = await fetch(base + route, options);
  return { status: response.status, body: await response.json() };
}

function json(body, headers = {}) {
  return {
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

async function login(username, password, device) {
  const result = await request('/auth/login', {
    method: 'POST',
    ...json({ username, password }, { 'x-device-id': device }),
  });
  assert.equal(result.status, 200);
  return result.body;
}

async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/health`)).ok) {
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Gateway tidak siap.');
}

before(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) {
      fs.unlinkSync(dbPath + suffix);
    }
  }
  execFileSync(process.execPath, ['backend/src/shared/seed.js'], { cwd: root, env, stdio: 'inherit' });
  execFileSync(process.execPath, ['backend/src/shared/seed.js'], { cwd: root, env, stdio: 'ignore' });
  for (const file of ['backend/src/services/nilai.js', 'backend/src/services/transkrip.js', 'backend/src/gateway/server.js']) {
    children.push(spawn(process.execPath, [file], { cwd: root, env, stdio: 'ignore' }));
  }
  await ready();
});

after(async () => {
  for (const child of children) {
    child.kill();
  }
  await Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once('exit', resolve);
    setTimeout(resolve, 1500);
  })));
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {}
    }
  }
});

test('Zero Trust access, tokens, devices, service boundaries, audit and transcript sync', async () => {
  const wrongPassword = await request('/auth/login', {
    method: 'POST',
    ...json({ username: 'mhs1', password: 'bad' }, { 'x-device-id': 'device-mhs-001' }),
  });
  assert.equal(wrongPassword.status, 401);

  const wrongLoginDevice = await request('/auth/login', {
    method: 'POST',
    ...json({ username: 'mhs1', password: 'Mhs123!' }, { 'x-device-id': 'unknown' }),
  });
  assert.equal(wrongLoginDevice.status, 403);

  const wrongServiceSecret = await request('/auth/service', {
    method: 'POST',
    ...json({ clientId: env.SERVICE_CLIENT_ID, clientSecret: 'wrong-secret' }),
  });
  assert.equal(wrongServiceSecret.status, 401);

  const refreshIssuedAt = Date.now();
  const student = await login('mhs1', 'Mhs123!', 'device-mhs-001');
  const studentHeaders = {
    authorization: `Bearer ${student.accessToken}`,
    'x-device-id': 'device-mhs-001',
  };
  const accessClaims = jwt.decode(student.accessToken);
  assert.equal(accessClaims.role, 'mahasiswa');
  assert.equal(accessClaims.exp - accessClaims.iat, 600);
  const database = new Database(dbPath, { readonly: true });
  try {
    const refreshHash = crypto.createHash('sha256').update(student.refreshToken).digest('hex');
    const storedRefresh = database.prepare('SELECT token_hash, expires_at FROM refresh_tokens WHERE token_hash=?').get(refreshHash);
    assert.ok(storedRefresh, 'Refresh token harus disimpan sebagai hash di database.');
    assert.ok(storedRefresh.expires_at >= refreshIssuedAt + 86_399_000);
    assert.ok(storedRefresh.expires_at <= Date.now() + 86_401_000);
    assert.equal(database.prepare('SELECT 1 FROM refresh_tokens WHERE token_hash=?').get(student.refreshToken), undefined);
  } finally {
    database.close();
  }

  let result = await request('/nilai', { headers: studentHeaders });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.length, 2);
  assert.deepEqual(new Set(result.body.data.map(row => row.class_id)), new Set(['if101', 'if102']));

  result = await request('/nilai', {
    headers: { authorization: `Bearer ${student.accessToken}` },
  });
  assert.equal(result.status, 403, 'X-Device-ID wajib untuk request user.');
  result = await request('/nilai', {
    headers: { ...studentHeaders, 'x-device-id': 'device-mhs-002' },
  });
  assert.equal(result.status, 403, 'Device user lain tidak boleh dipakai.');

  result = await request('/transkrip/227006001', { headers: studentHeaders });
  assert.equal(result.status, 200);
  result = await request('/transkrip/227006002', { headers: studentHeaders });
  assert.equal(result.status, 403);
  result = await request('/nilai', {
    headers: { authorization: 'Bearer bad', 'x-device-id': 'device-mhs-001' },
  });
  assert.equal(result.status, 401);
  const expired = jwt.sign({ role: 'mahasiswa', typ: 'access' }, env.JWT_SECRET, {
    subject: 'mhs-1',
    expiresIn: -1,
  });
  result = await request('/nilai', {
    headers: { authorization: `Bearer ${expired}`, 'x-device-id': 'device-mhs-001' },
  });
  assert.equal(result.status, 401);

  const lecturer = await login('dosen1', 'Dosen123!', 'device-dosen-001');
  const lecturerHeaders = {
    authorization: `Bearer ${lecturer.accessToken}`,
    'x-device-id': 'device-dosen-001',
  };
  result = await request('/nilai', { headers: lecturerHeaders });
  assert.equal(result.status, 200);
  assert.ok(result.body.data.length > 0);
  assert.ok(result.body.data.every(row => row.code === 'IF101'));
  result = await request('/nilai/1', {
    method: 'PUT',
    ...json({ score: 87 }, lecturerHeaders),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.score, 87);
  result = await request('/nilai/4', {
    method: 'PUT',
    ...json({ score: 87 }, lecturerHeaders),
  });
  assert.equal(result.status, 403, 'Dosen tidak boleh mengubah nilai kelas dosen lain.');
  result = await request('/kelas/if101/finalisasi', {
    method: 'POST',
    ...json({}, lecturerHeaders),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.sync.count, 3);
  result = await request('/nilai/1', {
    method: 'PUT',
    ...json({ score: 88 }, lecturerHeaders),
  });
  assert.equal(result.status, 403, 'Nilai final tidak dapat diubah.');

  const admin = await login('admin', 'Admin123!', 'device-admin-001');
  const adminHeaders = {
    authorization: `Bearer ${admin.accessToken}`,
    'x-device-id': 'device-admin-001',
  };
  result = await request('/transkrip/227006002', { headers: adminHeaders });
  assert.equal(result.status, 200);
  assert.equal(result.body.transkrip.length, 1);
  result = await request('/admin/audit', { headers: adminHeaders });
  assert.equal(result.status, 200);
  assert.ok(result.body.data.some(row => row.endpoint === '/transkrip/sinkron' && row.subject === 'nilai-service' && row.decision === 'allow'), 'Finalisasi harus melewati endpoint sinkronisasi di Gateway.');

  const service = await request('/auth/service', {
    method: 'POST',
    ...json({ clientId: env.SERVICE_CLIENT_ID, clientSecret: env.SERVICE_CLIENT_SECRET }),
  });
  assert.equal(service.status, 200);
  const serviceClaims = jwt.decode(service.body.accessToken);
  assert.equal(serviceClaims.role, 'service');
  assert.equal(serviceClaims.exp - serviceClaims.iat, 300);
  const syncPayload = {
    classId: 'if102',
    classCode: 'IF102',
    className: 'Keamanan Informasi',
    grades: [],
  };
  result = await request('/transkrip/sinkron', {
    method: 'POST',
    ...json(syncPayload, studentHeaders),
  });
  assert.equal(result.status, 403, 'Token mahasiswa ditolak untuk sinkronisasi.');
  result = await request('/transkrip/sinkron', {
    method: 'POST',
    ...json(syncPayload, adminHeaders),
  });
  assert.equal(result.status, 403, 'Token admin ditolak untuk sinkronisasi.');
  result = await request('/transkrip/sinkron', {
    method: 'POST',
    ...json(syncPayload, { authorization: `Bearer ${service.body.accessToken}` }),
  });
  assert.equal(result.status, 200);

  for (const [port, route] of [
    [ports.nilai, '/nilai'],
    [ports.transkrip, '/transkrip/227006001'],
    [ports.nilai, '/health'],
    [ports.transkrip, '/health'],
  ]) {
    const direct = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(direct.status, 403, `Akses langsung ${route} harus meminta gateway secret.`);
  }
  result = await fetch(`http://127.0.0.1:${ports.nilai}/nilai`, {
    headers: { 'x-gateway-secret': env.GATEWAY_SECRET },
  });
  assert.equal(result.status, 401, 'Gateway secret tanpa token tetap ditolak.');
  result = await fetch(`http://127.0.0.1:${ports.transkrip}/transkrip/227006001`, {
    headers: { authorization: 'Bearer invalid-token', 'x-gateway-secret': env.GATEWAY_SECRET },
  });
  assert.equal(result.status, 401, 'Gateway secret dengan token invalid tetap ditolak.');
  result = await fetch(`http://127.0.0.1:${ports.transkrip}/health`, {
    headers: {
      authorization: `Bearer ${student.accessToken}`,
      'x-gateway-secret': env.GATEWAY_SECRET,
    },
  });
  assert.equal(result.status, 200, 'Health check tersedia setelah verifikasi gateway secret dan token.');

  const rotated = await request('/auth/refresh', {
    method: 'POST',
    ...json({ refreshToken: student.refreshToken }),
  });
  assert.equal(rotated.status, 200);
  const reusedRefresh = await request('/auth/refresh', {
    method: 'POST',
    ...json({ refreshToken: student.refreshToken }),
  });
  assert.equal(reusedRefresh.status, 401);
  const logout = await request('/auth/logout', {
    method: 'POST',
    ...json({ refreshToken: admin.refreshToken }),
  });
  assert.equal(logout.status, 200);
  const reusedLogoutToken = await request('/auth/refresh', {
    method: 'POST',
    ...json({ refreshToken: admin.refreshToken }),
  });
  assert.equal(reusedLogoutToken.status, 401);

  result = await request('/not-a-real-endpoint');
  assert.equal(result.status, 404);
  result = await request('/admin/audit', { headers: adminHeaders });
  assert.equal(result.status, 200);
  const auditRows = result.body.data;
  assert.ok(auditRows.some(row => row.decision === 'allow'));
  assert.ok(auditRows.some(row => row.decision === 'deny'));
  assert.ok(auditRows.some(row => row.endpoint === '/transkrip/sinkron' && row.subject === 'nilai-service' && row.decision === 'allow'));
  assert.ok(auditRows.some(row => row.endpoint === '/transkrip/sinkron' && row.decision === 'deny' && row.reason.includes('token service')));
  assert.ok(auditRows.some(row => row.endpoint === '/not-a-real-endpoint' && row.decision === 'deny' && row.reason));
  assert.ok(auditRows.every(row => row.occurred_at && row.endpoint && row.decision && row.reason && row.method));
  const auditText = JSON.stringify(auditRows);
  for (const sensitiveValue of [
    'Mhs123!',
    'Dosen123!',
    'Admin123!',
    student.accessToken,
    student.refreshToken,
    service.body.accessToken,
    env.JWT_SECRET,
    env.GATEWAY_SECRET,
    env.SERVICE_CLIENT_SECRET,
  ]) {
    assert.ok(!auditText.includes(sensitiveValue), 'Audit log tidak boleh berisi password, token, atau secret.');
  }
});

test('access window accepts only configured local hours', () => {
  const previous = {
    start: process.env.ACCESS_START_HOUR,
    end: process.env.ACCESS_END_HOUR,
    timezone: process.env.TIMEZONE,
  };
  try {
    process.env.TIMEZONE = 'Asia/Jakarta';
    process.env.ACCESS_START_HOUR = '7';
    process.env.ACCESS_END_HOUR = '21';
    assert.equal(isWithinAccessHours(new Date('2026-10-30T06:59:00+07:00')), false);
    assert.equal(isWithinAccessHours(new Date('2026-10-30T07:00:00+07:00')), true);
    assert.equal(isWithinAccessHours(new Date('2026-10-30T20:59:00+07:00')), true);
    assert.equal(isWithinAccessHours(new Date('2026-10-30T21:00:00+07:00')), false);
  } finally {
    process.env.ACCESS_START_HOUR = previous.start;
    process.env.ACCESS_END_HOUR = previous.end;
    process.env.TIMEZONE = previous.timezone;
  }
});

test('Gateway denies grade changes and finalization outside configured hours', async () => {
  const isolatedPorts = { gateway: 3200, nilai: 3201, transkrip: 3202 };
  const isolatedDb = path.join(root, 'data', 'access-window-test.sqlite');
  const isolatedEnv = {
    ...env,
    DB_PATH: isolatedDb,
    PORT_GATEWAY: String(isolatedPorts.gateway),
    PORT_NILAI: String(isolatedPorts.nilai),
    PORT_TRANSKRIP: String(isolatedPorts.transkrip),
    GATEWAY_URL: `http://127.0.0.1:${isolatedPorts.gateway}`,
    ACCESS_START_HOUR: '24',
    ACCESS_END_HOUR: '24',
  };
  const isolatedBase = `http://127.0.0.1:${isolatedPorts.gateway}`;
  const isolatedChildren = [];
  const isolatedRequest = async (route, options = {}) => {
    const response = await fetch(isolatedBase + route, options);
    return { status: response.status, body: await response.json() };
  };
  const waitForGateway = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${isolatedBase}/health`)).ok) {
          return;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Gateway dengan jam akses terbatas tidak siap.');
  };

  try {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(isolatedDb + suffix)) {
        fs.unlinkSync(isolatedDb + suffix);
      }
    }
    execFileSync(process.execPath, ['backend/src/shared/seed.js'], { cwd: root, env: isolatedEnv, stdio: 'ignore' });
    for (const file of ['backend/src/services/nilai.js', 'backend/src/services/transkrip.js', 'backend/src/gateway/server.js']) {
      isolatedChildren.push(spawn(process.execPath, [file], { cwd: root, env: isolatedEnv, stdio: 'ignore' }));
    }
    await waitForGateway();

    const loginResponse = await isolatedRequest('/auth/login', {
      method: 'POST',
      ...json({ username: 'dosen1', password: 'Dosen123!' }, { 'x-device-id': 'device-dosen-001' }),
    });
    assert.equal(loginResponse.status, 200);
    const headers = {
      authorization: `Bearer ${loginResponse.body.accessToken}`,
      'x-device-id': 'device-dosen-001',
    };
    const deniedUpdate = await isolatedRequest('/nilai/1', {
      method: 'PUT',
      ...json({ score: 87 }, headers),
    });
    assert.equal(deniedUpdate.status, 403);
    assert.match(deniedUpdate.body.error, /hanya diizinkan/i);
    const deniedFinalization = await isolatedRequest('/kelas/if101/finalisasi', {
      method: 'POST',
      ...json({}, headers),
    });
    assert.equal(deniedFinalization.status, 403);
    assert.match(deniedFinalization.body.error, /hanya diizinkan/i);
  } finally {
    for (const child of isolatedChildren) {
      child.kill();
    }
    await Promise.all(isolatedChildren.map(child => new Promise(resolve => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once('exit', resolve);
      setTimeout(resolve, 1500);
    })));
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(isolatedDb + suffix)) {
        try {
          fs.unlinkSync(isolatedDb + suffix);
        } catch {}
      }
    }
  }
});
