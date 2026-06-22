from __future__ import annotations

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
    workers: int = 4,
    export_name: str = "best",
) -> Path:
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
        project=str(project_dir / "runs"),
        name="train",
        exist_ok=True,
    )
    save_dir = Path(getattr(result, "save_dir", project_dir / "runs" / "train"))
    return package_model(project_dir, save_dir, model_name=export_name)
