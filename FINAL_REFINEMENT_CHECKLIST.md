# Final Refinement Checklist

Date: 2026-06-12

## Completed in this pass

- Live chat push polish
  - realtime connection status in the Live screen
  - reconnect state messaging
  - active-stream-only chat transport remains enforced

- Giving polish
  - pending transaction summary in Giving History
  - refresh-pending action
  - auto-refresh pass when opening Give History with pending items

- Bible download polish
  - clearer install progress stages
  - catalog error feedback
  - empty-search guidance in the version library
  - confirmation before removing a downloaded version

- Admin live-config polish
  - pasted YouTube URLs are normalized to IDs
  - quick `Go Live Now` and `Mark Offline` actions

## Still external, not code gaps

- production credentials
  - Daraja
  - Flutterwave
  - OneSignal

- signed release flow
  - keystore ownership
  - APK/AAB signing
  - Play Store upload and rollout

- final device QA
  - real signed-build smoke tests
  - production notification verification
  - payment verification against real provider configs

## Practical close line

Feature work is complete.

What remains is release execution, production secrets, and final real-device QA.
