import { useState, useRef } from 'react';
import { getEmployee, spin } from '../api.js';

export default function EmployeeEntry({ wheelLayout, onSpinResult }) {
    const [agentId, setAgentId] = useState('');
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    const lookup = async (id) => {
        const trimmed = id.trim().toUpperCase();
        if (!trimmed) { setEmployee(null); setError(''); return; }
        setLoading(true);
        setError('');
        try {
            const emp = await getEmployee(trimmed);
            setEmployee(emp);
        } catch (e) {
            setEmployee(null);
            if (!e.message.includes('not found')) setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const val = e.target.value.toUpperCase();
        setAgentId(val);
        if (val.length >= 3) lookup(val);
        else { setEmployee(null); setError(''); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && employee && !employee.has_spun) handleSpin();
    };

    const handleSpin = async () => {
        if (!employee || employee.has_spun || spinning) return;
        setSpinning(true);
        setError('');
        try {
            const result = await spin(agentId.trim().toUpperCase());
            onSpinResult(result);
        } catch (e) {
            setError(e.message);
            setSpinning(false);
        }
    };

    const canSpin = employee && !employee.has_spun && !spinning;

    return (
        <div className="entry-container">
            <div className="entry-card">
                <h2>ENTER AGENT ID</h2>
                <div className="entry-sub">INGRESE SU ID DE AGENTE</div>
                <input
                    ref={inputRef}
                    className="agent-input"
                    type="text"
                    value={agentId}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="A123456"
                    autoFocus
                    maxLength={10}
                />

                {loading && <p className="loading" style={{ marginTop: 12 }}>Looking up… · Buscando…</p>}

                {employee && !loading && (
                    <div className="employee-preview">
                        <div className="emp-name">{employee.name}</div>
                        <div className="emp-id">{employee.agent_id}</div>
                        {employee.has_spun && (
                            <div className="already-spun">
                                <div>✗ Already spun — won: {employee.prize_won}</div>
                                <div className="es-sub">✗ Ya giró — ganó: {employee.prize_won}</div>
                            </div>
                        )}
                    </div>
                )}

                {error && <p className="error-msg">{error}</p>}

                <button
                    className="spin-btn"
                    onClick={handleSpin}
                    disabled={!canSpin}
                >
                    <span className="btn-main">
                        {spinning ? 'SPINNING…' : 'SPIN THE WHEEL'}
                    </span>
                    <span className="btn-es">
                        {spinning ? 'GIRANDO…' : 'GIRAR LA RUEDA'}
                    </span>
                </button>
            </div>
        </div>
    );
}
