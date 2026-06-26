from __future__ import annotations

import argparse
import json
from pathlib import Path

from .easylabeler_io import inspect_project, load_easylabeler
from .package import package_model
from .preview import render_previews
from .train import train_yolo
from .utils import read_json, safe_name
from .yolo_convert import ConvertOptions, convert_dataset


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:
        print(f"Error: {exc}")
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="easytrain-yolo",
        description="Convert EasyLabeler annotations to YOLO datasets and train small detection models.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    inspect = sub.add_parser("inspect", help="Summarize an EasyLabeler JSON file.")
    inspect.add_argument("labels_json", type=Path)
    inspect.add_argument("--class-field", choices=["class", "label", "class_label"], default="label")
    inspect.set_defaults(func=cmd_inspect)

    convert = sub.add_parser("convert", help="Convert EasyLabeler JSON to a YOLO dataset.")
    add_convert_args(convert)
    convert.set_defaults(func=cmd_convert)

    preview = sub.add_parser("preview", help="Render converted YOLO labels over sample images.")
    preview.add_argument("project_dir", type=Path)
    preview.add_argument("--count", type=int, default=12)
    preview.add_argument("--split", choices=["train", "val"], default="train")
    preview.add_argument("--seed", type=int, default=123)
    preview.set_defaults(func=cmd_preview)

    train = sub.add_parser("train", help="Train YOLO from a converted project directory.")
    add_train_args(train)
    train.set_defaults(func=cmd_train)

    package = sub.add_parser("package", help="Copy best.pt into exported_model and write ComfyUI notes.")
    package.add_argument("project_dir", type=Path)
    package.add_argument("--run-dir", type=Path)
    package.add_argument("--name", help="Optional exported model filename stem. Defaults to a timestamped project name.")
    package.set_defaults(func=cmd_package)

    all_cmd = sub.add_parser("all", help="Convert, preview, train, and package in one command.")
    add_convert_args(all_cmd)
    add_train_args(all_cmd, include_project=False)
    all_cmd.set_defaults(func=cmd_all)
    return parser


def add_convert_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("labels_json", type=Path)
    parser.add_argument("--out", type=Path, help="Output project folder. Defaults to runs/<source-media-name>.")
    parser.add_argument("--media-root", type=Path)
    parser.add_argument("--class-field", choices=["class", "label", "class_label"], default="label")
    parser.add_argument("--include-types", default="bbox,point,shape", help="Comma-separated annotation types.")
    parser.add_argument("--point-box-size-px", type=int, default=32)
    parser.add_argument("--val-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=123)
    parser.add_argument("--image-ext", default="jpg")
    parser.add_argument("--copy-mode", choices=["copy", "symlink"], default="copy")
    parser.add_argument("--preview-count", type=int, default=24, help="Number of preview images to render after conversion. Use 0 to skip previews.")
    parser.add_argument("--overwrite", dest="overwrite", action="store_true", default=True, help="Replace any existing converted dataset. This is the default.")
    parser.add_argument("--no-overwrite", dest="overwrite", action="store_false", help="Keep an existing converted dataset instead of replacing it.")


def add_train_args(parser: argparse.ArgumentParser, include_project: bool = True) -> None:
    if include_project:
        parser.add_argument("project_dir", type=Path)
    parser.add_argument("--model", default="yolo11n.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--export-name", help="Optional exported model filename stem. Defaults to a timestamped project name.")
    parser.add_argument(
        "-v",
        "--verbose",
        "-verbose",
        action="store_true",
        help="Keep all Ultralytics diagnostic files. By default only student-facing results are kept.",
    )


def cmd_inspect(args: argparse.Namespace) -> int:
    project = load_easylabeler(args.labels_json, class_field=args.class_field)
    print(json.dumps(inspect_project(project), indent=2))
    return 0


def cmd_convert(args: argparse.Namespace) -> int:
    options = _convert_options(args)
    report = convert_dataset(options)
    print(json.dumps(_report_summary(report), indent=2))
    if args.preview_count:
        outputs = render_previews(options.out_dir, count=args.preview_count, seed=args.seed)
        print(f"Wrote {len(outputs)} preview images to {options.out_dir / 'previews'}")
    return 0


def cmd_preview(args: argparse.Namespace) -> int:
    outputs = render_previews(args.project_dir, count=args.count, split=args.split, seed=args.seed)
    print(f"Wrote {len(outputs)} preview images to {args.project_dir / 'previews' / args.split}")
    return 0


def cmd_train(args: argparse.Namespace) -> int:
    exported = train_yolo(
        project_dir=args.project_dir,
        model=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        device=args.device,
        workers=args.workers,
        export_name=args.export_name,
        verbose=args.verbose,
    )
    print(f"Exported model: {exported}")
    return 0


def cmd_package(args: argparse.Namespace) -> int:
    exported = package_model(args.project_dir, args.run_dir, model_name=args.name)
    print(f"Exported model: {exported}")
    return 0


def cmd_all(args: argparse.Namespace) -> int:
    options = _convert_options(args)
    report = convert_dataset(options)
    print(json.dumps(_report_summary(report), indent=2))
    preview_count = args.preview_count or 12
    outputs = render_previews(options.out_dir, count=preview_count, seed=args.seed)
    print(f"Wrote {len(outputs)} preview images to {options.out_dir / 'previews'}")
    exported = train_yolo(
        project_dir=options.out_dir,
        model=args.model,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        device=args.device,
        workers=args.workers,
        export_name=args.export_name,
        verbose=args.verbose,
    )
    print(f"Exported model: {exported}")
    return 0


def _convert_options(args: argparse.Namespace) -> ConvertOptions:
    include_types = {part.strip().lower() for part in args.include_types.split(",") if part.strip()}
    return ConvertOptions(
        labels_json=args.labels_json,
        out_dir=args.out or _default_out_dir(args.labels_json),
        media_root=args.media_root,
        class_field=args.class_field,
        include_types=include_types,
        point_box_size_px=args.point_box_size_px,
        val_ratio=args.val_ratio,
        seed=args.seed,
        image_ext=args.image_ext.lstrip("."),
        copy_mode=args.copy_mode,
        overwrite=args.overwrite,
    )


def _default_out_dir(labels_json: Path) -> Path:
    stem = _source_media_stem(labels_json) or labels_json.stem
    for suffix in ("_annotations", "-annotations", "_labels", "-labels"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break
    return Path("runs") / safe_name(stem, "easytrain")


def _source_media_stem(labels_json: Path) -> str | None:
    try:
        payload = read_json(labels_json)
    except (OSError, ValueError):
        return None
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return None
    source_filename = metadata.get("source_filename")
    if not source_filename:
        return None
    return Path(str(source_filename)).stem


def _report_summary(report: dict) -> dict:
    return {
        "dataset_dir": report["dataset_dir"],
        "data_yaml": report["data_yaml"],
        "classes": report["classes"],
        "frames_total": report["frames_total"],
        "train_count": report["train_count"],
        "val_count": report["val_count"],
        "warnings": report["warnings"],
    }


if __name__ == "__main__":
    raise SystemExit(main())
