# Repository Guidelines

## Project Structure & Module Organization
This is the **public release** of the SpinTheWheel prize wheel game for company events.
- **Backend (`./backend`)**: FastAPI application using SQLAlchemy with SQLite. Organized into `app/api` (endpoints), `app/models` (SQLAlchemy models), `app/schemas` (Pydantic models), and `app/services` (business logic).
- **Frontend (`./frontend`)**: React/Vite application. The main interface includes the player-facing wheel, admin panel, and bilingual UI (EN/ES).
- **Real-time Communication**: Uses standard HTTP requests; no WebSocket/SSE required for current functionality.

## Build, Test, and Development Commands
The system is managed via root-level orchestration scripts.
- **Start Dev Services**: `./start-dev.sh`
- **Frontend Dev**: `cd ./frontend && npm run dev`
- **Frontend Build**: `cd ./frontend && npm run build`
- **Backend Dev**: `cd ./backend && source venv/bin/activate && uvicorn app.main:app --reload`
- **Docker Deploy**: `docker compose up --build`

## Coding Style & Naming Conventions
Development is governed by strict requirements in `./CONVENTIONS.md`.
- **Master Build Contract**: Every change requires a documented design phase including a function map, call tree, transaction scope, and risk assessment BEFORE generating code.
- **Release Checklist**: Every update must include a `README.md` update, a version bump, and an annotated git tag.
- **Linting**: Frontend code must pass ESLint when configured.

## Testing Guidelines
There is currently no automated test suite. Manual verification via the Admin panel and player interface is required. API verification should be performed via Swagger at `http://localhost:8001/docs`.

## Commit & Pull Request Guidelines
- **Commit Messages**: Use descriptive, prefix-based messages (e.g., `docs:`, `fix:`, `feat:`).
- **Releases**: Annotated tags (e.g., `git tag -a v1.5.3 -m "Release summary"`) are mandatory for all version bumps.
- **Pushing**: Always push commits and tags to all configured remotes: `git push <remote> main --tags`.

## Public Release Notes
This repository is the public-facing version of SpinTheWheel. The seed data in `backend/seed_prizes.py` is intentionally generic (no real names, no brand-specific items). The included `roster.csv` and `prizes.csv` are templates only — replace them with your own data before using the app in production.