# Grocery Bot 3D map preview

Preview of a 3D mode for the Grocery Bot v2 game map (`/game/CODE`), next to the live 2D map. Switch with the 2D / 3D buttons (or the V key, or `?view=3d`).

- 2D view: the live page's code (`prototypes/town-rush/game-view.js` on `codex/town-rush-launch-fixes`), reading a stored replay instead of the API.
- 3D view: `src/view3d.js` (three.js). Same map bounds, colours, shops, trucks and orders. Order homes are the real OpenStreetMap building at each address, coloured by who claimed the order.
- Replay: a finished 5-player ranked game; player names are replaced with bot names.

Map data © OpenStreetMap contributors (ODbL).
