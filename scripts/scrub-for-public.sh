#!/usr/bin/env bash
# scrub-for-public.sh
#
# Re-publish a sanitized snapshot of the private SpinTheWheel repo
# (~/SpinTheWheel) into this public repo.
#
# Run this from the public repo root (~/SpinTheWheelPublic):
#
#     ./scripts/scrub-for-public.sh
#
# What it does:
#   1. Wipes everything in this repo except .git/, .gitignore, and
#      scripts/scrub-for-public.sh itself.
#   2. Copies every tracked file from the private repo, EXCEPT the
#      backups/ directory (which contains internal registry URLs).
#   3. Strips real names from backend/seed_prizes.py, replacing them
#      with generic placeholders ("Lunch with Manager A", etc.).
#   4. Updates the roster example in README.md to match the sanitized
#      template (1234567, Amazing Employee).
#   5. Reports exactly what was changed. Nothing is committed or
#      pushed automatically — review the diff and commit when ready.
#
# After running this script:
#
#     git diff --stat
#     git add -A
#     git commit -m "Public release of vX.Y.Z"
#     git tag -a vX.Y.Z -m "Public release of vX.Y.Z"
#     git push public main --tags
#
set -euo pipefail

PRIVATE_REPO="${PRIVATE_REPO:-$HOME/SpinTheWheel}"
PUBLIC_REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$PRIVATE_REPO/.git" ]; then
    echo "ERROR: Private repo not found at $PRIVATE_REPO" >&2
    echo "       Set PRIVATE_REPO=/path/to/private to override." >&2
    exit 1
fi

if [ ! -d "$PUBLIC_REPO/.git" ]; then
    echo "ERROR: This script must be run from inside the public repo." >&2
    exit 1
fi

cd "$PUBLIC_REPO"

echo "==> Wiping public repo working tree (keeping .git, .gitignore, scripts/, .github/, LICENSE, SECURITY.md)..."
# Remove every tracked file except repo-root metadata that we want to
# preserve across scrubs. Update this list when adding new top-level
# public files that the private repo does not have.
git ls-files | grep -vE '^\.gitignore$|^scripts/|^\.github/|^\.?LICENSE$|^\.?SECURITY\.md$' | xargs -r rm -f
# Clean up any empty directories
find . -type d -empty -not -path './.git*' -not -path './scripts' -not -path './.github*' -delete 2>/dev/null || true

echo "==> Copying tracked files from $PRIVATE_REPO..."
cd "$PRIVATE_REPO"
git ls-files | grep -vE '^backups/' | while IFS= read -r f; do
    dest="$PUBLIC_REPO/$f"
    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"
done

cd "$PUBLIC_REPO"

echo "==> Scrubbing backend/seed_prizes.py..."
# This file is hand-maintained in the public repo. To re-apply the
# sanitization automatically, run the included Python helper.
python3 scripts/sanitize_seed_prizes.py backend/seed_prizes.py || true

echo "==> Updating README.md example..."
sed -i 's/^A123456,Jane Doe$/1234567,Amazing Employee/' README.md
sed -i 's|"agent_id": "A123456"|"agent_id": "1234567"|' README.md

echo ""
echo "==> Done. Suggested next steps:"
echo "    git status"
echo "    git diff --stat"
echo "    git add -A && git commit -m 'Public release of vX.Y.Z'"
echo "    git tag -a vX.Y.Z -m 'Public release of vX.Y.Z'"
echo "    git push public main --tags"
