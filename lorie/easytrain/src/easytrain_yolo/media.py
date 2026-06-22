from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image

from .schema import EasyProject, ImageRecord
from .utils import IMAGE_EXTS, natural_key


def find_video(project: EasyProject, media_root: Path | None = None) -> Path:
    candidates: list[Path] = []
    roots = [media_root, project.path.parent]
    names = [project.metadata.get("source_video_path"), project.metadata.get("source_filename")]
    for root in roots:
        if not root:
            continue
        for name in names:
            if name:
                candidates.append(root / str(name))
        if project.metadata.get("source_filename"):
            candidates.extend(root.rglob(str(project.metadata["source_filename"])))
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    searched = ", ".join(str(path) for path in candidates[:8])
    raise FileNotFoundError(f"Could not find source video. Searched: {searched}")


def extract_video_frames(video_path: Path, frames: list[int], destination: Path, image_ext: str = "jpg") -> dict[int, Path]:
    try:
        import cv2
    except ImportError as exc:
        return _extract_video_frames_ffmpeg(video_path, frames, destination, image_ext, exc)

    destination.mkdir(parents=True, exist_ok=True)
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video {video_path}")
    output: dict[int, Path] = {}
    for frame in sorted(set(frames)):
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame)
        ok, image = capture.read()
        if not ok:
            raise RuntimeError(f"Could not extract frame {frame} from {video_path}")
        out_path = destination / f"frame_{frame:06d}.{image_ext}"
        cv2.imwrite(str(out_path), image)
        output[frame] = out_path
    capture.release()
    return output


def _extract_video_frames_ffmpeg(
    video_path: Path,
    frames: list[int],
    destination: Path,
    image_ext: str,
    original_error: ImportError,
) -> dict[int, Path]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ImportError(
            "Video conversion requires OpenCV or ffmpeg. Install the project dependencies with `pip install -e .` "
            "from the lorie/easytrain folder, or install ffmpeg."
        ) from original_error

    destination.mkdir(parents=True, exist_ok=True)
    output: dict[int, Path] = {}
    for frame in sorted(set(frames)):
        out_path = destination / f"frame_{frame:06d}.{image_ext}"
        command = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"select=eq(n\\,{frame})",
            "-frames:v",
            "1",
            "-q:v",
            "2",
            "-y",
            str(out_path),
        ]
        subprocess.run(command, check=True)
        if not out_path.exists():
            raise RuntimeError(f"ffmpeg did not write frame {frame} from {video_path}")
        output[frame] = out_path
    return output


def find_image_for_record(record: ImageRecord, media_root: Path | None, project_path: Path) -> Path:
    roots = [media_root, project_path.parent]
    names = [record.path, record.filename]
    for root in roots:
        if not root:
            continue
        for name in names:
            if name:
                candidate = root / name
                if candidate.exists() and candidate.is_file():
                    return candidate.resolve()
        matches = sorted(
            (path for path in root.rglob(record.filename) if path.is_file()),
            key=natural_key,
        )
        if matches:
            return matches[0].resolve()
    raise FileNotFoundError(f"Could not find image {record.filename}")


def copy_or_link_image(source: Path, destination: Path, mode: str = "copy") -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if mode == "symlink":
        if destination.exists():
            destination.unlink()
        destination.symlink_to(source)
    else:
        shutil.copy2(source, destination)


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def list_images(folder: Path) -> list[Path]:
    return sorted(
        (path for path in folder.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTS),
        key=natural_key,
    )
