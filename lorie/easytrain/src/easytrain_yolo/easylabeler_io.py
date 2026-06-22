from __future__ import annotations

from pathlib import Path
from typing import Any

from .schema import EasyAnnotation, EasyProject, ImageRecord
from .utils import read_json, summarize_counts


def load_easylabeler(path: Path, class_field: str = "class") -> EasyProject:
    payload = read_json(path)
    metadata = payload.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    excluded_frames = _read_excluded_frames(payload)
    annotations: list[EasyAnnotation] = []
    image_records: list[ImageRecord] = []
    warnings: list[str] = []

    if isinstance(payload.get("images"), list):
        for index, image in enumerate(payload["images"]):
            if not isinstance(image, dict):
                continue
            frame = int(image.get("frame", index))
            record_annotations = [
                _annotation_from_raw(ann, frame, class_field, image.get("filename"))
                for ann in image.get("annotations", [])
                if isinstance(ann, dict)
            ]
            record = ImageRecord(
                frame=frame,
                filename=str(image.get("filename") or f"frame_{frame:06d}.jpg"),
                path=str(image.get("path")) if image.get("path") else None,
                width=_optional_int(image.get("width")),
                height=_optional_int(image.get("height")),
                annotations=record_annotations,
            )
            image_records.append(record)
            annotations.extend(record_annotations)

    if isinstance(payload.get("annotations"), list):
        for ann in payload["annotations"]:
            if not isinstance(ann, dict):
                continue
            annotations.append(_annotation_from_raw(ann, int(ann.get("frame", 0)), class_field, ann.get("filename")))

    media_type = str(metadata.get("media_type") or ("images" if image_records else "video")).lower()
    if media_type not in {"video", "images"}:
        warnings.append(f"Unknown media_type {media_type!r}; treating as video")
        media_type = "video"

    for ann in annotations:
        if not ann.class_name:
            warnings.append(f"Annotation on frame {ann.frame} has empty class; it will be ignored during conversion")

    return EasyProject(
        path=path,
        metadata=metadata,
        media_type=media_type,
        annotations=annotations,
        image_records=image_records,
        excluded_frames=excluded_frames,
        warnings=warnings,
    )


def inspect_project(project: EasyProject) -> dict[str, Any]:
    usable = [ann for ann in project.annotations if ann.frame not in project.excluded_frames]
    return {
        "path": str(project.path),
        "media_type": project.media_type,
        "source_filename": project.metadata.get("source_filename"),
        "source_video_path": project.metadata.get("source_video_path"),
        "media_width": project.metadata.get("media_width") or project.metadata.get("video_width"),
        "media_height": project.metadata.get("media_height") or project.metadata.get("video_height"),
        "annotation_count": len(project.annotations),
        "usable_annotation_count": len(usable),
        "annotations_by_type": summarize_counts(ann.type for ann in project.annotations),
        "classes": sorted({ann.class_name for ann in usable if ann.class_name}),
        "class_counts": summarize_counts(ann.class_name for ann in usable if ann.class_name),
        "labeled_frames": sorted({ann.frame for ann in usable}),
        "labeled_frame_count": len({ann.frame for ann in usable}),
        "excluded_frames": sorted(project.excluded_frames),
        "warnings": project.warnings,
    }


def _annotation_from_raw(raw: dict[str, Any], default_frame: int, class_field: str, image_filename: Any = None) -> EasyAnnotation:
    ann_type = str(raw.get("type") or "point").lower()
    if ann_type in {"box", "bounding_box", "boundingbox"}:
        ann_type = "bbox"
    if ann_type in {"polygon", "polyline"}:
        ann_type = "shape"
    class_name = _class_name(raw, class_field)
    return EasyAnnotation(
        raw=raw,
        type=ann_type,
        frame=int(raw.get("frame", default_frame)),
        class_name=class_name,
        label=str(raw.get("label") or ""),
        image_filename=str(image_filename or raw.get("filename")) if (image_filename or raw.get("filename")) else None,
    )


def _class_name(raw: dict[str, Any], class_field: str) -> str:
    if class_field == "class_label":
        left = str(raw.get("class") or "").strip()
        right = str(raw.get("label") or "").strip()
        return "_".join(part for part in (left, right) if part)
    value = raw.get(class_field)
    if value is None and class_field == "class":
        value = raw.get("label")
    if value is None and class_field == "label":
        value = raw.get("class")
    return str(value or "").strip()


def _read_excluded_frames(payload: dict[str, Any]) -> set[int]:
    excluded: set[int] = set()
    for frame in payload.get("excluded_frames") or []:
        try:
            excluded.add(int(frame))
        except (TypeError, ValueError):
            pass
    for flag in payload.get("frame_flags") or []:
        if not isinstance(flag, dict):
            continue
        if str(flag.get("flag") or "").lower() == "exclude":
            try:
                excluded.add(int(flag.get("frame")))
            except (TypeError, ValueError):
                pass
    return excluded


def _optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
