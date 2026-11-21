# Making the 2D/3D hills map for another town

This repo shows one Grocery Bot game on the Kongsberg map, in 2D (the live game page) and 3D
(real terrain, real buildings, a flowing river). Nothing in the page code is specific to
Kongsberg: everything town-specific lives in `data/`. To do another town, you swap in that town's
data files and publish a copy of the repo.

Tested so far: Kongsberg end to end. Oslo's data files build with these steps (89 of 90
delivery homes matched a real building, terrain 0–102 m), but no Oslo page has been published
yet, because there is no Oslo replay (see step 2).

---

## What goes in `data/`

| File | What it is | Where it comes from |
|---|---|---|
| `game-map.json` | The town's flat map: bounds, roads, water, green areas, delivery homes, labels | The game repo's town pipeline (step 1) |
| `game.json` | One finished game played **on that same map** | The game server's `/api/games/CODE?since=0` (step 2) |
| `buildings.json` | OSM building footprints, with each delivery home matched to its real building | `tools/build_city.py buildings` |
| `terrain.bin` + `terrain.json` | Elevation grid over the map bounds | `tools/build_city.py terrain` |

Everything else (`index.html`, `src/`, `static/`, `assets/`) stays as it is.

You need Python 3.9+ and Pillow (`pip install pillow`) for the terrain step, `git`, and the `gh2`
GitHub login (account BusinessManBab) to publish.

---

## Steps

`T` is the town id, the same id the game repo uses (`oslo`, `bergen`, `trondheim`, …).

### 0. Copy this repo

```sh
git clone https://github.com/BusinessManBab/grocery-bot-3d-hills-preview.git grocery-bot-T-3d
cd grocery-bot-T-3d
git remote remove origin
```

### 1. The town's map: `data/game-map.json`

Each town in `astar-as/grocery-bot` lives in `prototypes/town-rush/public/data/towns/T/`.
Its flat map, `game-map.json`, is built by `tools/build-town-game-map.py`. See
`prototypes/town-rush/NEW_TOWN_GUIDE.md`, step 8. If the town branch already has it, copy it out:

```sh
git -C /path/to/grocery-bot show origin/town/T:prototypes/town-rush/public/data/towns/T/game-map.json > data/game-map.json
```

On 2026-11-21, `town/oslo` had one. The other town branches (bergen, bodo, molde, tromso,
trondheim, grimstad) still had to run `build-town-game-map.py --town T --fetch` first.

A per-town `game-map.json` carries the town's `name` and `labels`. The page uses them
automatically: the name goes under "Grocery Bot Town" at the top left and in the tab title, and the
labels become the place names on the map. Kongsberg's file has neither, so it falls back to
`src/game-map-labels.js`.

### 2. A replay on that map: `data/game.json`

The page plays a stored game. It must be played on **this** town's map, because shop positions and
order addresses come from the game and must line up with the map.

1. Get a finished game in the public feed format. Open `https://<server>/api/games/CODE?since=0`
   after the game has ended and save it as `game.json`. It has `finished: true`, `meta`
   (players, shops, looks) and one frame per tick.
2. Replace the players' real names before publishing (the page is public):

   ```sh
   python3 tools/build_city.py replay --game ~/Downloads/game.json
   # or choose the names, in seat order:
   python3 tools/build_city.py replay --game ~/Downloads/game.json --names "Rush AI,Kale Storm,Oat Runner"
   ```

**Known gap (2026-11-21):** v2.grocerybot.no only runs Kongsberg, and no branch has both the
other towns (`public/data/towns/T/`) and the public feed (`engine/feed.py`, which serves
`/api/games`). The town branches were cut before the feed existed. To get a replay for another
town, either wait until that town runs on the live site, or merge the town folder into a branch
that has the feed (`codex/town-rush-launch-fixes` matches live). Then run a game locally
(`python3 -m gameserver`) and save `http://localhost:<port>/api/games/CODE?since=0`.

### 3. Buildings: `data/buildings.json`

```sh
python3 tools/build_city.py buildings --osm .cache/osm-buildings.json
```

This makes one Overpass query for every `building=*` way in the map bounds. The answer is cached
in the `--osm` file, so later runs work offline and give the same result. The script retries and
falls back to a second Overpass server, because the main one often answers 429/502 when busy.

It prints how many delivery homes matched a real footprint. A home matches a building that
contains its address, or failing that, the nearest building edge within about 25 m. Homes with
no match become a plain 10 × 9 m house. Kongsberg matched 79 of 83 and Oslo 89 of 90. If far
fewer match, the `homes` in `game-map.json` are probably not on buildings (for example, road
points); check them before going on.

Heights come from OSM `height` or `building:levels` when present, else a typical height for
the building type. In the 3D view, buildings near a shop are left out so the shop model is not
buried in the real store.

