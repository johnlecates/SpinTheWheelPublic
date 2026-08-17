import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminLogin } from '../api.js';

/**
 * Password gate for the admin panel.
 *
 * Renders a centered password prompt. On successful login the user is
 * persisted for the rest of the browser session (via the parent's auth
 * state) and the children (the actual admin panel) are mounted.
 *
 * Props:
 *   onAuthenticated: () => void  — called once the password is accepted
 *   onCancel:        () => void  — called when the user backs out
 */
export default function AdminGate({ onAuthenticated, onCancel }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password || submitting) return;
        setError('');
        setSubmitting(true);
        try {
            await adminLogin(password);
            onAuthenticated();
        } catch (err) {
            setError(err.message || 'Incorrect password');
            setPassword('');
            inputRef.current?.focus();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-gate-page">
            <div className="admin-gate-card">
                <div className="admin-gate-icon">🔒</div>
                <h1 className="admin-gate-title">ADMIN ACCESS</h1>
                <p className="admin-gate-subtitle">Enter the admin password to continue</p>

                <form onSubmit={handleSubmit} className="admin-gate-form">
                    <input
                        ref={inputRef}
                        type="password"
                        className="admin-gate-input"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError('');
                        }}
                        autoComplete="current-password"
                        disabled={submitting}
                    />
                    {error && <div className="admin-gate-error">{error}</div>}
                    <button
                        type="submit"
                        className="admin-gate-submit"
                        disabled={!password || submitting}
                    >
                        {submitting ? 'Checking…' : 'Unlock'}
                    </button>
                </form>

                <Link to="/" className="admin-gate-back" onClick={onCancel}>
                    ← Back to Spin
                </Link>
            </div>
        </div>
    );
}
