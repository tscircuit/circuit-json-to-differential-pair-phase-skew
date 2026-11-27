# compute-differential-pair-phase-skew

## What is it?

A library that computes differential pair phase skew from
[Circuit JSON](https://github.com/tscircuit/circuit-json), the way KiCad's
differential pair phase skew tool shows it.

Phase skew is how much farther one trace of a differential pair has run than
its partner at each point along the pair, not only at the ends. Two traces can
have the same total length and still be out of step for most of the route.

The library returns `pcb_differential_pair_phase_skew` Circuit JSON elements.
Viewers can use those elements to draw phase skew overlays.

## How to use it?

```bash
bun add github:tscircuit/compute-differential-pair-phase-skew
```

```ts
import { getDifferentialPairPhaseSkew } from "compute-differential-pair-phase-skew"

const phaseSkews = getDifferentialPairPhaseSkew({ circuitJson })
```

Each element references its source bus and both PCB traces.
Each segment records its copper layer, width, endpoints, and the signed length
difference at each endpoint. The difference varies linearly along the segment
and is this trace's routed length so far minus its partner's. The phase skew is
interpolated from each pad to the nearest coupled run and between coupled
runs. At a pad, the difference is measured across the pair, perpendicular to
the nearest coupled run: a pad level with its partner's pad starts at zero (or
ends at the end-to-end difference), while a pad level with the middle of its
partner's fanout starts behind by the partner's length so far. Segments split
at zero.

For bus length limits, use `checkPcbBusLengthSkew` from `@tscircuit/checks` with
`source_bus.max_length_skew`.

A pair is skipped if its traces never run side by side or a polarity spans
multiple `pcb_trace` records. The library also skips pairs with missing planar
copper, discontinuous routes, invalid layer changes, or dimensions that fail
the `pcb_board` schema. If the board record omits its dimensions, the schema
provides defaults (1.4 mm, 4 layers).

A via counts its height through the board's `pcb_stackup`. Without one, it is
estimated by spacing the board's copper layers evenly through its thickness.

The package ships its TypeScript source (`lib/index.ts`) without a build
step, and `circuit-json` is a peer dependency. Import it from Bun or a
bundler, and type-check it with `"moduleResolution": "bundler"` and an
ES2017 or later `lib`, as in the repo's `tsconfig.json`.
