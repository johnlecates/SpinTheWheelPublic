#!/usr/bin/env python3
"""Sanitize backend/seed_prizes.py for public release.

Replaces real names (e.g. "Lunch with April Wagner") with generic
placeholders ("Lunch with Manager A"). Idempotent — safe to run on
an already-sanitized file.
"""
import re
import sys
from pathlib import Path

# Map of (display_name, wheel_label, winner_message, description) tuples
# to replace. Add more here as needed if new real names appear in
# future private seeds.
REPLACEMENTS = [
    # The five "Lunch with ..." premium prizes — these had real colleague
    # names in the private repo. Replace with Manager A..E.
    (r'"Lunch w/ April"',            '"Lunch A"'),
    (r'"Lunch with DJ Jesus"',       '"Lunch with Manager B"'),
    (r'"Lunch with Billy Fidoe"',    '"Lunch with Manager C"'),
    (r'"Lunch with Kevin King"',     '"Lunch with Manager D"'),
    (r'"Lunch with John Curtsinger"','"Lunch with Manager E"'),
    (r'"Lunch w/ April"',            '"Lunch A"'),
    (r'"Lunch w/ DJ"',               '"Lunch B"'),
    (r'"Lunch w/ Billy"',            '"Lunch C"'),
    (r'"Lunch w/ Kevin"',            '"Lunch D"'),
    (r'"Lunch w/ John"',             '"Lunch E"'),
    # All "Lunch with <name>" patterns (catches anything new)
    (r'"Lunch with [A-Z][a-z]+ [A-Z][a-z]+!"', '"Lunch with Manager A!"'),
    (r'"Lunch with [A-Z][a-z]+ [A-Z][a-z]+"',  '"Lunch with Manager A"'),
    # "Carl Edwards Car" item (NASCAR reference — Best Buy specific promo)
    (r'Carl Edwards Car', 'Item 3'),
    # "$50 Logo Prize Order" / "$25 Logo Prize Order" — the "Logo" implied
    # a branded swag program. Genericize.
    (r'"\$50 Logo Prize Order"',  '"$50 Prize Order"'),
    (r'"\$50 Logo"',              '"$50 Order"'),
    (r'"\$25 Logo Prize Order"',  '"$25 Prize Order"'),
    (r'"\$25 Logo"',              '"$25 Order"'),
    # "Prize Segment N" — genericize to "Prize Bucket N"
    (r'"Prize Segment 1"', '"Prize Bucket A"'),
    (r'"Prize Segment 2"', '"Prize Bucket B"'),
    (r'"Prize Segment 5"', '"Prize Bucket C"'),
    (r'"Mix Seg\. 1"',     '"Bucket A"'),
    (r'"Cup"',             '"Bucket B"'),
    (r'"Hat / Bat"',       '"Bucket C"'),
    (r'"Shirt"',           '"T-Shirt"'),
    (r'"Reserved Pkg"',    '"Parking"'),
    (r'"Backpack, Sandals, Carl Edwards Car, Flashlight"',
     '"Item 1, Item 2, Item 3"'),
    (r'\[ "Backpack", "Sandals", "Carl Edwards Car", "Flashlight" \]',
     '[ "Item 1", "Item 2", "Item 3" ]'),
]

def main(path: str = "backend/seed_prizes.py") -> int:
    p = Path(path)
    if not p.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        return 1
    text = p.read_text()
    original = text
    n = 0
    for pattern, replacement in REPLACEMENTS:
        new_text, count = re.subn(pattern, replacement, text)
        if count:
            text = new_text
            n += count
    if text == original:
        print(f"OK: {path} already sanitized (no replacements needed)")
        return 0
    p.write_text(text)
    print(f"OK: {path} sanitized ({n} replacements applied)")
    return 0

if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]) if len(sys.argv) > 1 else main())
