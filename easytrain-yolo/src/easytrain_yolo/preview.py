from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def render_previews(project_dir: Path, count: int = 12, split: str = "train", seed: int = 123) -> list[Path]:
    dataset = project_dir / "dataset"
    data_yaml = dataset / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(f"Missing {data_yaml}; run convert first")
    names = _read_names_from_data_yaml(data_yaml)
    image_dir = dataset / "images" / split
    label_dir = dataset / "labels" / split
    images = sorted(path for path in image_dir.iterdir() if path.is_file())
    random.Random(seed).shuffle(images)
    out_dir = project_dir / "previews" / split
    out_dir.mkdir(parents=True, exist_ok=True)

    outputs: list[Path] = []
    for image_path in images[:count]:
        label_path = label_dir / f"{image_path.stem}.txt"
        output_path = out_dir / image_path.name
        _draw_preview(image_path, label_path, output_path, names)
        outputs.append(output_path)
    return outputs


def _draw_preview(image_path: Path, label_path: Path, output_path: Path, names: dict[int, str]) -> None:
    with Image.open(image_path).convert("RGB") as image:
        draw = ImageDraw.Draw(image)
        width, height = image.size
        font = ImageFont.load_default()
        if label_path.exists():
            for line in label_path.read_text(encoding="utf-8").splitlines():
                parts = line.split()
                if len(parts) != 5:
                    continue
                class_id = int(parts[0])
                xc, yc, bw, bh = (float(value) for value in parts[1:])
                x1 = (xc - bw / 2) * width
                y1 = (yc - bh / 2) * height
                x2 = (xc + bw / 2) * width
                y2 = (yc + bh / 2) * height
                label = names.get(class_id, str(class_id))
                draw.rectangle((x1, y1, x2, y2), outline="#00ff66", width=3)
                text_box = draw.textbbox((x1, y1), label, font=font)
                draw.rectangle(text_box, fill="#00ff66")
                draw.text((x1, y1), label, fill="black", font=font)
        image.save(output_path)


def _read_names_from_data_yaml(path: Path) -> dict[int, str]:
    names: dict[int, str] = {}
    in_names = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() == "names:":
            in_names = True
            continue
        if not in_names:
            continue
        if line and not line.startswith(" "):
            break
        stripped = line.strip()
        if not stripped or ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        try:
            names[int(key.strip())] = value.strip().strip("'\"")
        except ValueError:
            continue
    return names
