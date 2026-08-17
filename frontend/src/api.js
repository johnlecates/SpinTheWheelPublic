const BASE = import.meta.env.DEV ? '/api' : '/api';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

export const getWheelLayout = () => request('/wheel/layout');

export const getEmployee = (agentId) => request(`/employee/${encodeURIComponent(agentId)}`);

export const spin = (agentId) =>
    request('/spin', {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId }),
    });

export const importRoster = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE}/admin/roster/import`, { method: 'POST', body: fd }).then(async (res) => {
        if (!res.ok) {
            const body = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(body.detail || `HTTP ${res.status}`);
        }
        return res.json();
    });
};

export const getRoster = () => request('/admin/roster');
export const getPrizes = () => request('/admin/prizes');
export const getHistory = () => request('/admin/history');
export const getStats = () => request('/admin/stats');
export const resetPrizes = () => request('/admin/prizes/reset', { method: 'POST' });

// Prize management (add / edit / remove / restore / list per-prize winners)
export const addPrize = (payload) =>
    request('/admin/prizes', { method: 'POST', body: JSON.stringify(payload) });

export const updatePrize = (prizeId, payload) =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

export const removePrize = (prizeId) =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}`, { method: 'DELETE' });

export const restorePrize = (prizeId) =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}/restore`, { method: 'POST' });

export const clearAllPrizes = () =>
    request('/admin/prizes/all', { method: 'DELETE' });

export const importPrizes = (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE}/admin/prizes/import`, { method: 'POST', body: fd }).then(async (res) => {
        if (!res.ok) {
            const body = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(body.detail || `HTTP ${res.status}`);
        }
        return res.json();
    });
};

export const getPrizeWinners = (prizeId, q = '') =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}/winners${q ? `?q=${encodeURIComponent(q)}` : ''}`);

// Void / unvoid a single winner (admin)
export const voidWinner = (prizeId, agentId, payload) =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}/winners/${encodeURIComponent(agentId)}/void`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

export const unvoidWinner = (prizeId, agentId) =>
    request(`/admin/prizes/${encodeURIComponent(prizeId)}/winners/${encodeURIComponent(agentId)}/unvoid`, {
        method: 'POST',
    });
export const clearRoster = () => request('/admin/roster', { method: 'DELETE' });

// Manually add a single agent to the roster when they're missing
// from the imported CSV (late entry). Mirrors the /admin/roster/import
// validation: ID is uppercased/trimmed and duplicates return 409.
export const addRosterEntry = (agentId, name) =>
    request('/admin/roster/manual', {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId, name }),
    });

// Password authorization for the admin panel.
// On success the backend confirms the password; the response is then cached
// in sessionStorage so a page refresh doesn't force another login until
// the browser tab is closed.
const ADMIN_AUTH_KEY = 'stw_admin_authed';

export const isAdminAuthed = () => sessionStorage.getItem(ADMIN_AUTH_KEY) === '1';

export const setAdminAuthed = () => sessionStorage.setItem(ADMIN_AUTH_KEY, '1');

export const clearAdminAuth = () => sessionStorage.removeItem(ADMIN_AUTH_KEY);

export const adminLogin = async (password) => {
    const res = await fetch(`${BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        const err = new Error(body.detail || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
};
