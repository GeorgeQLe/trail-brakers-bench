# Trail Brakers Bench

One creative-coding brief — *"a voxel-style F1 car lapping a real Grand Prix circuit in Three.js, with play / pause / restart and orbit controls"* — given to multiple frontier models. This repo hosts the comparison landing page and the models' built demos, deployed as static output.

## Entries

| Model | Circuit(s) | Demos |
|-------|-----------|-------|
| **Grok 4.5** | Silverstone | One-shot voxel, iterated Voxel Trail Brakers, Trail Brakers 3D (ribbon mesh + follow cam) |
| **GPT-5.6** | Spa-Francorchamps, Silverstone | Voxel Grand Prix dioramas with elevation-aware centrelines |
| **Claude Fable 5** | Silverstone | Voxel Grand Prix diorama on the real GPS centreline — curvature-derived speed profile (~1:27 ideal lap), start-lights sequence, orbit/chase/TV cameras, broadcast HUD |

## Structure

```
index.html            # bench landing page
demos/
  grok-4.5/           # Grok 4.5 built output (oneshot/, voxel/, 3d/ + its own showcase page)
  gpt-5.6/
    spa/              # GPT-5.6 Spa-Francorchamps build
    silverstone/      # GPT-5.6 Silverstone build
  fable5/
    silverstone/      # Claude Fable 5 Silverstone build (index.html + main.js, vendored three.js)
```

The model working directories (`grok-4.5/`, `gpt5.6sol/`) are separate git repos and are intentionally not tracked here — `demos/` contains their assembled production builds.

## Local preview

Any static server works:

```bash
npx serve .
```

## Deploy

Deployed to Vercel as a plain static site — no build step.
