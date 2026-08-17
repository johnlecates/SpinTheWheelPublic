# Security Policy

Thank you for helping keep SpinTheWheel and its users safe.

## Supported Versions

The latest tagged release receives security updates. Older versions are
best-effort only.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security-sensitive reports.**

Instead, report privately by emailing:

**`noreply@jlmultiverse.com`**

(Replace with the maintainer's real address if you maintain a fork —
this placeholder prevents spam harvesting from the public repo.)

A good report includes:

- A clear description of the issue and its impact
- Steps to reproduce, or a proof-of-concept if possible
- The version / commit hash affected
- Any known workarounds

You can expect an acknowledgement within a few days. We will work with you
on a coordinated disclosure timeline before any public fix or advisory.

## Scope

This is a self-hosted app. The default admin password is `spinadmin` and
**must be changed** via the `ADMIN_PASSWORD` environment variable before
any real use. See the README for configuration details.

The bundled SQLite database files (`*.db`) and the `backups/` directory are
excluded from this repository and never contain customer data in the
public release.
