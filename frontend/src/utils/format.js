export const roleLabels = {
  mahasiswa: 'Mahasiswa',
  dosen: 'Dosen',
  admin: 'Admin',
};

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'IF';
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

export function decodeTokenExpiry(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(window.atob(padded));
    return claims.exp ? new Date(claims.exp * 1000) : null;
  } catch {
    return null;
  }
}

export function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Number(value));
}

export function classStatus(finalized) {
  return Number(finalized) === 1 || finalized === true ? 'Final' : 'Dalam proses';
}
