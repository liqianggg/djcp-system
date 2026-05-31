const BASE = '';

function getToken() {
  return localStorage.getItem('djcp_token');
}

async function request(url, options = {}) {
  const headers = { 'Authorization': `Bearer ${getToken()}`, ...options.headers };
  const res = await fetch(BASE + url, { ...options, headers });
  if (res.status === 401) { localStorage.clear(); window.location.reload(); throw new Error('登录已过期'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 (${res.status})`);
  }
  return res;
}

export async function apiGet(url) {
  const res = await request(url);
  return res.json();
}

export async function apiPost(url, body) {
  const res = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function apiPut(url, body) {
  const res = await request(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function apiDelete(url) {
  const res = await request(url, { method: 'DELETE' });
  return res.json();
}

export async function apiUpload(url, formData) {
  const res = await request(url, { method: 'POST', body: formData });
  return res.json();
}

export function hasPermission(code) {
  try {
    const user = JSON.parse(localStorage.getItem('djcp_user') || '{}');
    return user.permissions?.includes(code) || false;
  } catch { return false; }
}
