# Monolith finale — five wishes

Design proposal, not implemented. These are original endings for this game, not claims about S.T.A.L.K.E.R. canon.

## Encounter

The transmitter was a relay. After defeating its guardian, the final airlock leads to a silent chamber containing a black stone suspended over a flooded floor. The detector stops clicking. Five fractures in the stone answer five wishes.

The player approaches with E. Combat and emissions stop. Five wish cards surround the stone; each previews a different room transformation and clearly explains its effect on the Zone. The first completion offers all five wishes. Choices express values, rather than requiring a secretly correct answer.

Keep narrative ambiguity in the epilogue while displaying mechanical consequences honestly. An archive records discovered endings. In a later iteration, players may explicitly select an unlocked Zone condition for their next expedition; do not silently replace their normal run or erase upgrades.

| Wish | Consequence for the Zone | Suggested future run modifier | Ending animation |
| --- | --- | --- | --- |
| **«Нехай Зона замовкне» — Silence** | Emissions cease. The Zone loses its voice, including the voices trapped inside artifacts. | No emissions; anomaly fields and artifact opportunities become rarer. | Expanding white rings extinguish every anomaly; waveform and Geiger pulse flatten; the stone turns to ash. A single ordinary bird breaks the silence. |
| **«Нехай Зона буде вільною» — Freedom** | Seals and control systems fail. Nobody can own the Zone; nobody can contain it. | Combat doors remain open, but patrols can follow across connected rooms. Rewards still require clearing encounters. | Five chains of light snap; successive doors burst open; cracks race beyond the camera; the camera rises toward an expanding silhouette of the Zone. |
| **«Нехай Зона зцілиться» — Renewal** | Poisoned earth becomes a living ecosystem. Its new inhabitants defend it fiercely. | Less ambient radiation and occasional healing growths; stronger organic mutants. | Green light travels through floor cracks; pixel vines climb the walls; water clears; a sapling grows inside the split stone. Its shadow briefly resembles a mutant. |
| **«Покажи мені правду про Зону» — Truth** | The Zone exposes its hidden connections, but the witness can no longer distinguish every echo from reality. | Full room map and anomaly timing visible; clearly telegraphed psychic echoes complicate combat. | Walls dissolve into wireframes; constellations connect rooms, enemies and artifacts; the camera pulls through layered maps before returning to the player's changed eyes. |
| **«Нехай Зона слухається мене» — Dominion** | The player becomes the Zone's new anchor. Protection becomes possession. | Start with one psychic companion; emissions become more frequent. The next explorer encounters the previous character's echo. | Bullets and debris stop in midair, then orbit the player; enemies kneel as silhouettes; violet threads lift the character into the stone; a new heartbeat replaces the Geiger counter. |

## Cinematic structure

Each ending lasts roughly 10 seconds and uses its own silhouette, motion and sound identity, rather than a recolored flash.

1. **0–1.5 s: commitment.** The five fractures close into the chosen glyph. The player lowers their weapon. HUD fades.
2. **1.5–6 s: transformation.** Room geometry and particles enact the wish. Camera moves slowly; avoid strobing or repeated full-screen flashes.
3. **6–9 s: consequence.** Reveal the personal cost through one unmistakable image, with a two-line Ukrainian epilogue.
4. **9–10 s: record.** Fade into the ending title, run results and archive entry. Show the unlocked Zone condition as a future option.

Allow Escape to skip after the first two seconds and offer reduced motion. Both natural completion and skip must call the same idempotent completion path, award the run only once, and record exactly one ending. Pausing or losing focus must not leave the cinematic timer running independently from its animation.

## Implementation shape

- `endingDefinitions.ts`: five typed wish records: title, epilogue, palette, animation identity, optional future modifier.
- `MonolithScene`: stone chamber, five accessible HTML choices, previews and deliberate selection.
- `EndingScene`: shared timeline with five separate transformation renderers and a skip path.
- Save migration: preserve current credits/level/best/runs; add discovered ending IDs and selected optional Zone condition. Reject unknown IDs.
- First milestone: chamber, choices, five cinematics and archive. Keep future-run modifiers separate until their generation and balance changes are implemented.

## Verification before shipping

Play each choice from the real boss exit. Check all five cinematics, skip at different times, pause/blur/resume, reload, and repeated completion callbacks. Confirm one reward, one archive record, no active combat projectiles, and unchanged progression on save migration. Test the final choice layout at short desktop heights and with keyboard focus.
