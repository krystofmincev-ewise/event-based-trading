# Contributing

Thanks for improving Event Edge Lab. Keep changes narrow, explicit, and reviewable; this project treats mathematical semantics and user-facing wording as part of the API contract.

## Local workflow

1. Use Node.js 22.12 or newer and run `npm install`.
2. Create a focused branch from `main`.
3. Keep domain logic in `packages/simulation`; do not introduce React or server dependencies there.
4. Validate unknown HTTP input at the `apps/api` boundary.
5. Add or update tests beside the affected workspace.
6. Run the complete quality gate before requesting review.

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
```

Use `npm run dev` for the combined local app, or `npm run dev:api` and `npm run dev:web` separately.

## Modeling guardrails

- `f` always means premium/capital at risk as a fraction of **current bankroll**.
- `b` always means net profit per unit staked. Preserve `W(1 + fb)` on a win and `W(1 − f)` on a loss.
- Do not relabel payout notional `f/c` as position fraction.
- Treat analytical Kelly as authoritative for the documented IID model. Simulations may compare finite-horizon risk but must not claim to discover the optimum.
- Never call a small positive balance bankruptcy. Practical ruin is a separate, configurable stopped state that retains its threshold-crossing cash.
- Compute maximum drawdown per path before aggregating.
- Keep risk metrics and drawdown numerically valid when displayed capital overflows or underflows.
- Preserve deterministic common random numbers for sizing comparisons when possible.
- Clearly distinguish modeled benchmarks from licensed historical total-return data.
- Do not add execution, broker, credential, telemetry, or personalized-advice features.

Any semantic change should update [docs/METHODOLOGY.md](docs/METHODOLOGY.md), the API definitions/warnings, and exact tests together.

## TypeScript and UI conventions

- Keep strict TypeScript and avoid production `any`.
- Prefer small pure functions and typed adapters over broad assertions.
- Use semantic HTML, proper labels, visible focus, and keyboard-operable controls.
- Charts need a textual summary or keyboard-readable interaction; color cannot be the only meaning.
- Respect reduced motion and verify 390 px, tablet, and desktop widths without horizontal overflow.
- Avoid committing generated `dist`, coverage, or `*.tsbuildinfo` artifacts.

## Pull request notes

Describe the user-visible change, the mathematical or API contract affected, the checks run, and any remaining caveat. Screenshots are useful for visual changes but do not replace interaction or accessibility verification.
