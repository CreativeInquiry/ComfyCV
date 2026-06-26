from __future__ import annotations

import csv
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from .utils import safe_name


def package_model(
    project_dir: Path,
    run_dir: Path | None = None,
    model_name: str | None = None,
    epochs: int | None = None,
    model: str | None = None,
    imgsz: int | None = None,
    batch: int | None = None,
    device: str | None = None,
) -> Path:
    best = _find_best_pt(project_dir, run_dir)
    exported = project_dir / "exported_model"
    exported.mkdir(parents=True, exist_ok=True)
    if epochs is None:
        epochs = _infer_epochs(_find_results_csv(project_dir, run_dir))
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    export_stem = model_name or _default_export_stem(project_dir, timestamp, epochs)
    out_path = exported / f"{export_stem}.pt"
    shutil.copy2(best, out_path)
    report_path = exported / _report_filename(export_stem)
    report_path.write_text(
        _training_report(
            project_dir=project_dir,
            run_dir=run_dir,
            best_path=best,
            exported_model=out_path,
            report_path=report_path,
            epochs=epochs,
            model=model,
            imgsz=imgsz,
            batch=batch,
            device=device,
            generated_at=timestamp,
        ),
        encoding="utf-8",
    )
    readme = project_dir / "README_FOR_COMFYUI_YOLO.md"
    readme.write_text(_readme_text(out_path.name, report_path.name), encoding="utf-8")
    return out_path


def _find_best_pt(project_dir: Path, run_dir: Path | None) -> Path:
    candidates = []
    if run_dir:
        candidates.append(run_dir / "weights" / "best.pt")
        candidates.append(run_dir / "best.pt")
    candidates.append(project_dir / "training" / "weights" / "best.pt")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not find best.pt. Run training first or pass --run-dir.")


def _default_export_stem(project_dir: Path, timestamp: str, epochs: int | None) -> str:
    base = _project_base_name(project_dir)
    if epochs is None:
        return f"{base}_{timestamp}_yolo_model"
    return f"{base}_{timestamp}_yolo_model_{epochs}e"


