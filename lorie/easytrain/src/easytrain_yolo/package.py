from __future__ import annotations

import shutil
from pathlib import Path


def package_model(project_dir: Path, run_dir: Path | None = None, model_name: str = "easytrain_model") -> Path:
    best = _find_best_pt(project_dir, run_dir)
    exported = project_dir / "exported_model"
    exported.mkdir(parents=True, exist_ok=True)
    out_path = exported / f"{model_name}.pt"
    shutil.copy2(best, out_path)
    readme = project_dir / "README_FOR_COMFYUI_YOLO.md"
    readme.write_text(_readme_text(out_path.name), encoding="utf-8")
    return out_path


def _find_best_pt(project_dir: Path, run_dir: Path | None) -> Path:
    candidates = []
    if run_dir:
        candidates.append(run_dir / "weights" / "best.pt")
        candidates.append(run_dir / "best.pt")
    candidates.extend((project_dir / "runs").rglob("best.pt"))
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not find best.pt. Run training first or pass --run-dir.")


def _readme_text(filename: str) -> str:
    return f"""# Easytrain YOLO Export

This folder contains a trained YOLO detection model exported from EasyLabeler annotations.

## Use In ComfyUI-YOLO

1. Copy `{filename}` into your ComfyUI Ultralytics model folder, commonly:

   ```text
   ComfyUI/models/ultralytics/
   ```

2. Restart ComfyUI.
3. Use your ComfyUI-YOLO custom model loader and select `{filename}`.
4. Run detection on image or video frames.

Point annotations from EasyLabeler were trained as small synthetic boxes, not as true keypoints.
"""
