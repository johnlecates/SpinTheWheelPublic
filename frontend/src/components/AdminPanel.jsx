import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    getStats,
    getPrizes,
    getRoster,
    getHistory,
    importRoster,
    addRosterEntry,
    resetPrizes,
    clearRoster,
    addPrize,
    updatePrize,
    removePrize,
    restorePrize,
    clearAllPrizes,
    importPrizes,
    getPrizeWinners,
    voidWinner,
    unvoidWinner,
} from '../api.js';

const TABS = ['Prizes', 'Roster', 'History', 'Actions'];

export default function AdminPanel() {
    const [tab, setTab] = useState('Prizes');
    const [stats, setStats] = useState(null);
    const [prizes, setPrizes] = useState([]);
    const [roster, setRoster] = useState([]);
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [showVoidedHistory, setShowVoidedHistory] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [manualAgentId, setManualAgentId] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualSubmitting, setManualSubmitting] = useState(false);
    const [manualMessage, setManualMessage] = useState(null); // {kind: 'ok'|'err', text: string}
    const fileRef = useRef(null);
    const prizeFileRef = useRef(null);
    const [prizeImportMsg, setPrizeImportMsg] = useState(null); // {kind, text}
    // --- Prize winners panel ---
    const [selectedPrize, setSelectedPrize] = useState(null); // prize object
    const [winners, setWinners] = useState([]);
    const [winnersTotal, setWinnersTotal] = useState(0);
    const [winnersLoading, setWinnersLoading] = useState(false);
    const [winnerSearch, setWinnerSearch] = useState('');
    // --- Add / edit prize ---
    const [showAddPrize, setShowAddPrize] = useState(false);
    const [editingPrize, setEditingPrize] = useState(null); // prize being edited (or null = add mode)
    const [addPrizeMsg, setAddPrizeMsg] = useState(null); // {kind: 'ok'|'err', text}
    const initialForm = {
        display_name: '',
        wheel_label: '',
        tier: 'standard',
        starting_qty: '1',
        remaining_qty: '',
        wheel_color: '#2196F3',
        is_multi_item: false,
        items: '',
        winner_message: '',
    };
    const [addForm, setAddForm] = useState(initialForm);

    const refresh = async () => {
        setLoading(true);
        try {
            const [s, p, r, h] = await Promise.all([getStats(), getPrizes(), getRoster(), getHistory()]);
            setStats(s);
            setPrizes(p);
            setRoster(r);
            setHistory(h);
            // Keep in-flight references (winners panel, edit form) in sync with the
            // freshly fetched list so a renamed prize shows the new name everywhere.
            setSelectedPrize((prev) => (prev ? p.find((x) => x.id === prev.id) || null : null));
            setEditingPrize((prev) => (prev ? p.find((x) => x.id === prev.id) || null : null));
        } catch (e) {
            console.error(e);
            alert(`Failed to refresh data: ${e.message || e}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    // Load winners for the selected prize (server-side search, debounced)
    useEffect(() => {
        if (!selectedPrize) {
            setWinners([]);
            setWinnersTotal(0);
            setWinnersLoading(false);
            return;
        }
        let cancelled = false;
        setWinnersLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await getPrizeWinners(selectedPrize.id, winnerSearch.trim());
                if (!cancelled) {
                    setWinners(res.winners || []);
                    setWinnersTotal(res.total || 0);
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setWinnersLoading(false);
            }
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [selectedPrize, winnerSearch]);

    const handleFileUpload = async (file) => {
        if (!file) return;
        setImportResult(null);
        try {
            const result = await importRoster(file);
            setImportResult(result);
            refresh();
        } catch (e) {
            setImportResult({ error: e.message });
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

    const handleResetPrizes = async () => {
        if (!confirm('Reset all prize inventory to starting quantities?')) return;
        await resetPrizes();
        refresh();
    };

    const handleClearAllPrizes = async () => {
        const typed = window.prompt(
            '⚠ Remove ALL prizes and spin history?\n\n' +
            'This wipes every prize and every recorded winner. The wheel will be empty until you import a fresh CSV.\n\n' +
            'Type DELETE to confirm.',
        );
        if (typed !== 'DELETE') return;
        try {
            const out = await clearAllPrizes();
            window.alert(out.detail || 'Cleared.');
            await refresh();
        } catch (e) {
            window.alert(e.message || 'Failed to clear prizes.');
        }
    };

    const handleImportPrizes = async (file) => {
        if (!file) return;
        setPrizeImportMsg(null);
        try {
            const result = await importPrizes(file);
            const errSummary = result.errors && result.errors.length
                ? `\n\nErrors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n…and ${result.errors.length - 5} more` : ''}`
                : '';
            setPrizeImportMsg({
                kind: result.errors && result.errors.length ? 'warn' : 'ok',
                text: `✓ Imported ${result.added} prize${result.added === 1 ? '' : 's'}.` + errSummary,
            });
            await refresh();
        } catch (e) {
            setPrizeImportMsg({ kind: 'err', text: e.message });
        }
    };

    const handleClearRoster = async () => {
        if (!confirm('Delete all employees and spin history? This cannot be undone.')) return;
        await clearRoster();
        refresh();
    };

    const closePrizeForm = () => {
        setShowAddPrize(false);
        setEditingPrize(null);
        setAddPrizeMsg(null);
        setAddForm(initialForm);
    };

    // Convert the items JSON string from the DB (or null/undefined) into the
    // comma-separated form value the <input> expects. Mirrors the inverse
    // `addForm.items.split(',')` done on save.
    const parseItems = (raw) => {
        if (!raw) return '';
        let arr = [];
        try { arr = JSON.parse(raw); } catch { return ''; }
        if (!Array.isArray(arr)) return '';
        return arr.join(', ');
    };

    const handleStartEdit = (p) => {
        setShowAddPrize(true);
        setEditingPrize(p);
        setAddPrizeMsg(null);
        setAddForm({
            display_name: p.display_name || '',
            wheel_label: p.wheel_label || '',
            tier: p.tier || 'standard',
            starting_qty: String(p.starting_qty ?? 1),
            remaining_qty: String(p.remaining_qty ?? 0),
            wheel_color: p.wheel_color || '#2196F3',
            is_multi_item: !!p.is_multi_item,
            items: parseItems(p.items),
            winner_message: p.winner_message || '',
        });
    };

    const handleAddPrize = async (e) => {
        e.preventDefault();
        setAddPrizeMsg(null);
        const name = addForm.display_name.trim();
        if (!name) {
            setAddPrizeMsg({ kind: 'err', text: 'Prize name is required.' });
            return;
        }
        const qty = Math.max(1, parseInt(addForm.starting_qty, 10) || 1);
        const isEdit = !!editingPrize;
        const payload = {
            display_name: name,
            wheel_label: addForm.wheel_label.trim() || undefined,
            tier: addForm.tier,
            starting_qty: qty,
            wheel_color: addForm.wheel_color || '#2196F3',
            is_multi_item: addForm.is_multi_item,
            items: addForm.is_multi_item
                ? addForm.items.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined,
            winner_message: addForm.winner_message.trim() || undefined,
        };
        // Only include remaining_qty on edit — the backend only applies it
        // when present, and on add the prize is created with remaining=starting.
        if (isEdit && addForm.remaining_qty !== '') {
            const rem = parseInt(addForm.remaining_qty, 10);
            if (Number.isFinite(rem) && rem >= 0) {
                payload.remaining_qty = rem;
            }
        }
        try {
            if (isEdit) {
                await updatePrize(editingPrize.id, payload);
                setAddPrizeMsg({ kind: 'ok', text: `✓ Saved changes to "${name}". Odds recalculated.` });
            } else {
                await addPrize(payload);
                setAddPrizeMsg({ kind: 'ok', text: `✓ Added "${name}" (${qty} prize${qty === 1 ? '' : 's'}). Odds recalculated.` });
            }
            setShowAddPrize(false);
            setEditingPrize(null);
            setAddForm(initialForm);
            await refresh();
        } catch (err) {
            setAddPrizeMsg({ kind: 'err', text: err.message || (isEdit ? 'Failed to save prize.' : 'Failed to add prize.') });
        }
    };

    const handleRemovePrize = async (p) => {
        const ok = window.confirm(
            `Remove "${p.display_name}" from the wheel?\n\nIts spin history is kept and remaining players' odds are recalculated.`,
        );
        if (!ok) return;
        try {
            await removePrize(p.id);
            await refresh();
        } catch (e) {
            window.alert(e.message || 'Failed to remove prize.');
        }
    };

    const handleRestorePrize = async (p) => {
        const ok = window.confirm(
            `Restore "${p.display_name}" to the wheel?\n\n` +
            `The prize will be reactivated and restocked to its starting quantity (${p.starting_qty}).\n` +
            `You can fine-tune the Remaining field via Edit after restoring.`,
        );
        if (!ok) return;
        try {
            const out = await restorePrize(p.id);
            window.alert(out.detail || 'Restored.');
            await refresh();
        } catch (e) {
            window.alert(e.message || 'Failed to restore prize.');
        }
    };

    const handleVoid = async (w) => {
        // Two-step confirm so admins must explicitly opt in to the
        // "let this person spin again" behavior (intended for testing).
        const restoreQty = window.confirm(
            `Void this win?\n\n` +
            `Agent:  ${w.name} (${w.agent_id})\n` +
            `Prize:  ${selectedPrize?.display_name}\n` +
            `Time:   ${w.spin_timestamp ? new Date(w.spin_timestamp).toLocaleString() : '—'}\n\n` +
            `Click OK to void AND return the prize to the inventory pool.\n` +
            `Click Cancel to skip the inventory restore (you'll be asked next).`,
        );
        if (restoreQty === null) return; // not really null from confirm; treat Cancel as "no inventory restore"
        // window.confirm returns true/false only, so use a second confirm for reset_employee.
        const resetEmp = window.confirm(
            `Also clear this employee's spin record so they can spin again?\n\n` +
            `(This is intended for testing. Leave OFF in normal use unless the\n` +
            `winner declined their prize and you want to let a substitute play.)`,
        );
        try {
            const out = await voidWinner(selectedPrize.id, w.agent_id, {
                restore_prize: restoreQty,
                reset_employee: resetEmp,
            });
            window.alert(
                `Voided.\n\n` +
                `Inventory ${out.inventory_restored ? 'restored (+1 to remaining)' : 'NOT changed (already at max)'}.\n` +
                `Employee ${out.employee_reset ? 'reset — they can spin again' : 'NOT changed'}.`,
            );
            await refresh();
        } catch (e) {
            window.alert(e.message || 'Failed to void winner.');
        }
    };

    const handleUnvoid = async (w) => {
        if (!window.confirm(`Restore this win (undo the void) for ${w.name} (${w.agent_id})?`)) return;
        try {
            await unvoidWinner(selectedPrize.id, w.agent_id);
            await refresh();
        } catch (e) {
            window.alert(e.message || 'Failed to restore win.');
        }
    };

    const handleManualAdd = async (e) => {
        e?.preventDefault?.();
        const trimmedId = manualAgentId.trim().toUpperCase();
        const trimmedName = manualName.trim();
        if (!trimmedId || !trimmedName || manualSubmitting) return;
        setManualSubmitting(true);
        setManualMessage(null);
        try {
            await addRosterEntry(trimmedId, trimmedName);
            setManualMessage({
                kind: 'ok',
                text: `✓ Added ${trimmedId} — ${trimmedName}`,
            });
            setManualAgentId('');
            setManualName('');
            await refresh();
        } catch (err) {
            setManualMessage({ kind: 'err', text: err.message || 'Failed to add agent.' });
        } finally {
            setManualSubmitting(false);
        }
    };

    const handleTabChange = (nextTab) => {
        if (nextTab !== tab) {
            // Clear cross-tab UI state so messages / search don't bleed between views
            setManualMessage(null);
            setImportResult(null);
        }
        setTab(nextTab);
    };

    const filteredRoster = roster.filter(
        (e) =>
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.agent_id.toLowerCase().includes(search.toLowerCase()),
    );

    // Voided winners are hidden by default in the History tab (the per-prize
    // Winners panel still shows them, faded, for audit). Admins can toggle
    // "Show voided" to reveal them.
    const visibleHistory = showVoidedHistory
        ? history
        : history.filter((h) => !h.voided_at);

    const filteredHistory = historySearch.trim()
        ? visibleHistory.filter((h) => {
              const q = historySearch.trim().toLowerCase();
              return (
                  (h.agent_id || '').toLowerCase().includes(q) ||
                  (h.name || '').toLowerCase().includes(q)
              );
          })
        : visibleHistory;

    const hiddenVoidedCount = history.length - visibleHistory.length;

    // Odds are weighted by remaining quantity across ACTIVE prizes, so adding or
    // removing a prize automatically recalculates every prize's probability.
    const activePrizes = prizes.filter((p) => p.is_active !== false);
    const totalRemaining = activePrizes.reduce((s, p) => s + (p.remaining_qty || 0), 0);

    return (
        <div className="admin-page">
            <div className="admin-header">
                <Link to="/" className="back-link">← Back</Link>
                <h1>ADMIN PANEL</h1>
                <button className="btn btn-secondary" onClick={refresh} disabled={loading}>
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <>
                    <div className="stats-bar">
                        <div className="stat-card">
                            <div className="stat-value">{stats.roster_count}</div>
                            <div className="stat-label">Employees</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.spun_count}</div>
                            <div className="stat-label">Spun</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.roster_count - stats.spun_count}</div>
                            <div className="stat-label">Remaining</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.prize_count}</div>
                            <div className="stat-label">Prizes Left</div>
                        </div>
                    </div>
                </>
            )}

            {/* Tabs */}
            <div className="tabs">
                {TABS.map((t) => (
                    <button
                        key={t}
                        className={`tab-btn${tab === t ? ' active' : ''}`}
                        onClick={() => handleTabChange(t)}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Prizes Tab */}
            {tab === 'Prizes' && (
                <div className="prizes-section">
                    <div className="prizes-toolbar">
                        <h3>
                            Prizes{' '}
                            <span className="prizes-count">
                                ({activePrizes.length} active · {totalRemaining} available)
                            </span>
                        </h3>
                        <div className="toolbar-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => prizeFileRef.current?.click()}
                                title="Bulk-import prizes from a CSV file"
                            >
                                📥 Import CSV
                            </button>
                            <input
                                ref={prizeFileRef}
                                type="file"
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleImportPrizes(f);
                                    e.target.value = ''; // allow re-importing the same file
                                }}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => { if (showAddPrize) closePrizeForm(); else { setShowAddPrize(true); setEditingPrize(null); setAddForm(initialForm); setAddPrizeMsg(null); } }}
                            >
                                {showAddPrize ? 'Cancel' : '+ Add Prize'}
                            </button>
                        </div>
                    </div>
                    {prizeImportMsg && (
                        <div className={`manual-add-msg ${prizeImportMsg.kind === 'warn' ? 'err' : prizeImportMsg.kind}`} style={{ whiteSpace: 'pre-wrap' }}>
                            {prizeImportMsg.text}
                        </div>
                    )}
                    <p className="odds-hint">
                        "Odds" = a prize's remaining quantity ÷ total remaining across active prizes. Adding or
                        removing a prize recalculates every prize's odds automatically.
                    </p>

                    {showAddPrize && (
                        <form className={editingPrize ? "add-prize-card editing" : "add-prize-card"} onSubmit={handleAddPrize}>
                            <div className="manual-add-header">
                                <h3>{editingPrize
                                    ? `Edit Prize — ${addForm.display_name.trim() || editingPrize.display_name}`
                                    : 'Add Prize'}</h3>
                                <p>
                                    {editingPrize
                                        ? 'Changes apply immediately and all odds are recalculated.'
                                        : 'New prizes join the wheel immediately with the given quantity, and all odds are recalculated.'}
                                </p>
                            </div>
                            <div className="add-prize-grid">
                                <label>Name *
                                    <input className="manual-add-input" type="text" value={addForm.display_name}
                                        onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })} required />
                                </label>
                                <label>Wheel Label
                                    <input className="manual-add-input" type="text" value={addForm.wheel_label}
                                        onChange={(e) => setAddForm({ ...addForm, wheel_label: e.target.value })}
                                        placeholder={addForm.display_name || 'Shows on the wheel'} />
                                </label>
                                <label>Quantity
                                    <input className="manual-add-input" type="number" min="1" value={addForm.starting_qty}
                                        onChange={(e) => setAddForm({ ...addForm, starting_qty: e.target.value })} />
                                </label>
                                {editingPrize && (
                                    <label>Remaining
                                        <input className="manual-add-input" type="number" min="0" max={addForm.starting_qty} value={addForm.remaining_qty}
                                            onChange={(e) => setAddForm({ ...addForm, remaining_qty: e.target.value })}
                                            title="Adjust available inventory (e.g. more prizes were added, or some were lost/broken)" />
                                    </label>
                                )}
                                <label>Tier
                                    <select className="manual-add-input" value={addForm.tier}
                                        onChange={(e) => setAddForm({ ...addForm, tier: e.target.value })}>
                                        <option value="standard">standard</option>
                                        <option value="mid">mid</option>
                                        <option value="premium">premium</option>
                                    </select>
                                </label>
                                <label>Slice Count
                                    <input className="manual-add-input" type="text" value="2" disabled readOnly
                                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                                        title="The wheel always shows 2 slices per active prize (cosmetic; doesn't affect odds)." />
                                </label>
                                <label>Color
                                    <input className="manual-add-input" type="color" value={addForm.wheel_color}
                                        onChange={(e) => setAddForm({ ...addForm, wheel_color: e.target.value })}
                                        style={{ height: 42, padding: 3 }} />
                                </label>
                                <label>Winner Message
                                    <input className="manual-add-input" type="text" value={addForm.winner_message}
                                        onChange={(e) => setAddForm({ ...addForm, winner_message: e.target.value })}
                                        placeholder="Defaults to: You won {name}!" />
                                </label>
                                <label className="add-prize-check">
                                    <input type="checkbox" checked={addForm.is_multi_item}
                                        onChange={(e) => setAddForm({ ...addForm, is_multi_item: e.target.checked })} />
                                    Multiple items (pick one)
                                </label>
                                {addForm.is_multi_item && (
                                    <label className="add-prize-full">Items (comma separated)
                                        <input className="manual-add-input" type="text" value={addForm.items}
                                            onChange={(e) => setAddForm({ ...addForm, items: e.target.value })}
                                            placeholder="Backpack, Sandals, Flashlight" />
                                    </label>
                                )}
                            </div>
                            {addPrizeMsg && (
                                <div className={`manual-add-msg ${addPrizeMsg.kind}`}>{addPrizeMsg.text}</div>
                            )}
                            <div className="add-prize-actions">
                                <button type="submit" className="btn btn-primary">{editingPrize ? 'Save Changes' : 'Add Prize'}</button>
                                <button type="button" className="btn btn-secondary" onClick={closePrizeForm}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {selectedPrize && (
                        <div className="winners-panel">
                            <div className="winners-header">
                                <h3>Winners — {selectedPrize.display_name}</h3>
                                <span className="winners-count">
                                    {winnersLoading
                                        ? 'Loading…'
                                        : `${winners.length}${winnersTotal && winnersTotal !== winners.length ? ` of ${winnersTotal}` : ''} shown`}
                                </span>
                                <button className="btn btn-secondary btn-xs" onClick={() => setSelectedPrize(null)}>
                                    Close
                                </button>
                            </div>
                            <input
                                className="search-input winners-search"
                                type="text"
                                placeholder="Search winners by name or Agent ID…"
                                value={winnerSearch}
                                onChange={(e) => setWinnerSearch(e.target.value)}
                            />
                            {winnersLoading ? (
                                <p className="loading">Loading…</p>
                            ) : winners.length === 0 ? (
                                <p className="empty-note">
                                    {winnersTotal === 0
                                        ? 'No one has won this prize yet.'
                                        : `No winners match "${winnerSearch}".`}
                                </p>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Agent ID</th>
                                            <th>Name</th>
                                            <th>Time</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {winners.map((w) => (
                                            <tr key={w.agent_id} className={w.voided_at ? 'winner-voided' : ''}>
                                                <td style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{w.agent_id}</td>
                                                <td>
                                                    {w.name}
                                                    {w.voided_at && <span className="voided-badge">Voided</span>}
                                                </td>
                                                <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                                                    {w.spin_timestamp ? new Date(w.spin_timestamp).toLocaleString() : '—'}
                                                </td>
                                                <td>
                                                    {w.voided_at ? (
                                                        <button
                                                            className="btn btn-secondary btn-xs"
                                                            onClick={() => handleUnvoid(w)}
                                                        >
                                                            Restore
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-danger btn-xs"
                                                            onClick={() => handleVoid(w)}
                                                        >
                                                            Void
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Seg</th>
                            <th>Prize</th>
                            <th>Tier</th>
                            <th>Inventory</th>
                            <th>Odds</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {prizes.map((p) => {
                            const removed = p.is_active === false;
                            const pct = p.starting_qty > 0 ? (p.remaining_qty / p.starting_qty) * 100 : 0;
                            const odds = !removed && totalRemaining > 0 ? (p.remaining_qty / totalRemaining) * 100 : null;
                            return (
                                <tr key={p.id} className={removed ? 'prize-removed' : ''}>
                                    <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{p.segment_number}</td>
                                    <td>
                                        <span className="color-dot" style={{ background: p.wheel_color }} />
                                        {p.display_name}
                                        {removed && <span className="removed-badge">Removed</span>}
                                        {p.is_multi_item && (() => {
                                            // Render the live items list (the field the edit form
                                            // actually saves), not the stale `description` string
                                            // seeded once at creation. Fall back to description
                                            // only for legacy data with no items JSON.
                                            let arr = [];
                                            try { if (p.items) arr = JSON.parse(p.items); } catch { /* ignore */ }
                                            if (!Array.isArray(arr) || arr.length === 0) {
                                                return p.description ? (
                                                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 6 }}>
                                                        ({p.description})
                                                    </span>
                                                ) : null;
                                            }
                                            return (
                                                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginLeft: 6 }}>
                                                    ({arr.join(', ')})
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td>
                                        <span className={`tier-badge ${p.tier}`}>{p.tier}</span>
                                    </td>
                                    <td>
                                        <div className="qty-bar">
                                            <div className="qty-track" style={{ minWidth: 80 }}>
                                                <div
                                                    className={`qty-fill${p.remaining_qty === 0 ? ' depleted' : ''}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span style={{ minWidth: 60, fontSize: '0.85rem' }}>
                                                {p.remaining_qty} / {p.starting_qty}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-dim)' }}>
                                        {removed ? '—' : odds !== null ? `${odds.toFixed(1)}%` : '0%'}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => { setSelectedPrize(p); setWinnerSearch(''); }}
                                            >
                                                Winners
                                            </button>
                                            {!removed && (
                                                <button className="btn btn-secondary btn-xs" onClick={() => handleStartEdit(p)}>
                                                    Edit
                                                </button>
                                            )}
                                            {removed ? (
                                                <button className="btn btn-primary btn-xs" onClick={() => handleRestorePrize(p)}>
                                                    Restore
                                                </button>
                                            ) : (
                                                <button className="btn btn-danger btn-xs" onClick={() => handleRemovePrize(p)}>
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            )}

            {/* Roster Tab */}
            {tab === 'Roster' && (
                <>
                    <div
                        className="upload-zone"
                        onClick={() => fileRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <div style={{ fontSize: '2rem' }}>📄</div>
                        <p>Click or drag a CSV file to import roster</p>
                        <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Format: AgentID, Name (one per row)</p>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".csv,.txt"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileUpload(e.target.files[0])}
                        />
                    </div>

                    {importResult && !importResult.error && (
                        <div className="import-result">
                            <span className="ok">✓ Added: {importResult.added}</span>
                            {'  ·  '}
                            <span style={{ color: 'var(--text-dim)' }}>Skipped (duplicate): {importResult.skipped}</span>
                            {importResult.errors.length > 0 && (
                                <div className="warn" style={{ marginTop: 8 }}>
                                    Errors: {importResult.errors.join('; ')}
                                </div>
                            )}
                        </div>
                    )}
                    {importResult?.error && (
                        <div className="import-result warn">{importResult.error}</div>
                    )}

                    {/* Manual late-entry add — use when an agent isn't in the imported roster */}
                    <form
                        className="manual-add-card"
                        onSubmit={handleManualAdd}
                    >
                        <div className="manual-add-header">
                            <h3>Add Manual Agent</h3>
                            <p>
                                For late arrivals not in the imported roster. Type the
                                Agent ID and Name, then click Add.
                            </p>
                        </div>
                        <div className="manual-add-fields">
                            <input
                                className="search-input manual-add-input"
                                type="text"
                                placeholder="Agent ID (e.g. A123456)"
                                value={manualAgentId}
                                onChange={(e) => {
                                    setManualAgentId(e.target.value.toUpperCase());
                                    if (manualMessage) setManualMessage(null);
                                }}
                                maxLength={25}
                                autoComplete="off"
                                disabled={manualSubmitting}
                            />
                            <input
                                className="search-input manual-add-input"
                                type="text"
                                placeholder="Full Name"
                                value={manualName}
                                onChange={(e) => {
                                    setManualName(e.target.value);
                                    if (manualMessage) setManualMessage(null);
                                }}
                                maxLength={200}
                                autoComplete="off"
                                disabled={manualSubmitting}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary manual-add-btn"
                                disabled={
                                    manualSubmitting ||
                                    !manualAgentId.trim() ||
                                    !manualName.trim()
                                }
                            >
                                {manualSubmitting ? 'Adding…' : 'Add Agent'}
                            </button>
                        </div>
                        {manualMessage && (
                            <div
                                className={`manual-add-msg ${
                                    manualMessage.kind === 'ok' ? 'ok' : 'err'
                                }`}
                            >
                                {manualMessage.text}
                            </div>
                        )}
                    </form>

                    <input
                        className="search-input"
                        placeholder="Search by name or ID…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Agent ID</th>
                                <th>Name</th>
                                <th>Prize Won</th>
                                <th>Spin Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoster.map((e) => (
                                <tr key={e.agent_id}>
                                    <td>
                                        <span className={`spun-badge ${e.has_spun ? 'yes' : 'no'}`} />
                                        {e.has_spun ? 'Spun' : 'Waiting'}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{e.agent_id}</td>
                                    <td>{e.name}</td>
                                    <td style={{ color: e.prize_won ? 'var(--gold)' : 'var(--text-dim)' }}>
                                        {e.prize_won || '—'}
                                    </td>
                                    <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                                        {e.spin_date ? new Date(e.spin_date).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))}
                            {filteredRoster.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
                                        {roster.length === 0 ? 'No employees imported yet.' : 'No results.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}

            {/* History Tab */}
            {tab === 'History' && (
                <>
                    <div className="history-search-row">
                        <input
                            className="search-input"
                            placeholder="Search history by Agent ID or name…"
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                        />
                        {historySearch && (
                            <button
                                type="button"
                                className="btn btn-secondary history-search-clear"
                                onClick={() => setHistorySearch('')}
                            >
                                Clear
                            </button>
                        )}
                        <label className="show-voided-toggle" title="Reveal voided winners (still available in each prize's Winners panel)">
                            <input
                                type="checkbox"
                                checked={showVoidedHistory}
                                onChange={(e) => setShowVoidedHistory(e.target.checked)}
                            />
                            Show voided
                        </label>
                        <span className="history-search-count">
                            {historySearch
                                ? `${filteredHistory.length} of ${visibleHistory.length}${showVoidedHistory ? '' : ` (${hiddenVoidedCount} voided hidden)`} match`
                                : `${visibleHistory.length} shown${showVoidedHistory ? '' : ` · ${hiddenVoidedCount} voided hidden`}`}
                        </span>
                    </div>

                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Agent ID</th>
                                <th>Name</th>
                                <th>Prize</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((h, idx) => (
                                <tr key={h.id} className={h.voided_at ? 'history-voided' : ''}>
                                    <td style={{ color: 'var(--text-dim)' }}>{idx + 1}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{h.agent_id}</td>
                                    <td>
                                        {h.name}
                                        {h.voided_at && <span className="voided-badge">Voided</span>}
                                    </td>
                                    <td style={{ color: 'var(--gold)' }}>{h.prize}</td>
                                    <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                                        {h.timestamp ? new Date(h.timestamp).toLocaleString() : '—'}
                                    </td>
                                </tr>
                            ))}
                            {filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>
                                        {history.length === 0
                                            ? 'No spins yet.'
                                            : (historySearch
                                                ? `No spins match "${historySearch}".`
                                                : `${hiddenVoidedCount} voided winner${hiddenVoidedCount === 1 ? '' : 's'} hidden. Tick "Show voided" to reveal.`)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}

            {/* Actions Tab */}
            {tab === 'Actions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
                    <div
                        style={{
                            background: 'var(--bg3)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 'var(--radius)',
                            padding: 20,
                        }}
                    >
                        <h3 style={{ marginBottom: 8, color: 'var(--text)' }}>Restock Prizes</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 16 }}>
                            Restores all prizes to their starting quantities. Does not affect the roster or the prize list itself.
                        </p>
                        <button className="btn btn-secondary" onClick={handleResetPrizes}>
                            Restock Prizes
                        </button>
                    </div>

                    <div
                        style={{
                            background: 'var(--bg3)',
                            border: '1px solid rgba(255, 152, 0, 0.3)',
                            borderRadius: 'var(--radius)',
                            padding: 20,
                        }}
                    >
                        <h3 style={{ marginBottom: 8, color: '#ffb74d' }}>Remove All Prizes</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 16 }}>
                            Wipes every prize and every recorded winner. Use <strong>Import CSV</strong> on the Prizes tab
                            to load a new list afterwards.
                        </p>
                        <button className="btn btn-danger" onClick={handleClearAllPrizes}>
                            Remove All Prizes
                        </button>
                    </div>

                    <div
                        style={{
                            background: 'var(--bg3)',
                            border: '1px solid rgba(233,69,96,0.3)',
                            borderRadius: 'var(--radius)',
                            padding: 20,
                        }}
                    >
                        <h3 style={{ marginBottom: 8, color: 'var(--accent)' }}>Clear Roster &amp; History</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: 16 }}>
                            Permanently removes all employees and spin history. Use only to reset for a new event.
                        </p>
                        <button className="btn btn-danger" onClick={handleClearRoster}>
                            Clear Roster &amp; History
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
