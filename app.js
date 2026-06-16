const BASE_URL = 'http://localhost:5000';


function swalError(title, text) {
  return Swal.fire({ icon: 'error', title: title || 'Error', text: text || 'Something went wrong' });
}

function swalOk(title, text) {
  return Swal.fire({ icon: 'success', title: title || 'Done', text: text || '' });
}

function swalInfo(title, text) {
  return Swal.fire({ icon: 'info', title: title || 'Info', text: text || '' });
}

function swalLoading(title = 'Please wait...') {
  return Swal.fire({
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
}

function swalClose() {
  Swal.close();
}
function setToken(token) {
  localStorage.setItem('token', token);
}
function getToken() {
  return localStorage.getItem('token');
}
function clearToken() {
  localStorage.removeItem('token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : { ...extra };
}

async function api(path, { method = 'GET', body = null, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

function logout() {
  clearToken();
  window.location.href = 'login.html';
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || '');
  }
}

function badgeClass(level) {
  if (level === 'low') return 'low';
  if (level === 'medium') return 'medium';
  if (level === 'high') return 'high';
  return '';
}
