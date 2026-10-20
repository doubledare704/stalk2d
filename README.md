# ЗОНА — Останній сигнал

An original Ukrainian Zone-inspired top-down roguelite, built with Phaser 4.2.1, TypeScript and Vite. All world graphics are drawn in code; no third-party game art is required. Optional Google Fonts have system fallbacks.

## Run

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`

Desktop keyboard and mouse are required. WASD/arrows move, mouse aims and fires, R reloads, 1–3 switch unlocked weapons, Q heals, F reduces radiation, E interacts with the right-hand airlock or central trader, Escape pauses. Window blur pauses combat. Enable sound with the header button.

## Expedition

26 connected sectors across three chapters. Each chapter has three combat sectors, two anomaly fields, one trader and two boss arenas. Boss arenas contain one simultaneous boss in chapter one, two in chapter two and three in chapter three. The final sector is extraction.

Combat rooms grow from 1–2 waves in chapter one to 3–4 waves in chapter three. A 2.2-second reinforcement warning separates waves. Doors remain locked until every wave is defeated. Wave sizes rise to a cap of eight enemies. Every finished combat sector grants a medkit, anti-rad and supply credits; boss clearance grants two medkits, additional credits, healing and radiation removal. Every cleared boss arena also grants an artifact choice.

Bosses have distinct patterns: **Вартовий** fires rotating rings, **Руйнівник** telegraphs a charge, and **Пророк** fires aimed fans. Mixed late-game groups have separate health bars and staggered initial attacks. Clear all of them to open the exit.

Cross anomaly fields to earn an artifact. Use E at the right airlock to proceed. The first cleared combat sector grants a shotgun; clearing the first boss unlocks a rifle. Purchase supplies at the three trader stops. Reload ammunition is unlimited in this arcade prototype.

Artifacts stack until the run ends. Radiation above 50 causes continuous damage. Hazards telegraph their active phase. Every 90 seconds an emission adds radiation unless in the trader sector. A warning appears for the final 12 seconds. Medkits restore 45 HP; anti-rad removes 45 radiation.

Death and extraction award stash credits. Buy up to five permanent +10 HP upgrades from the menu. Local save key: `zona-save`; malformed saves recover to defaults. Current expeditions are not saved. Saves are local to this browser.

## Structure

- `src/gameplay/model.ts`: seeded generation, content definitions, save validation, radiation rules.
- `src/scenes/ZoneScene.ts`: gameplay state machine, collision/movement, combat, drawing and interaction.
- `src/main.ts`, `src/style.css`: Phaser setup and responsive terminal shell.

## Scope

This is a playable vertical slice with procedural placeholder pixel graphics and synthesized sound effects. The room graph is a linear route assembled from encounter types, not a branching dungeon. Collision uses axis-aligned bounds appropriate for the small encounter sizes. No multiplayer, touch controls, mid-run saves, or production audio assets. Test pacing and balance through play before treating this as a finished release.

## Armored ranged enemies

Every combat sector includes a **Наглядач**; later sectors may include additional ones. They have 220 + 24 × chapter HP, move at 42 px/s, navigate around cover, and acquire targets up to 1,050 px away. They lead movement before locking their aim for 180 ms and firing a three-shot burst. A red aiming beam telegraphs the shot. Break line of sight to interrupt acquisition or the remaining burst. Their projectiles deal 12 damage and travel at 350 px/s. They drop 24 supply credits.

The Monolith finale is currently a [five-wish design proposal](docs/MONOLITH_ENDINGS.md), not an implemented ending system.

## Development encounter checks

On the Vite development server, `?encounter=N` previews zero-based sector N. Start the marked test from the menu. Examples: `?encounter=4` (one boss), `?encounter=16` (two bosses), `?encounter=24` (three bosses), `?encounter=22` (four-wave combat). Preview runs unlock weapons for testing and never write campaign saves or award stash progression. Production builds ignore this parameter. Remove the query to return to the normal campaign.
