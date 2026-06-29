# Is SEGS the right data type for our tracking pipeline?

*Notes on whether the Impact Pack's SEGS type fits the EasyLabel → EasyTrain → EasyDetect → EasyTrack pipeline.*

## TL;DR / Recommendation

**Mostly no.** SEGS is a solid format for one narrow job (per-frame detection results inside a single render), but our pipeline is fundamentally about *the same object persisting across frames*, and that is exactly the dimension SEGS does not have. It carries no object identity and no time axis.

We should define our own connective data type (a per-object track table) and only emit SEGS at the detection boundary *if* we want compatibility with existing Impact Pack nodes. That is an interop convenience (not a reason to build the pipeline around it!!).

## What SEGS is

SEGS is the Impact Pack's core data type for passing around detected regions of an image. It is the bridge between a detector (which finds things: faces, hands, objects, masked areas) and a processor (which does something to each found thing, like a targeted detail pass).

## What SEGS gives you

Every detection, whether it came from a YOLO/Ultralytics bbox detector or a SAM mask, gets flattened into the same `SEG` namedtuple. The useful fields:

| Field | What it is |
|---|---|
| `bbox` | `(x1, y1, x2, y2)`, absolute integer pixel coords on the full image (xyxy). This is the bounding box. |
| `crop_region` | Same xyxy format but padded by the crop factor. A detailing artifact, ignore it for tracking. |
| `cropped_mask` | The per-object mask, local to the crop region (not full-frame). Edges/polygons come from running contour extraction on it. |
| `confidence` | The detector score. Note: the mask-to-SEGS path hardcodes this to `1.0`, so don't trust it if the SEGS came through a mask conversion. |
| `label` | The class string. |

Cool thing: a single parsing routine works across every detector. One small custom node takes SEGS, unpacks `shape, seg_list = segs`, loops `seg.bbox`, and you get uniform output regardless of the upstream model.

## The pipeline, stage by stage

The reason why I think segs is a "no" for us is different at each stage...

### EasyLabel >> wrong tool entirely

SEGS is a runtime detection-result type: an in-memory object meant to flow between nodes during one graph execution, carrying cropped pixels and a detailing-oriented mask. Labels need the opposite: a persistent annotation format keyed to file paths, with class names and stable IDs, that survives between sessions (COCO JSON, YOLO txt, polygons/points). SEGS has no file references and nothing persistent. Using it here means storing annotations in a format designed to be thrown away after one render. We should define our own annotation schema.

### EasyTrain >> irrelevant

Training consumes a dataset (images plus annotations in a standard format). SEGS is not a dataset format and never touches this stage.

Worth flagging separately: if EasyDetect is SAM3, "train a model that learns what we're detecting" may not mean training weights at all. SAM3 is open-vocabulary via text *and image-exemplar* prompts, so our EasyLabel outputs could become exemplar/concept prompts rather than a fine-tuned checkpoint. That would turn EasyTrain from "train a model" into "build a concept prompt from the labels." Either way, SEGS isn't involved.

### EasyDetect >> the only place SEGS could appear

SAM3 already returns per-instance masks *with persistent IDs across frames*. SEGS has no slot for an ID, so normalizing SAM3 output into SEGS throws away the exact thing we're building the pipeline to capture. The bbox and mask survive; the identity does not.

### EasyTrack >> format mismatch in the other direction

CoTracker, TAPIR, and TAPNet are *point* trackers (TAP = Tracking Any Point). Their input is query points `(x, y, t)`; their output is per-point trajectories plus visibility/occlusion flags. SEGS is neither their input nor their output. The most SEGS could do is be the thing we sample query points from (the centroid of `seg.bbox`, or a point grid inside `seg.cropped_mask`; CoTracker can seed a grid directly from a segmentation mask). But that's a one-line conversion we'd run off a raw mask just as easily. 

## The core mismatch

Our pipeline has two notions of object identity, and SEGS speaks neither:

1. **SAM3's instance IDs**" detection-level tracking via its memory bank.
2. **Point trajectories**: point-level tracking from the TAP models.

SEGS is a per-frame, identity-free box+mask container built for one specific job: the Impact Pack's "crop each detection, re-sample it at higher detail, paste it back" loop. That job has no time axis and no need for IDs, which is why the structure doesn't have them. We're building a tracker, and tracking is the dimension SEGS structurally lacks.

## The one real reason to keep it

Interop. If we want our `Easy*` nodes to drop into existing Impact Pack graphs (feeding a `SEGSDetailer`, reusing their filter and preview nodes), then emitting SEGS at the EasyDetect boundary buys us that ecosystem for free. That's a legitimate call, but it's a compatibility decision, not a data-modeling one. We'd still carry the real identity and track data in a side channel, because SEGS can't hold it.

## What our connective type should be instead

Since this is our own node suite, the type flowing between stages should be keyed on the two axes SEGS drops: object identity and time. Roughly a track table:

```
Track = {
  object_id,
  label,
  frames: {
    t: { bbox, mask_or_contour, points[], visible }
  }
}
```

EasyDetect populates `object_id / bbox / mask` per frame, straight from SAM3's IDs. EasyTrack fills `points / visible` from the TAP trajectories, anchored to the same `object_id`. This makes "the same labelled object across frames" a main thing, roughly the inverse of how SEGS is shaped.

## Bottom line

SEGS is built for single-frame detail work, not multi-frame tracking. We adopt our own track-table type as the backbone of the pipeline, and treat SEGS purely as an optional output adapter at the detection stage for Impact Pack compatibility.

## References
 
**SEGS / Impact Pack**
- ComfyUI Impact Pack (where SEGS is defined): https://github.com/ltdrdata/ComfyUI-Impact-Pack
- ComfyUI Impact Subpack (`UltralyticsDetectorProvider`, the YOLO detectors): https://github.com/ltdrdata/ComfyUI-Impact-Subpack
**EasyDetect / SAM3** (already returns per-instance masks with IDs tracked across frames)
- Meta announcement: https://ai.meta.com/blog/segment-anything-model-3/
- Paper: https://arxiv.org/abs/2511.16719
- Code: https://github.com/facebookresearch/sam3
- Ultralytics integration (predict + track mode): https://docs.ultralytics.com/models/sam-3/
**EasyTrack / point trackers** (these track points, not boxes or masks)
- CoTracker (Meta): https://github.com/facebookresearch/co-tracker — project page: https://co-tracker.github.io/
- TAPIR / TAPNet / TAP-Vid (DeepMind, single repo): https://github.com/google-deepmind/tapnet
- TAPIR project page: https://deepmind-tapir.github.io/
**EasyLabel / annotation formats** (use a persistent format, not SEGS)
- COCO data format: https://cocodataset.org/#format-data
- YOLO dataset format: https://docs.ultralytics.com/datasets/detect/
 