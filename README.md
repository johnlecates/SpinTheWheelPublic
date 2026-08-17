# SpinTheWheel

A self-service prize wheel game for company events. Players enter their agent ID, spin the wheel, and win a prize — with all player-facing text shown in **English and Spanish**.

## About this repository

This is the **public** release of SpinTheWheel. The seed data in `backend/seed_prizes.py` is intentionally generic (no real names, no brand-specific items), and the included `roster.csv` and `prizes.csv` are templates only — replace them with your own data before using the app in production.

Inquiries and bug reports are welcome via the [GitHub Issues](../../issues) tab.

## Features

- **Agent entry** — players type their agent ID; the roster is looked up live and the employee's name is shown before they spin
- **Prize wheel** — animated canvas wheel that lands on a prize weighted by remaining inventory (each spin lasts ~7–9 seconds)
- **You Won screen** — celebratory confetti overlay with the prize; auto-dismisses after ~5 seconds so the next player can go
- **Bilingual UI (EN/ES)** — all player-facing text (agent entry and winner screens) is shown in English and Spanish
- **Admin panel** — password-protected: roster import / manual add / clear, prize inventory & reset, spin history, and stats
- **Prize management** — add, edit, and remove prizes from the admin panel; every prize's odds are recalculated automatically (weighted by remaining quantity)
- **Per-prize winners** — click any prize to see who has won it, with a live search by name or Agent ID
- **One spin per employee** — the roster prevents duplicate plays and records what each employee won
- **Audit history** — every spin is recorded with timestamp, employee, and prize

## Tech Stack

- **Backend:** Python / FastAPI + SQLAlchemy + SQLite
- **Frontend:** React 18 + Vite + canvas-confetti
- **Deploy:** Docker Compose (nginx static frontend + uvicorn API)

## Quick Start

### Development (no Docker)

```bash
./start-dev.sh
```

- Backend → http://localhost:8001
- Frontend → http://localhost:5174
- Admin → http://localhost:5174/admin (default password: `spinadmin` — **change this via the `ADMIN_PASSWORD` env var before any real use**)

### Docker

```bash
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8001

## Roster Import

The roster is a CSV with two columns: `AgentID,Name` (a header row is optional and skipped).

```csv
1234567,Amazing Employee
B234567,John Smith
```

Import it from the Admin panel, or via the API:

```bash
curl -X POST http://localhost:8001/admin/roster/import -F "file=@roster.csv"
```

## Prize Import

Prize CSV columns (case-insensitive headers; only `DisplayName` and `Quantity` are required):

| Column | Required | Default | Notes |
| --- | --- | --- | --- |
| `DisplayName` | yes | — | Full name shown in the winners panel |
| `Quantity` | yes | — | Starting quantity (also used as Remaining) |
| `WheelLabel` | no | DisplayName | Short text shown on the wheel wedge |
| `Color` | no | `#2196F3` | 7-char hex like `#FF0000` |
| `Tier` | no | `standard` | One of `standard`, `mid`, `premium` |
| `IsMultiItem` | no | `false` | `true`/`false`/`1`/`0` |
| `Items` | no | — | Comma-separated item names; only used when `IsMultiItem=true`. Quote the field if items contain commas: `"Backpack,Sandals,Flashlight"` |
| `WinnerMessage` | no | `You won {DisplayName}!` | Shown on the winner screen |
| `Description` | no | — | Free-text shown next to name in admin |
| `SliceCount` | no | `2` | Cosmetic only — the wheel always renders 2 slices per active prize |

Blank rows and lines starting with `#` are ignored.

Sample CSV:

```csv
DisplayName,Quantity,Color,Tier,IsMultiItem,Items,WinnerMessage
Backpack,10,#FF0000,standard,true,"Backpack,Sandals,Flashlight",You won a Backpack!
Shirt,250,#2196F3,standard,false,,You won a Shirt!
Reserved Parking,2,#37474F,premium,false,,You won Reserved Parking!
```

Upload it from the **Prizes** tab via **📥 Import CSV**. The import is additive — use **Remove All Prizes** in the Actions tab first to start from scratch.

## Game Flow

1. Player types their agent ID on the entry screen (text is bilingual EN/ES).
2. If the employee is found and hasn't spun yet, they tap **Spin the Wheel / Girar la Rueda**.
3. The wheel spins for ~7–9 seconds and lands on a prize chosen by the backend weighted by remaining inventory.
4. The **You Won / ¡Ganó!** screen shows the prize with confetti and auto-dismisses after ~5 seconds, returning to the entry screen for the next player.

## Admin Panel

- URL: `/admin`
- Password: configurable via the `ADMIN_PASSWORD` environment variable (default `spinadmin`)

Admin capabilities:

