# Grocery Bot 3D map preview: hills

Copy of [grocery-bot-3d-preview](https://github.com/BusinessManBab/grocery-bot-3d-preview) (kept as is, tag `v1-flat`) with:

- Real terrain: the 3D map is draped over an elevation grid of Kongsberg (`data/terrain.bin`, 307 × 451 samples every ~9 m, 123–352 m, relief ×1.25). Roads, buildings, trees, shops, trucks (pitched on slopes) and trails follow the ground; the board edge shows the hills in section.
- No trees on or next to water.
- Shop window (bottom right): the v1 grocerybot.no store animation (Erik's `arena.js`, ported to `src/shop-iso.js`) showing the robots and trucks inside a shop as the match plays, switched by clicking any shop; order card (left) when you click an order house. The replay is a simulated match with the user's rush-ai, recorded from the engine (`tools/simulate_match.py`).
- Bridges: roads cross water on raised decks with railings and piers; trucks drive over them.
- The river flows: streaks drift downstream along each river (direction from a distance-to-outlet field over the water areas), faster where the river drops.

## Landmarks

Kongsberg's trademarks stand out in 3D (`src/landmarks.js`, data from `tools/landmarks.spec.json` via `tools/bake_landmarks.mjs`):

- **Nybrufossen and Numedalslågen through the town centre**: white water racing down the river from the weir by Nybrua to Myntbrua (faster where the river drops), a churning white lip across the river at each fall, and boulders breaking the surface. One texture offset per frame animates it.
- **Kongsberg kirke** (1761, Norway's largest baroque church): red brick, cross-shaped on its real OpenStreetMap outline, tall arched windows, steep roofs over each arm, and the tower with clock faces, a tiered cap and a spire on the cross arm. The plain building data had left it out (it is mapped as a multipolygon), so the square used to be empty.
- **Norsk Bergverksmuseum** in the old smelting works beside the falls, also missing from the plain data before.

The explore menu (bottom left) flies to each landmark, the Royal Mint and the station. All landmarks together: 6 draw calls, about 1,300 triangles.

## Loading and flicker

The 3D city now uses the Oslo map's loading strategy: buildings baked into `data/buildings.bin` and built in module workers nearest-first, trees baked into `data/trees.bin`, delivery homes merged per material, a lighter tier on phones. All 8,308 buildings are on screen in about 2-3 s on a GTX 1070 (5.3 s before), at 60 fps.

Flicker (windows and details shimmering as the camera moves) came from surfaces in the same plane: walls two neighbours share were built twice, doors sat 7 cm off the wall, equal neighbours' eaves overlapped in one plane, and a fixed near plane left too little depth precision at a distance. Now each shared wall is kept on one side only (`tools/bake_buildings.mjs`), duplicate footprints are dropped, doors stand 25 cm off, each building's roof sits a few centimetres apart from its neighbour's, and the near plane follows the camera's height.

Rebuild after changing data: `node tools/bake_landmarks.mjs`, `node tools/bake_buildings.mjs`, then `PLAYWRIGHT_MODULE=... node tools/bake_trees.cjs` (needs Chromium).

To make this for another town, follow [OTHER-CITIES.md](OTHER-CITIES.md) (data scripts in `tools/build_city.py`).

Switch views with the 2D / 3D buttons (or V, or `?view=3d`).

Elevation: Mapzen Terrarium tiles (AWS Open Data). Map data © OpenStreetMap contributors (ODbL).
