# RunComfy YOLO Workflows

This directory contains ComfyUI workflows for YOLO-based object detection, organized by use case. All workflows are intended to be run on [RunComfy](https://www.runcomfy.com/).

## Importing Workflows into RunComfy

1. Log in to RunComfy and start a machine.
2. In the ComfyUI interface, drag and drop the `.json` file onto the canvas.
3. Select the workflow `.json` file from the appropriate folder below.
4. Connect your input media and run the workflow.

> Use the `_api.json` variant if you are calling the workflow programmatically via the ComfyUI API. Use the plain `.json` for interactive use in the UI.

---

## Workflows

### `image/` — Single Image YOLO Detection

Runs YOLO object detection on a single image and labels all detected objects.

- **Workflow:** `yolo_label_all_image.json` (UI) / `yolo_label_all_image_api.json` (API)
- **Recommended machine size:** Medium or larger should be sufficient for single images.

---

### `batched_video/` — Batched Video YOLO Detection

Runs YOLO object detection across frames of a video in batches.

- **Workflow:** `yolo_batched_video.json` (UI) / `yolo_batched_video_api.json` (API)
- **Recommended machine size:** **Large or Extra-Large** — video frame batches are memory-intensive and smaller machines are likely to run out of memory.

---

### `yolo+cotracker/` — YOLO + CoTracker Point Tracking

Combines YOLO detection with CoTracker to track detected points across video frames.

- **Workflow:** `yolo_cotracker.json` (UI) / `yolo_cotracker_api.json` (API)
- **Recommended machine size:** **Large or Extra-Large** — same memory considerations as batched video apply here.

**Known limitation:** This workflow tracks all YOLO-detected points, but temporally consistent bounding boxes, labels, and points across frames are not currently supported. This is because the mask data types used by the YOLO and CoTracker node libraries are incompatible, making it impossible to propagate per-object identity over time.