- Import / clear the roster, or add a single agent manually (late entry)
- View prize inventory, reset quantities, or re-seed the default prizes
- **Add a prize** — set name, quantity, tier, color, slice count, and optional multi-item list; it joins the wheel immediately
- **Edit a prize** — change name, quantity, tier, color, slice count, winner message, or multi-item list. The Edit form also has a **Remaining** field to adjust available inventory independently (useful when more prizes are delivered or some are lost/broken); it is clamped to [0, starting_qty]. Reducing `starting_qty` below the remaining count clamps `remaining_qty` down (past wins are not refunded); removed prizes can't be edited
- **Remove a prize** — deactivates it so it drops off the wheel and remaining players' odds are rebalanced; its spin history is preserved
- **Restore a removed prize** — brings a removed prize back, restocking it to its starting quantity so it re-enters the wheel. Use Edit to fine-tune the Remaining field after restoring
- **Bulk import (CSV)** — upload a CSV from the Prizes tab to add many prizes at once. The import is **additive**; use **Remove All Prizes** (Actions tab) to start from scratch first
- **Remove all prizes (Actions tab)** — wipes every prize and every recorded winner. Use before a fresh import to "start from scratch"
- **Void a winner** — from a prize's Winners list, void a single spin. Optionally returns the prize to the inventory pool (`+1` remaining, capped at starting quantity) and/or clears the employee's spin record so they can spin again. Voided rows are kept in the list (faded) and can be restored with one click — useful for testing and for winners who decline their prize
- **View per-prize winners** — click **Winners** on any prize to see who has won it, with a search box for name or Agent ID (handy for high-quantity prizes)
- Review spin history and roster/prize stats

## API

### Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/wheel/layout` | Current wheel slices (prizes with remaining inventory) |
| GET | `/employee/{agent_id}` | Look up an employee by agent ID |
| POST | `/spin` | Spin the wheel for an employee (`{ "agent_id": "1234567" }`) |

### Admin

| Method | Path | Description |
| --- | --- | --- |
| POST | `/admin/login` | Validate the admin password |
| POST | `/admin/roster/import` | Upload roster CSV |
| POST | `/admin/roster/manual` | Add a single agent by ID + name |
| GET | `/admin/roster` | List all employees |
| DELETE | `/admin/roster` | Clear roster + spin history |
| GET | `/admin/prizes` | List prize inventory |
| POST | `/admin/prizes` | Add a custom prize (`PrizeCreate`) |
| PUT | `/admin/prizes/{prize_id}` | Edit a prize (`PrizeUpdate` — any subset of fields) |
| DELETE | `/admin/prizes/{prize_id}` | Remove (deactivate) a prize; history is kept |
| POST | `/admin/prizes/{prize_id}/restore` | Restore a removed prize (restocks to starting_qty) |
| GET | `/admin/prizes/{prize_id}/winners` | List a prize's winners, optional `?q=` search |
| POST | `/admin/prizes/{prize_id}/winners/{agent_id}/void` | Void a win; body `{restore_prize, reset_employee}` (both default true) |
| POST | `/admin/prizes/{prize_id}/winners/{agent_id}/unvoid` | Undo a previous void |
| DELETE | `/admin/prizes/all` | Wipe all prizes + spin history (use before a fresh import) |
| POST | `/admin/prizes/import` | Bulk-import prizes from a CSV (multipart) |
| POST | `/admin/prizes/reset` | Restore starting quantities |
| POST | `/admin/prizes/reseed` | Wipe and re-seed default prizes |
| GET | `/admin/history` | Spin history |
| GET | `/admin/stats` | Roster / prize / spin stats |

## Prize Configuration

Default prizes (13 segments) are defined in `backend/seed_prizes.py`:

- Multi-item segments (pick one: Backpack/Sandals/…, Cup, Hat/Bat)
- Logo prize orders ($25 / $50)
- Swag (Stress Ball, Shirt)
- Premium (Reserved Parking, Lunch with …)

Each prize has a `wheel_label`, `winner_message`, `tier` (standard/mid/premium), `wheel_color`, starting/remaining quantity, and an optional multi-item list. The **You Won** screen translates the default `winner_message` values into Spanish automatically; custom messages fall back to English-only.

### How probability and slice count work

These are **two independent things** and both update automatically:

- **Odds (probability of winning)** — weighted by `remaining_qty` across *active* prizes only. Any change to `remaining_qty` (via Edit, Add, Remove, Void, or an inventory adjustment) is reflected on the very next spin. The **Odds** column in the Prizes tab shows the live percentage.
- **Visual slice count** — the wheel always renders **2 slices per active prize** (purely cosmetic). The slice count has no effect on the actual probability of winning — the backend's weighted draw is based on `remaining_qty` exclusively. The `display_slice_count` field still exists on each prize for potential future use but is currently ignored.

### Probability & adding/removing prizes

Prize probability is **weighted by remaining quantity** across *active* prizes only, so it refactors automatically:

- **Add a prize** → it joins the wheel with its starting quantity and claims its proportional share of the odds.
- **Edit a prize** → only the fields you change are updated, and the new `starting_qty`/`remaining_qty` immediately rebalance every prize's odds. If `starting_qty` is reduced below `remaining_qty`, `remaining_qty` is clamped down (past wins are not refunded). Removed prizes cannot be edited.
- **Remove a prize** → it is deactivated (`is_active = false`) and its remaining quantity zeroed, so it drops off the wheel and the remaining prizes' odds are recalculated proportionally. Its spin history is kept.

The Prizes tab keeps any open **Winners** panel and **Edit** form in sync with the latest data after every change, so a renamed prize shows the new name everywhere without needing a manual refresh.
- The **Prizes** tab in the admin panel shows each prize's live **Odds %** (`remaining ÷ total remaining`), so you can see the rebalanced probabilities after any change.

## Multiple Remotes

A `docs/REMOTES.md` template is included with placeholder URLs you can adapt to your own Git hosting (GitHub, Gitea, GitLab, etc.). Per-host credentials and remote URLs are not tracked in this repo — copy the template locally and edit it to suit your setup.

