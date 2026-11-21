# Grocery Bot 3D map preview: hills

Copy of [grocery-bot-3d-preview](https://github.com/BusinessManBab/grocery-bot-3d-preview) (kept as is, tag `v1-flat`) with:

- Real terrain: the 3D map is draped over an elevation grid of Kongsberg (`data/terrain.bin`, 307 × 451 samples every ~9 m, 123–352 m, relief ×1.25). Roads, buildings, trees, shops, trucks (pitched on slopes) and trails follow the ground; the board edge shows the hills in section.
- No trees on or next to water.
- Shop window (bottom right): the v1 grocerybot.no store animation (Erik's `arena.js`, ported to `src/shop-iso.js`) showing the robots and trucks inside a shop as the match plays, switched by clicking any shop; order card (left) when you click an order house. The replay is a simulated match with the user's rush-ai, recorded from the engine (`tools/simulate_match.py`).
- Bridges: roads cross water on raised decks with railings and piers; trucks drive over them.
- The river flows: streaks drift downstream along each river (direction from a distance-to-outlet field over the water areas), faster where the river drops.

To make this for another town, follow [OTHER-CITIES.md](OTHER-CITIES.md) (data scripts in `tools/build_city.py`).

Switch views with the 2D / 3D buttons (or V, or `?view=3d`).

Elevation: Mapzen Terrarium tiles (AWS Open Data). Map data © OpenStreetMap contributors (ODbL).
