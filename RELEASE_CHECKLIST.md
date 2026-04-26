## Release Checklist

- Update version in `version.txt` and changelog notes.
- Run `npm run check:secrets`.
- Run frontend gates: `npm run lint && npm run typecheck && npm run build`.
- Run backend gates: `cd server && npm run lint`.
- Verify auth flow manually (`signup`, `login`, `logout`).
- Verify realtime test-run flow (`create`, `execute`, `stream`, `cancel`).
- Validate metrics endpoint: `GET /api/metrics/test-runs`.
- Confirm startup guard works: `npm run dev:safe`.
- Ensure no production secrets are committed.
