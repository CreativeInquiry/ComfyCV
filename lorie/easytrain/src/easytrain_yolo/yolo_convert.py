from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .easylabeler_io import load_easylabeler
from .media import copy_or_link_image, extract_video_frames, find_image_for_record, find_video, image_size
from .schema import EasyAnnotation, EasyProject
from .utils import clamp, deterministic_split, safe_name, write_json


@dataclass
class ConvertOptions:
    labels_json: Path
    out_dir: Path
    media_root: Path | None = None
    class_field: str = "class"
    include_types: set[str] = field(default_factory=lambda: {"bbox", "point", "shape"})
    point_box_size_px: int = 32
    val_ratio: float = 0.2
    seed: int = 123
    image_ext: str = "jpg"
    copy_mode: str = "copy"
    overwrite: bool = False


def convert_dataset(options: ConvertOptions) -> dict[str, Any]:
    project = load_easylabeler(options.labels_json, class_field=options.class_field)
    dataset_dir = options.out_dir / "dataset"
    if dataset_dir.exists() and options.overwrite:
        shutil.rmtree(dataset_dir)
    for split in ("train", "val"):
        (dataset_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (dataset_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    usable_by_frame = _usable_annotations_by_frame(project, options.include_types)
    frames = sorted(usable_by_frame)
    train_frames, val_frames = deterministic_split(frames, options.val_ratio, options.seed)
    split_for_frame = {frame: "train" for frame in train_frames} | {frame: "val" for frame in val_frames}

    class_names = sorted({ann.class_name for anns in usable_by_frame.values() for ann in anns if ann.class_name})
    class_to_id = {name: index for index, name in enumerate(class_names)}

    warnings = list(project.warnings)
    written_items: list[dict[str, Any]] = []

    if project.is_video:
        temp_extract_dir = options.out_dir / "_extracted_frames"
        video_path = find_video(project, options.media_root)
        extracted = extract_video_frames(video_path, frames, temp_extract_dir, options.image_ext)
        for frame, source_image in extracted.items():
            split = split_for_frame[frame]
            out_image = dataset_dir / "images" / split / source_image.name
            shutil.copy2(source_image, out_image)
            width, height = image_size(out_image)
            label_lines = _label_lines(usable_by_frame[frame], width, height, class_to_id, options, warnings)
            label_path = dataset_dir / "labels" / split / f"{out_image.stem}.txt"
            label_path.write_text("\n".join(label_lines) + ("\n" if label_lines else ""), encoding="utf-8")
            written_items.append(_item_report(frame, split, out_image, label_path, len(label_lines), width, height))
    else:
        records_by_frame = {record.frame: record for record in project.image_records}
        for frame in frames:
            record = records_by_frame.get(frame)
            if record is None:
                warnings.append(f"Frame {frame} has annotations but no image record; skipped")
                continue
            source_image = find_image_for_record(record, options.media_root, project.path)
            split = split_for_frame[frame]
            out_image = dataset_dir / "images" / split / f"{frame:06d}_{safe_name(record.filename, 'image')}{source_image.suffix.lower()}"
            copy_or_link_image(source_image, out_image, options.copy_mode)
            width, height = image_size(out_image)
            label_lines = _label_lines(usable_by_frame[frame], width, height, class_to_id, options, warnings)
            label_path = dataset_dir / "labels" / split / f"{out_image.stem}.txt"
            label_path.write_text("\n".join(label_lines) + ("\n" if label_lines else ""), encoding="utf-8")
            written_items.append(_item_report(frame, split, out_image, label_path, len(label_lines), width, height))

    _write_data_yaml(dataset_dir / "data.yaml", dataset_dir, class_names)

    report = {
        "source_json": str(options.labels_json),
        "media_type": project.media_type,
        "dataset_dir": str(dataset_dir),
        "data_yaml": str(dataset_dir / "data.yaml"),
        "class_field": options.class_field,
        "classes": class_names,
        "class_to_id": class_to_id,
        "included_types": sorted(options.include_types),
        "point_box_size_px": options.point_box_size_px,
        "frames_total": len(frames),
        "train_count": len(train_frames),
        "val_count": len(val_frames),
        "excluded_frames": sorted(project.excluded_frames),
        "items": written_items,
        "warnings": warnings,
    }
    write_json(options.out_dir / "conversion_report.json", report)
    return report


def _usable_annotations_by_frame(project: EasyProject, include_types: set[str]) -> dict[int, list[EasyAnnotation]]:
    by_frame: dict[int, list[EasyAnnotation]] = {}
    for ann in project.annotations:
        if ann.frame in project.excluded_frames:
            continue
        if ann.type not in include_types:
            continue
        if not ann.class_name:
            continue
        by_frame.setdefault(ann.frame, []).append(ann)
    return by_frame


def _label_lines(
    annotations: list[EasyAnnotation],
    width: int,
    height: int,
    class_to_id: dict[str, int],
    options: ConvertOptions,
    warnings: list[str],
) -> list[str]:
    lines = []
    for ann in annotations:
        box = _annotation_box(ann, width, height, options.point_box_size_px, warnings)
        if box is None:
            continue
        x1, y1, x2, y2 = box
        box_w = x2 - x1
        box_h = y2 - y1
        if box_w <= 0 or box_h <= 0:
            warnings.append(f"Skipped zero-area {ann.type} on frame {ann.frame}")
            continue
        x_center = (x1 + x2) / 2 / width
        y_center = (y1 + y2) / 2 / height
        line = f"{class_to_id[ann.class_name]} {x_center:.6f} {y_center:.6f} {box_w / width:.6f} {box_h / height:.6f}"
        lines.append(line)
    return lines


def _annotation_box(ann: EasyAnnotation, width: int, height: int, point_size: int, warnings: list[str]) -> tuple[float, float, float, float] | None:
    raw = ann.raw
    if ann.type == "bbox":
        x1 = float(raw.get("x", 0))
        y1 = float(raw.get("y", 0))
        x2 = x1 + float(raw.get("width", 0))
        y2 = y1 + float(raw.get("height", 0))
    elif ann.type == "point":
        half = point_size / 2
        x = float(raw.get("x", 0))
        y = float(raw.get("y", 0))
        x1, y1, x2, y2 = x - half, y - half, x + half, y + half
    elif ann.type == "shape":
        points = raw.get("points") or []
        if len(points) < 2:
            warnings.append(f"Skipped shape with too few points on frame {ann.frame}")
            return None
        xs = [float(point.get("x", 0)) for point in points if isinstance(point, dict)]
        ys = [float(point.get("y", 0)) for point in points if isinstance(point, dict)]
        if not xs or not ys:
            return None
        x1, y1, x2, y2 = min(xs), min(ys), max(xs), max(ys)
    else:
        return None

    clamped = (
        clamp(min(x1, x2), 0, width),
        clamp(min(y1, y2), 0, height),
        clamp(max(x1, x2), 0, width),
        clamp(max(y1, y2), 0, height),
    )
    if clamped != (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)):
        warnings.append(f"Clamped {ann.type} box on frame {ann.frame} to image bounds")
    return clamped


def _item_report(frame: int, split: str, image: Path, label: Path, label_count: int, width: int, height: int) -> dict[str, Any]:
    return {
        "frame": frame,
        "split": split,
        "image": str(image),
        "label": str(label),
        "label_count": label_count,
        "width": width,
        "height": height,
    }


def _write_data_yaml(path: Path, dataset_dir: Path, class_names: list[str]) -> None:
    lines = [
        f"path: {dataset_dir.resolve()}",
        "train: images/train",
        "val: images/val",
        "names:",
    ]
    lines.extend(f"  {index}: {name}" for index, name in enumerate(class_names))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
