# The Lonely Road

A small browser driving game built with **Three.js** and **Vite**. It looks like a relaxing,
almost boring drive through a desert at dusk. It isn't. Inspired by *Desert Bus*.

- **Level 1:** a long, wide, straight road. The car drifts a little to the right. That's the whole challenge.
- **Level 2:** same road, no warning. Downhill S-curves, a narrow "waterfall" of ledges over a canyon that
  launch the car again and again, then tighter S-curves to the finish.

The car accelerates on its own. There is no brake and no reverse: you only steer. Leave the road, fall
off it, or flip the car and you restart the current level from the start, with a taunt that gets meaner
the more attempts you need.

Everything is generated in code: low-poly models from primitives, a shader sky, a canvas-drawn road
texture, and WebAudio-synthesized sound. There are no asset files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve the production build
npm run simulate   # headless check: an autopilot must finish both levels
```

Requires Node 18+.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Steer | `A` / `D` or `←` / `→` | on-screen ◀ ▶ buttons |
| Try again / start | `Enter` / `Space` | button |
| Mute | `M` | speaker button |

## Deploy

It's a static site, with `base: './'` so it works from any path.

- **Netlify:** `netlify.toml` is included (build `npm run build`, publish `dist`).
- **Vercel:** import the repo; Vite is auto-detected (output `dist`).

## Project structure

```
src/
  config.js            every tunable number (speed, road widths, curve sharpness, drop height, physics, camera)
  levels.js            levels as data: lists of straight / slope / curve / drop segments
  palette.js           shared color palette
  road/roadPath.js     segments → centre-line samples + road queries (pure JS)
  road/roadMesh.js     road surface, side walls, finish arch
  road/levelBuilder.js builds a level: road + terrain + scenery
  physics/vehicle.js   arcade car controller with gravity, jumps and fail detection (pure JS)
  physics/fixedStep.js fixed-timestep accumulator
  physics/autopilot.js test driver (used by `npm run simulate` and `?autopilot`)
  car/carModel.js      primitive low-poly car (swap for a GLB here)
  car/car.js           links physics to visuals, with interpolation
  camera/chaseCamera.js chase cam with trauma-based shake
  world/               terrain height field, scenery (instanced), sky shader, noise
  fx/dust.js           pooled dust particles
  audio/audio.js       WebAudio synth: engine, wind, crash, landings, jingles
  taunts.js            crash and finish messages by tier
  ui/                  DOM HUD and screens, keyboard and touch input
  storage.js           best time and fewest attempts in localStorage
```

### Tuning

Change values in `src/config.js` (e.g. `level2.curveSharpness`, `level2.dropHeight`,
`level2.waterfallWidth`, `level2.speed`), then run `npm run simulate` to confirm both levels can still
be finished. To change the course itself, edit the segment lists in `src/levels.js`.

### Swapping the car for a GLB

`src/car/carModel.js` documents what a car model must return: a root object, wheel objects and steer
pivots. Load a GLB with `GLTFLoader`, return the same shape, and pass that factory to `new Car(...)`
in `src/main.js`.

### Physics

The car uses a custom arcade controller, not a physics engine. The road works as a height function, so
the car can't snag on collision meshes or jitter, and jumps come from plain ballistic motion when the
ground drops away faster than gravity. It steps at a fixed 120 Hz and rendering interpolates between
steps.

### Dev URL parameters

`?autopilot` drives by itself · `?level=2` starts on Level 2 · `?at=600` starts 600 m along the road.
