from __future__ import annotations

import os
import shutil
from pathlib import Path

from .package import package_model


def train_yolo(
    project_dir: Path,
    model: str = "yolo11n.pt",
    epochs: int = 100,
    imgsz: int = 640,
    batch: int = 8,
    patience: int = 20,
    device: str = "auto",
    workers: int = 0,
    export_name: str | None = None,
    verbose: bool = False,
) -> Path:
    project_dir = project_dir.resolve()
    _configure_writable_tool_dirs(project_dir)
    data_yaml = project_dir / "dataset" / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(f"Missing {data_yaml}; run convert first")

    try:
        import torch
    except ImportError:
        torch = None

    resolved_device = None if device == "auto" else device
    if torch is None:
        print("PyTorch is not importable yet; Ultralytics will report device details during training.")
    elif device == "auto":
        if torch.cuda.is_available():
            resolved_device = 0
            print(f"Using CUDA GPU: {torch.cuda.get_device_name(0)}")
        else:
            resolved_device = "cpu"
            print("CUDA is not available; training on CPU may be slow.")

    from ultralytics import YOLO

    yolo = YOLO(model)
    result = yolo.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        patience=patience,
        device=resolved_device,
        workers=workers,
        project=str(project_dir),
        name="training",
        exist_ok=True,
    )
    save_dir = Path(getattr(result, "save_dir", project_dir / "training"))
    diagnostic_files = _prepare_diagnostics(save_dir, keep_verbose=verbose)
    exported = package_model(
        project_dir,
        save_dir,
        model_name=export_name,
        epochs=epochs,
        model=model,
        imgsz=imgsz,
        batch=batch,
        device=device,
    )
    if diagnostic_files:
        print("Kept student-facing training files:")
        for path in diagnostic_files:
            print(f"  {path}")
    return exported


def _configure_writable_tool_dirs(project_dir: Path) -> None:
    cache_root = project_dir / ".cache"
    mpl_dir = cache_root / "matplotlib"
    yolo_dir = cache_root / "ultralytics"
    mpl_dir.mkdir(parents=True, exist_ok=True)
    yolo_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(mpl_dir))
    os.environ.setdefault("YOLO_CONFIG_DIR", str(yolo_dir))
    os.environ.setdefault("XDG_CACHE_HOME", str(cache_root))


def _prepare_diagnostics(save_dir: Path, keep_verbose: bool = False) -> list[Path]:
    save_dir = save_dir.resolve()
    renamed = _rename_validation_images(save_dir)
    if keep_verbose:
        return renamed

    keep_names = {
        "args.yaml",
        "results.csv",
        "results.png",
        "val_batch0_ground_truth.jpg",
        "val_batch0_predictions.jpg",
    }
    keep_dirs = {"weights"}
    for path in save_dir.iterdir():
        if path.name in keep_names:
            continue
        if path.is_dir() and path.name in keep_dirs:
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
    return [save_dir / name for name in sorted(keep_names) if (save_dir / name).exists()]


def _rename_validation_images(save_dir: Path) -> list[Path]:
    renames = {
        "val_batch0_labels.jpg": "val_batch0_ground_truth.jpg",
        "val_batch0_pred.jpg": "val_batch0_predictions.jpg",
    }
    outputs: list[Path] = []
    for old_name, new_name in renames.items():
        old_path = save_dir / old_name
        new_path = save_dir / new_name
        if old_path.exists():
            old_path.replace(new_path)
        if new_path.exists():
            outputs.append(new_path)
    return outputs
