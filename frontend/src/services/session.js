const SESSION_KEY = 'zero-trust-session';

export function readSession() {
  try {
    const serialized = window.sessionStorage.getItem(SESSION_KEY);
    return serialized ? JSON.parse(serialized) : null;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function removeSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}