def _project_base_name(project_dir: Path) -> str:
    report = _read_conversion_report(project_dir)
    stem = _source_media_stem(report) or _source_json_stem(report) or project_dir.name
    for suffix in ("_annotations", "-annotations", "_labels", "-labels"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    return safe_name(stem, "easytrain")


def _source_media_stem(report: dict[str, Any]) -> str | None:
    source_json = report.get("source_json")
    if not source_json:
        return None
    path = Path(str(source_json))
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        return None
    source_filename = metadata.get("source_filename")
    if not source_filename:
        return None
    return Path(str(source_filename)).stem


def _source_json_stem(report: dict[str, Any]) -> str | None:
    source_json = report.get("source_json")
    if not source_json:
        return None
    return Path(str(source_json)).stem


def _report_filename(export_stem: str) -> str:
    suffix = "_yolo_model"
    if suffix in export_stem:
        report_stem = export_stem.split(suffix, 1)[0]
        return f"{report_stem}_yolo_training_report.txt"
    return f"{export_stem}_training_report.txt"


def _training_report(
    project_dir: Path,
    run_dir: Path | None,
    best_path: Path,
    exported_model: Path,
    report_path: Path,
    epochs: int | None,
    model: str | None,
    imgsz: int | None,
    batch: int | None,
    device: str | None,
    generated_at: str,
) -> str:
    conversion = _read_conversion_report(project_dir)
    results_csv = _find_results_csv(project_dir, run_dir)
    train_args = _read_train_args(project_dir, run_dir)
    best_metrics, final_metrics = _read_training_metrics(results_csv)
    model = model or _string_or_none(train_args.get("model"))
    epochs = epochs or _int_or_none(train_args.get("epochs"))
    imgsz = imgsz or _int_or_none(train_args.get("imgsz"))
    batch = batch or _int_or_none(train_args.get("batch"))
    device = _string_or_none(train_args.get("device")) or device

    lines = [
        "Easytrain YOLO Training Report",
        "=" * 31,
        "",
        f"Generated: {_format_timestamp(generated_at)}",
        f"Project folder: {project_dir}",
        f"Exported model: {exported_model}",
        f"Training report: {report_path}",
        f"Ultralytics best weights: {best_path}",
        "",
        "Source data",
        "-----------",
        f"EasyLabeler JSON: {conversion.get('source_json', 'unknown')}",
        f"Media type: {conversion.get('media_type', 'unknown')}",
        f"Classes: {', '.join(conversion.get('classes') or []) or 'unknown'}",
        f"Labeled frames/images: {conversion.get('frames_total', 'unknown')}",
        f"Train items: {conversion.get('train_count', 'unknown')}",
        f"Validation items: {conversion.get('val_count', 'unknown')}",
        f"Point box size px: {conversion.get('point_box_size_px', 'unknown')}",
        "",
        "Training settings",
        "-----------------",
        f"Base model: {model or 'unknown'}",
        f"Epochs requested: {epochs if epochs is not None else 'unknown'}",
        f"Image size: {imgsz if imgsz is not None else 'unknown'}",
        f"Batch size: {batch if batch is not None else 'unknown'}",
        f"Device requested: {device or 'unknown'}",
        f"Results CSV: {results_csv or 'not found'}",
        "",
        "Best validation metrics",
        "-----------------------",
    ]
    lines.extend(_metric_lines(best_metrics))
    lines.extend(["", "Final epoch metrics", "-------------------"])
    lines.extend(_metric_lines(final_metrics))

    warnings = conversion.get("warnings") or []
    if warnings:
        lines.extend(["", "Conversion warnings", "-------------------"])
        lines.extend(f"- {warning}" for warning in warnings)

    lines.extend(
        [
            "",
            "Notes",
            "-----",
            "The exported model is a copy of Ultralytics weights/best.pt, renamed for this project.",
            "Point annotations were trained as small synthetic boxes, not as true keypoints.",
            "Validation metrics can look overly optimistic when train/validation frames come from the same short video.",
            "",
        ]
    )
    return "\n".join(lines)


def _read_conversion_report(project_dir: Path) -> dict[str, Any]:
    path = project_dir / "conversion_report.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def _find_results_csv(project_dir: Path, run_dir: Path | None) -> Path | None:
    candidates = []
    if run_dir:
        candidates.append(run_dir / "results.csv")
    candidates.append(project_dir / "training" / "results.csv")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _read_train_args(project_dir: Path, run_dir: Path | None) -> dict[str, Any]:
    path = _find_args_yaml(project_dir, run_dir)
    if path is None:
        return {}
    try:
        import yaml
    except ImportError:
        return {}
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data if isinstance(data, dict) else {}


def _find_args_yaml(project_dir: Path, run_dir: Path | None) -> Path | None:
    candidates = []
    if run_dir:
        candidates.append(run_dir / "args.yaml")
    candidates.append(project_dir / "training" / "args.yaml")
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _read_training_metrics(results_csv: Path | None) -> tuple[dict[str, str], dict[str, str]]:
    if results_csv is None:
        return {}, {}
    with results_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = [
            {key.strip(): value.strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    if not rows:
        return {}, {}
    final = rows[-1]
    best = max(rows, key=lambda row: _float(row.get("metrics/mAP50-95(B)")))
    return best, final


def _infer_epochs(results_csv: Path | None) -> int | None:
    _, final = _read_training_metrics(results_csv)
    try:
        return int(float(final.get("epoch", "")))
    except (TypeError, ValueError):
        return None


def _metric_lines(metrics: dict[str, str]) -> list[str]:
    if not metrics:
        return ["No training metrics were found."]
    return [
        f"Epoch: {metrics.get('epoch', 'unknown')}",
        f"Training time at epoch: {_seconds(metrics.get('time'))}",
        f"Precision: {_value(metrics.get('metrics/precision(B)'))}",
        f"Recall: {_value(metrics.get('metrics/recall(B)'))}",
        f"mAP50: {_value(metrics.get('metrics/mAP50(B)'))}",
        f"mAP50-95: {_value(metrics.get('metrics/mAP50-95(B)'))}",
        f"Train box loss: {_value(metrics.get('train/box_loss'))}",
        f"Train class loss: {_value(metrics.get('train/cls_loss'))}",
        f"Train DFL loss: {_value(metrics.get('train/dfl_loss'))}",
        f"Validation box loss: {_value(metrics.get('val/box_loss'))}",
        f"Validation class loss: {_value(metrics.get('val/cls_loss'))}",
        f"Validation DFL loss: {_value(metrics.get('val/dfl_loss'))}",
    ]


def _float(value: str | None) -> float:
    try:
        return float(value or "-inf")
    except ValueError:
        return float("-inf")


def _value(value: str | None) -> str:
    if value is None or value == "":
        return "unknown"
    try:
        return f"{float(value):.4g}"
    except ValueError:
        return value


def _seconds(value: str | None) -> str:
    if value is None or value == "":
        return "unknown"
    try:
        seconds = float(value)
    except ValueError:
        return value
    return f"{seconds:.1f} seconds"


def _string_or_none(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _format_timestamp(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%Y%m%d%H%M")
    except ValueError:
        return value
    return parsed.strftime("%Y-%m-%d %H:%M")


def _readme_text(filename: str, report_filename: str) -> str:
    return f"""# Easytrain YOLO Export

This folder contains a trained YOLO detection model exported from EasyLabeler annotations.

Model file:

```text
{filename}
```

Training report:

```text
{report_filename}
```

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
