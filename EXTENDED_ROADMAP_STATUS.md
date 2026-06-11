# Extended Roadmap Status

Date: 2026-06-11

## Implemented in this repo

- Real-time community chat
  - Member chat feed and posting for `Global` and `Live`
  - Admin moderation queue for chat messages
- Testimonies
  - Member submission flow
  - Public approved feed
  - Admin approve / reject / feature flow
- QR check-in
  - Member QR/check-in code screen
  - Admin verification flow and recent attendance log
- Reading plans
  - Member plan list, detail view, and per-day completion tracking
- Card payments
  - Hosted card checkout initialization
  - Local sandbox mock checkout for development when Flutterwave keys are absent
- Bible version direct-download integration
  - Provider-backed version catalog endpoint
  - Device-side offline install into SQLite
  - Installed version management in the Bible library
- Release/store rollout preparation
  - Android release runbook
  - Play Store submission checklist

## Still manual outside the repo

These are not code gaps. They require external credentials, accounts, or operator action:

- Flutterwave production keys and webhook setup
- Final Daraja production keys
- Final production backend deployment and domain wiring
- EAS/keystore ownership and release signing secrets
- Play Store Console listing entry, uploads, rollout, and policy declarations
- Final smoke testing on real signed builds

## Practical completion line

The original extended roadmap is complete for local development and code scope.

The remaining work is operational release execution, not feature implementation.
