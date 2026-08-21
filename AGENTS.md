# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

Preserve every existing Pen screen and prototype version. New design waves must be added as clearly named copies or new top-level frames; never overwrite the earlier visual references.

Prioritize complete desktop 1440×900 and tablet 1024×768 experiences. Mobile is a later phase and must not replace or reduce the desktop/tablet scope.

Keep the established Jet d’Encre balance: navy, gold and ivory carry the premium editorial brand; teal, saffron and terracotta remain functional or pedagogical accents. Continue using Inter for operational UI and Outfit for friendly display headings.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
