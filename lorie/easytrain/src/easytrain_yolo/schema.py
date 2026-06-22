from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class EasyAnnotation:
    raw: dict[str, Any]
    type: str
    frame: int
    class_name: str
    label: str
    image_filename: str | None = None


@dataclass
class ImageRecord:
    frame: int
    filename: str
    path: str | None
    width: int | None
    height: int | None
    annotations: list[EasyAnnotation] = field(default_factory=list)


@dataclass
class EasyProject:
    path: Path
    metadata: dict[str, Any]
    media_type: str
    annotations: list[EasyAnnotation]
    image_records: list[ImageRecord]
    excluded_frames: set[int]
    warnings: list[str] = field(default_factory=list)

    @property
    def is_video(self) -> bool:
        return self.media_type == "video"

    @property
    def is_images(self) -> bool:
        return self.media_type == "images" or bool(self.image_records)
