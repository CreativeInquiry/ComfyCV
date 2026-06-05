#!/usr/bin/env python3
"""Render point annotations onto decoded video frames.

Default usage from this folder:
    venv/bin/python test/render_point_overlays.py
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import cv2


DEFAULT_VIDEO = Path("media/video/piles_test/piles_test.mp4")
DEFAULT_JSON = Path("media/video/piles_test/piles_test_annotations.json")
DEFAULT_OUTPUT = Path("media/video/piles_test/annotated_frames")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Draw point annotations on their corresponding video frames."
    )
    parser.add_argument("--video", type=Path, default=DEFAULT_VIDEO, help="Input video path.")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON, help="Annotation JSON path.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Directory for annotated PNG frames.",
    )
    parser.add_argument("--radius", type=int, default=9, help="Circle radius in pixels.")
    parser.add_argument("--thickness", type=int, default=3, help="Circle stroke thickness.")
    parser.add_argument(
        "--draw-labels",
        action="store_true",
        help="Draw annotation labels next to circles.",
    )
    return parser.parse_args()


def load_point_annotations(json_path: Path) -> dict[int, list[dict]]:
    """Return point annotations grouped by zero-based frame number."""
    with json_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    annotations = payload.get("annotations", [])
    by_frame: dict[int, list[dict]] = defaultdict(list)
    for ann in annotations:
        if ann.get("type") != "point":
            continue
        if "frame" not in ann or "x" not in ann or "y" not in ann:
            continue
        by_frame[int(ann["frame"])].append(ann)

    return dict(by_frame)


def draw_points(frame_image, annotations: list[dict], radius: int, thickness: int, draw_labels: bool) -> None:
    """Draw all point annotations for one decoded OpenCV frame in place."""
    for ann in annotations:
        x = int(round(float(ann["x"])))
        y = int(round(float(ann["y"])))
        label = str(ann.get("label", "point"))

        # OpenCV uses BGR color order.
        cv2.circle(frame_image, (x, y), radius, (0, 140, 255), thickness, lineType=cv2.LINE_AA)
        cv2.circle(frame_image, (x, y), 2, (255, 255, 255), -1, lineType=cv2.LINE_AA)

        if draw_labels:
            cv2.putText(
                frame_image,
                label,
                (x + radius + 4, y - radius - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 140, 255),
                2,
                cv2.LINE_AA,
            )


def render_frames(video_path: Path, annotations_by_frame: dict[int, list[dict]], output_dir: Path, radius: int, thickness: int, draw_labels: bool) -> int:
    """Decode only annotated frames, draw points, and save PNG outputs."""
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    written = 0

    for frame_number in sorted(annotations_by_frame):
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ok, frame_image = capture.read()
        if not ok:
            print(f"warning: could not decode frame {frame_number}")
            continue

        draw_points(
            frame_image,
            annotations_by_frame[frame_number],
            radius=radius,
            thickness=thickness,
            draw_labels=draw_labels,
        )

        out_path = output_dir / f"frame_{frame_number:06d}.png"
        if not cv2.imwrite(str(out_path), frame_image):
            raise RuntimeError(f"Could not write output frame: {out_path}")
        written += 1

    capture.release()
    return written


def main() -> None:
    args = parse_args()
    annotations_by_frame = load_point_annotations(args.json)
    if not annotations_by_frame:
        raise RuntimeError(f"No point annotations found in {args.json}")

    written = render_frames(
        video_path=args.video,
        annotations_by_frame=annotations_by_frame,
        output_dir=args.output,
        radius=args.radius,
        thickness=args.thickness,
        draw_labels=args.draw_labels,
    )
    print(f"Wrote {written} annotated PNG frame(s) to {args.output}")


if __name__ == "__main__":
    main()