### 4. Terrain: `data/terrain.bin` + `data/terrain.json`

```sh
python3 tools/build_city.py terrain
```

This downloads Terrarium elevation tiles (AWS Open Data, free, no key; zoom 15, about 5 m per
pixel) into `.cache/tiles/` (git-ignored) and samples a grid every 8 map units (about 9 m) over
the bounds. It prints the height range: Kongsberg is 123–352 m and Oslo 0–102 m.

The tiles have seabed depths under the sea. The script clamps everything below 0 m to 0 m, so the
sea surface stays flat.

### 5. Bump the cache version

GitHub Pages' CDN serves old JavaScript for up to 10 minutes. Raise `?v=N` everywhere it appears:

```sh
grep -rn "v=[0-9]" index.html src/game-view.js     # then raise N in both places
```

### 6. Look at it locally

```sh
python3 -m http.server 8000
# open http://localhost:8000/ and http://localhost:8000/?view=3d
```

Use a computer with a real graphics card (any normal laptop or desktop is fine). On a server
without a GPU, WebGL falls back to software rendering, which is very slow. For headless
screenshots, rent a cheap GPU box (a GTX 1660 on vast.ai is about $0.05/h). Use Chromium flags
`--use-gl=angle --use-angle=gl-egl` and the `mcr.microsoft.com/playwright:v1.49.0-jammy` image.

Things to check (see the next section for what to change):

- [ ] 2D: the map, shops, trucks and orders look like the live game page
- [ ] 3D overview: the board shows the whole map, and the hills read at the default tilt
- [ ] Every shop stands on the ground and is not buried in buildings
- [ ] Order houses turn the claiming player's colour (open orders are cream and brown)
- [ ] No trees in water
- [ ] River streaks run downstream, and the sea or lakes have none
- [ ] Place labels are in the right spots
- [ ] Phone width: the 2D/3D switch does not cover anything important

### 7. Publish

```sh
git add -A
git commit -m "T: 2D/3D hills map"
gh2 repo create BusinessManBab/grocery-bot-T-3d --public --source . --push
gh2 api -X POST repos/BusinessManBab/grocery-bot-T-3d/pages -f 'source[branch]=main' -f 'source[path]=/'
# about a minute later: https://businessmanbab.github.io/grocery-bot-T-3d/
```

---

## Settings you may want to change per town

All of these are constants in `src/view3d.js`; search for the name.

| Name | Now | What it does | When to change it |
|---|---|---|---|
| `RELIEF` | `1.25` | Hills this many times steeper than real life | Flat towns: raise to 1.5–2 so the hills show. Steep fjord towns (Bergen, Tromsø): 1.0 |
| `LIFT` | `1.3` | Buildings this many times taller than real life | Rarely |
| `TILT` | `0.74` | Default camera tilt from straight down (radians, about 42°) | Steep towns can look better a little lower (0.85) |
| `PLAZA` | `100` | Buildings and trees within this many units (about 110 m) of a shop are left out | Raise it if a shop is still buried; lower it in dense centres |
| `SHOP_SCALE`, `TRUCK_SCALE` | `2.4`, `0.9` | How big shops and trucks are compared with the map (they are exaggerated, like in 2D) | Much smaller or larger play areas |
| `STREAKS` | flowing cells ÷ 6, max 1400 | How many current streaks are drawn on rivers | Very wide rivers |
| `cells.length < 120` | | Water areas smaller than this (about 5,000 m²) get no current | Small streams that should move |
| `SEA` | 2 m above sea level | Water lower than this is the sea or a fjord: still, and where rivers end | Rarely |

## How the river direction is worked out

The water areas in `game-map.json` are turned into a grid of 6-unit cells. Each connected
stretch of water gets an outlet:

- the sea, if the stretch touches water at sea level (coastal towns);
- otherwise its lowest cell on the map's edge;
- otherwise its lowest cell.

A distance-from-outlet value spreads back up the water from there. Following it downhill gives a
direction in every cell, including side streams, and smoothing makes it bend with the banks. The
streaks move faster where the ground drops along the current, as at rapids and waterfalls.

This needs the river to be one connected water area. If OSM splits a river at bridges, each piece
flows to its own lowest point, which is normally still downstream. For Kongsberg, every flowing
cell points south (downstream), as Numedalslågen does. Check the direction for each new town: in
the browser console, `groceryView.world3d.flowAt(x, z)` returns `[dx, dz, speed]` at a map point.
`groceryView.toWorld(lon * 1e5, lat * 1e5)` turns a map coordinate into `x, z`. +z is south and
+x is east.

## Sources and credits

- Roads, water, green areas, buildings: © OpenStreetMap contributors, ODbL. Keep the credit line
  on the page.
- Elevation: Mapzen Terrarium tiles on AWS Open Data.
- Delivery homes, shops and the replay: the Grocery Bot game data for that town.
