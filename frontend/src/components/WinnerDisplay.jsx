import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

const DISMISS_SECONDS = 5;

// Spanish translations for the seeded prize winner messages so the "You Won"
// screen is fully bilingual. Falls back to the English text when a prize
// message (e.g. one edited in the admin panel) has no known translation.
const WINNER_MSG_ES = {
    'An item of your choice from Prize Segment 1!': '¡Un artículo de su elección del Segmento de Premios 1!',
    'An item of your choice from Prize Segment 2!': '¡Un artículo de su elección del Segmento de Premios 2!',
    'You won a $50 Logo Prize Order!': '¡Ganó un Pedido de Premio de Logotipo de $50!',
    'You won a $25 Logo Prize Order!': '¡Ganó un Pedido de Premio de Logotipo de $25!',
    'An item of your choice from Prize Segment 5!': '¡Un artículo de su elección del Segmento de Premios 5!',
    'You won a Stress Ball!': '¡Ganó una Pelota Antiestrés!',
    'You won a Shirt!': '¡Ganó una Camiseta!',
    'You won Reserved Parking!': '¡Ganó Estacionamiento Reservado!',
    'You won Lunch with April Wagner!': '¡Ganó un Almuerzo con April Wagner!',
    'You won Lunch with DJ Jesus!': '¡Ganó un Almuerzo con DJ Jesus!',
    'You won Lunch with Billy Fidoe!': '¡Ganó un Almuerzo con Billy Fidoe!',
    'You won Lunch with Kevin King!': '¡Ganó un Almuerzo con Kevin King!',
    'You won Lunch with John Curtsinger!': '¡Ganó un Almuerzo con John Curtsinger!',
};

const winnerMsgEs = (msg) => WINNER_MSG_ES[msg] || '';

const TIER_CONFIG = {
    premium: {
        badge: '🌟',
        confettiOptions: {
            particleCount: 250,
            spread: 100,
            startVelocity: 55,
            colors: ['#FFD700', '#FFA500', '#FF6347', '#FFFFFF'],
        },
        extraConfetti: true,
    },
    mid: {
        badge: '🎉',
        confettiOptions: {
            particleCount: 120,
            spread: 80,
            startVelocity: 45,
            colors: ['#FFD700', '#9C27B0', '#4CAF50', '#FFFFFF'],
        },
        extraConfetti: false,
    },
    standard: {
        badge: '🎊',
        confettiOptions: {
            particleCount: 80,
            spread: 70,
            startVelocity: 40,
        },
        extraConfetti: false,
    },
};

export default function WinnerDisplay({ employee, prize, onDismiss }) {
    const timerRef = useRef(null);
    const tier = prize.tier || 'standard';
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG.standard;
    const isPremium = tier === 'premium';

    useEffect(() => {
        // Fire confetti
        const fireAt = (x, y) =>
            confetti({ ...cfg.confettiOptions, origin: { x, y } });

        fireAt(0.5, 0.4);

        if (cfg.extraConfetti) {
            setTimeout(() => fireAt(0.2, 0.5), 400);
            setTimeout(() => fireAt(0.8, 0.5), 800);
            setTimeout(() => fireAt(0.5, 0.3), 1200);
        }

        timerRef.current = setTimeout(onDismiss, DISMISS_SECONDS * 1000);
        return () => clearTimeout(timerRef.current);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className={`winner-overlay${isPremium ? ' premium' : ''}`} onClick={onDismiss}>
            {isPremium ? (
                <div className="premium-star">{cfg.badge}</div>
            ) : (
                <div className="winner-badge">{cfg.badge}</div>
            )}

            <div className="winner-label">
                CONGRATULATIONS
                <div className="es-sub">¡FELICIDADES!</div>
            </div>

            <div className="winner-name">{employee.name}</div>

            <div className="winner-won">
                WON
                <div className="es-sub">¡GANÓ!</div>
            </div>

            <div className="winner-prize">
                {prize.winner_message}
                {winnerMsgEs(prize.winner_message) && (
                    <div className="es-sub">{winnerMsgEs(prize.winner_message)}</div>
                )}
            </div>

            {prize.is_multi_item && prize.items && prize.items.length > 0 && (
                <>
                    <div className="winner-items">
                        {prize.items.map((item) => (
                            <span key={item} className="winner-item-chip">{item}</span>
                        ))}
                    </div>
                    <div className="winner-instruction">
                        <div>Please visit the prize table to make your selection.</div>
                        <div className="es-sub">Por favor visite la mesa de premios para hacer su selección.</div>
                    </div>
                </>
            )}

            {isPremium && (
                <div className="winner-instruction" style={{ color: '#FFD700', fontWeight: 600 }}>
                    <div>See an event coordinator to claim your prize!</div>
                    <div className="es-sub">¡Consulte a un coordinador del evento para reclamar su premio!</div>
                </div>
            )}

            <div className="winner-dismiss-bar" />
        </div>
    );
}
