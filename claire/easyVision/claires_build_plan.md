# build roadmap!

**ipeline order:** The pipeline runs EasyLabel → EasyTrain → EasyDetect → EasyTrack.

I will *build* the back half first. SAM3 works zero-shot from a text prompt ("bee"), so EasyDetect and EasyTrack run today with no labeling or training at all. EasyLabel and EasyTrain exist to *customize or replace* the detector later. 

I'll also **build the visualizer early.** You can't tell if detection is working without seeing boxes and IDs drawn on frames. 

Here's the outline.

## Phase 0 — Foundation (the plumbing everything hangs on)

- **Package skeleton**: `ComfyUI-EasyTrack/` in `custom_nodes/`, with `__init__.py` exporting `NODE_CLASS_MAPPINGS`, plus `requirements.txt` / `pyproject.toml`. This is what makes ComfyUI see your nodes.
- **The `TRACKS` backbone type** (already started in `tracks.py`): the per-object, per-frame payload that flows between stages. Register the string `"TRACKS"`; pass the `Tracks` object through.
- **A trivial "Tracks Info" node**: takes `TRACKS`, prints the repr (frame count, object count). Sounds dumb, but it's how you confirm the custom type routes through the graph before building anything heavy.

*Testable at end: a graph with two nodes wired by a `TRACKS` link that runs without error.*

## Phase 1 — EasyDetect (your first real slice)

- **SAM3 loader node**: loads `SAM3VideoSemanticPredictor` once, outputs a `DETECTOR` handle. Separate from detect so the 3.45 GB model loads once and ComfyUI caches it.
- **EasyDetect node**: `IMAGE` batch + `DETECTOR` + text concept + conf → `TRACKS`. Includes the `IMAGE`-tensor-to-frames conversion and the identity step (SAM3 video gives IDs; wall it behind a `linker` interface so YOLO can slot in later).
- **Tracks Preview node**: `TRACKS` + `IMAGE` → `IMAGE` with boxes, masks, and IDs drawn on. Your eyes for the whole project.
- **Tracks Save / Load nodes**: serialize `TRACKS` to disk (JSON + RLE). Critical because SAM3 is slow; you do not want to re-detect every time you iterate on EasyTrack.

*Testable at end: load frames → detect "bee" → see tracked, ID'd bees drawn on the video. That's a working product on its own.*

## Phase 2 — EasyTrack (dense point motion)

- **Point-tracker loader node**: loads CoTracker (or TAPIR) → `POINT_TRACKER` handle.
- **Query-point sampler node**: `TRACKS` → seed points per object per frame (grid inside each mask, or contour points). This is the SAM3-mask-to-tracker bridge.
- **EasyTrack node**: `TRACKS` + `IMAGE` + `POINT_TRACKER` → `TRACKS` with `points` / `point_visible` filled in, anchored to the same `object_id`.
- **Extend Tracks Preview** to draw trajectories.

*Testable at end: each tracked bee now has dense point trails showing how it moves and deforms.*

## Phase 3 — EasyLabel (the hard one)

- **Interactive annotation node**: this needs a custom **JS frontend widget** (via `WEB_DIRECTORY`) to draw boxes/masks on images in the ComfyUI canvas. Real front-end effort, unlike the rest.
- **SAM-assisted labeling**: click a point, let SAM3 propose the mask, so you're correcting not drawing from scratch.
- **Annotation export**: write to a persistent format on disk (COCO JSON or YOLO txt), output an `ANNOTATIONS` / dataset path. Not `TRACKS` — labels are persistent ground truth, a different type.

*Testable at end: label a batch, get a COCO/YOLO dataset on disk.*

## Phase 4 — EasyTrain (depends on a fork)

- **If staying with SAM3**: "train" is really "build a concept/exemplar prompt" from your labels. Lightweight, lives fine in the graph.
- **If fine-tuning YOLO**: dataset prep node + a training trigger. Training a model probably should *not* run inside graph execution — better to launch a subprocess/background job and output the resulting checkpoint path.
- **Output**: a `DETECTOR` handle (or checkpoint path) that plugs straight into EasyDetect, closing the loop.

## Cross-cutting (build as needed)

- **Export node**: `TRACKS` → MOT / COCO-video / CSV for analysis outside ComfyUI.
- **Type versioning**: a `version` field on `Tracks` so old saved files stay loadable as the schema grows.

The dependency picture: Phase 0 → 1 → 2 is the critical path. Phase 3 and 4 hang off the side and feed back into EasyDetect's `DETECTOR` input, but nothing downstream needs them to exist first.

