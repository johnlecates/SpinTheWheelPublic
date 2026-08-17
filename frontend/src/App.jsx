import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import EmployeeEntry from './components/EmployeeEntry.jsx';
import SpinWheel from './components/SpinWheel.jsx';
import WinnerDisplay from './components/WinnerDisplay.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import AdminGate from './components/AdminGate.jsx';
import { getWheelLayout, isAdminAuthed, setAdminAuthed, clearAdminAuth } from './api.js';

// Screens for the main spin flow
const SCREEN = { ENTRY: 'entry', SPINNING: 'spinning', WINNER: 'winner' };

function SpinFlow() {
    const [screen, setScreen] = useState(SCREEN.ENTRY);
    const [wheelLayout, setWheelLayout] = useState([]);
    const [spinResult, setSpinResult] = useState(null); // {employee, prize, wheel_layout}

    useEffect(() => {
        getWheelLayout().then(setWheelLayout).catch(console.error);
    }, []);

    const handleSpinResult = (result) => {
        // wheel_layout from spin response is the post-decrement layout
        setWheelLayout(result.wheel_layout);
        setSpinResult(result);
        setScreen(SCREEN.SPINNING);
    };

    const handleSpinComplete = () => {
        setScreen(SCREEN.WINNER);
    };

    const handleWinnerDismiss = () => {
        setSpinResult(null);
        setScreen(SCREEN.ENTRY);
    };

    return (
        <div className="spin-flow">
            <header className="app-header">
                <h1 className="app-title">🎡 SPIN THE WHEEL</h1>
                <Link to="/admin" className="admin-link">Admin</Link>
            </header>

            {screen === SCREEN.ENTRY && (
                <EmployeeEntry
                    wheelLayout={wheelLayout}
                    onSpinResult={handleSpinResult}
                />
            )}

            {screen === SCREEN.SPINNING && spinResult && (
                <SpinWheel
                    wheelLayout={spinResult.wheel_layout.length > 0 ? spinResult.wheel_layout : wheelLayout}
                    targetPrizeId={spinResult.prize.id}
                    onSpinComplete={handleSpinComplete}
                />
            )}

            {screen === SCREEN.WINNER && spinResult && (
                <WinnerDisplay
                    employee={spinResult.employee}
                    prize={spinResult.prize}
                    onDismiss={handleWinnerDismiss}
                />
            )}
        </div>
    );
}

/**
 * Wrapper for the /admin route. Checks sessionStorage for a previously
 * authenticated session; if absent, renders the AdminGate password prompt
 * instead of the actual AdminPanel.
 */
function ProtectedAdmin() {
    const [authed, setAuthed] = useState(isAdminAuthed());

    const handleAuthenticated = () => {
        setAdminAuthed();
        setAuthed(true);
    };

    const handleCancel = () => {
        // user chose to back out; clear any stale auth just in case
        clearAdminAuth();
    };

    if (authed) {
        return <AdminPanel />;
    }

    return <AdminGate onAuthenticated={handleAuthenticated} onCancel={handleCancel} />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<SpinFlow />} />
                <Route path="/admin" element={<ProtectedAdmin />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
