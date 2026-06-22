from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Iterable


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".ogg"}


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {path}")
    return data


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def safe_name(value: str, fallback: str = "class") -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in value.strip())
    cleaned = "_".join(part for part in cleaned.split("_") if part)
    return cleaned or fallback


def deterministic_split(items: list[Any], val_ratio: float, seed: int) -> tuple[list[Any], list[Any]]:
    if not items:
        return [], []
    shuffled = list(items)
    random.Random(seed).shuffle(shuffled)
    if len(shuffled) == 1 or val_ratio <= 0:
        return shuffled, []
    val_count = round(len(shuffled) * val_ratio)
    val_count = max(1, min(len(shuffled) - 1, val_count))
    return shuffled[val_count:], shuffled[:val_count]


def rel_or_abs(path: Path) -> str:
    try:
        return str(path.resolve())
    except OSError:
        return str(path)


def natural_key(path_or_name: str | Path) -> list[int | str]:
    import re

    text = Path(path_or_name).name if isinstance(path_or_name, Path) else str(path_or_name)
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def summarize_counts(values: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))
