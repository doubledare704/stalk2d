# Verification — 2026-10-20

## Automated

- `npm run build`: strict TypeScript and Vite production build pass.
- `npm test`: 3 tests pass. Coverage: reproducible seeded routes across 1,000 seeds, required route endpoints/trader, frame-rate-independent radiation damage, malformed/unsupported save handling and progression bounds.
- Vite reports the expected large Phaser engine bundle warning (approximately 1.41 MB minified, 380 KB gzip).

## Built-in browser

Verified on the live Vite server at http://127.0.0.1:5173/:

- Menu and canvas render with Ukrainian text.
- Entire canvas and HUD fit a 1280×720 viewport after a layout correction.
- Start and repeat expedition; WASD movement and E airlock transition.
- Sustained mouse fire, enemy hits/kills, incoming damage, automatic reload.
- Anomaly field traversal, radiation accumulation, F anti-rad consumption.
- Artifact selection changes max health and adds to artifact count.
- Clear a combat room, receive artifact choice, shotgun unlock, medkit and credits, and unlocked exit.
- Q healing restores health and consumes a medkit.
- Escape pause and resume.
- Death/results, return to stash, saved credits and best sector survive page reload.
- No console errors observed after final fixes.

A close-contact issue found during play (enemy overlap could put them behind the muzzle) was corrected by limiting enemy approach distance; subsequent combat clearance succeeded.

## Still requiring playtesting

- Full winning run, final boss balance, extraction ending.
- Trader purchases and permanent-upgrade purchase UI.
- Emission timing and safe-room protection over a complete cycle.
- Audible quality of synthesized sound, browser compatibility, accessibility, and measured performance on target hardware.

Graphics are procedural placeholders. Encounter layouts are a linear seeded route, not a branching room graph. Reload reserves are intentionally unlimited for this arcade slice. No production readiness or FPS target is claimed.

## Armored sentinel update

- Added a guaranteed armored sentinel per combat room, with additional late-sector spawn chances.
- `npm test`: 6 tests pass, including new cover-intersection, body-clearance pursuit, and predictive-aim checks.
- Browser: verified new armor/name rendering, slow approach, survival under pistol fire, ranged incoming damage, and aiming beam while the player moves. No console errors observed.
- Full-run difficulty, late-sector groups, and every cover/burst interruption combination remain unverified in browser play.
- Monolith wishes are design documentation only.

## Extended campaign update

- Route expanded to 26 sectors, three eight-sector chapters plus entrance/extraction.
- Six boss arenas contain [1, 1, 2, 2, 3, 3] simultaneous bosses; three distinct boss definitions implement rings, charges and aimed fans.
- Combat duration scales to 1–4 waves. Exit/reward gating is shared with tested encounter progression logic.
- Nine automated tests pass: includes route structure across 1,000 seeds, boss composition, wave completion gates, attack patterns and preservation of old saves.
- Production build passes; the existing Phaser bundle size warning remains.
- Browser smoke checks: single, dual and triple boss spawning, separate health bars, chapter HUD, mixed attacks, movement/pause and four-wave sector initialization. No console errors observed.
- Encounter previews use a development-only query and suppress stash/save writes. Returning to normal menu retained the original 10 stash credits and best sector 2.
- Full 26-sector playthrough, complete runtime wave transitions, group boss clearance, and campaign pacing/balance remain unverified. No completion-time or difficulty measurements are claimed.
