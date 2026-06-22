# easytrain-yolo

`easytrain-yolo` converts EasyLabeler JSON annotations into an Ultralytics YOLO detection dataset, trains a small YOLO model, and packages the trained `.pt` file for ComfyUI-YOLO.

Workflow:

```text
EasyLabeler -> easytrain-yolo -> exported_model/best.pt -> ComfyUI-YOLO
```

This is a local command-line teaching tool. It does not provide a GUI and does not add a ComfyUI node.

## Install

Create and activate a conda environment:

```bash
cd lorie/easytrain
conda create -n easytrain-yolo python=3.10 -y
conda activate easytrain-yolo
pip install -e .
```

On Windows, use the same commands from Anaconda Prompt or Miniforge Prompt:

```bat
cd lorie\easytrain
conda create -n easytrain-yolo python=3.10 -y
conda activate easytrain-yolo
pip install -e .
```

If you use an NVIDIA GPU, install the PyTorch build that matches your CUDA setup before running training. The CPU path still works, but it can be slow for YOLO training.

## Inspect Labels

```bash
easytrain-yolo inspect path/to/annotations.json
```

By default, YOLO class names come from EasyLabeler's `class` field. You can change this:

```bash
easytrain-yolo inspect labels.json --class-field label
easytrain-yolo inspect labels.json --class-field class_label
```

## Convert Only

Course sample using the labeled `piles_test` video from `golan/easylabeler`:

```bash
easytrain-yolo inspect ../../golan/easylabeler/media/video/piles_test/piles_test_annotations.json \
  --class-field label

easytrain-yolo convert ../../golan/easylabeler/media/video/piles_test/piles_test_annotations.json \
  --out runs/piles_test_example \
  --media-root ../../golan/easylabeler/media/video/piles_test \
  --class-field label \
  --point-box-size-px 40 \
  --preview-count 8 \
  --overwrite
```

This creates a local test dataset in `runs/piles_test_example/` with class `peak`. The previews in `runs/piles_test_example/previews/` should be checked before training.

Video example:

```bash
easytrain-yolo convert golan/easylabeler/media/video/piles_test/piles_test_annotations.json \
  --out runs/piles_test \
  --media-root golan/easylabeler/media/video/piles_test \
  --class-field label \
  --point-box-size-px 40 \
  --preview-count 12 \
  --overwrite
```

Image-folder example:

```bash
easytrain-yolo convert golan/easylabeler/media/images/bellybutton/bellybutton_annotations.json \
  --out runs/bellybutton \
  --media-root golan/easylabeler/media/images/bellybutton \
  --point-box-size-px 32 \
  --preview-count 12 \
  --overwrite
```

The converter creates:

```text
runs/my_project/
  dataset/
    images/train/
    images/val/
    labels/train/
    labels/val/
    data.yaml
  conversion_report.json
  previews/
```

## Preview Converted Boxes

Always preview labels before training:

```bash
easytrain-yolo preview runs/bellybutton --count 24
```

## Train

```bash
easytrain-yolo train runs/bellybutton \
  --model yolo11n.pt \
  --epochs 100 \
  --imgsz 640 \
  --batch 8
```

For a slightly stronger GPU model:

```bash
easytrain-yolo train runs/bellybutton --model yolo11s.pt --epochs 150
```

## Convert And Train In One Command

```bash
easytrain-yolo all labels.json \
  --out runs/my_detector \
  --media-root path/to/media \
  --model yolo11n.pt \
  --epochs 100
```

## Use In ComfyUI-YOLO

After training:

```text
runs/my_detector/exported_model/best.pt
```

Copy that `.pt` file into your ComfyUI Ultralytics models folder, commonly:

```text
ComfyUI/models/ultralytics/
```

Restart ComfyUI and load the model with your ComfyUI-YOLO custom model loader.

## Annotation Behavior

- `bbox` annotations become normal YOLO boxes.
- `point` annotations become small synthetic boxes. Use `--point-box-size-px` to control their size.
- `shape` annotations become tight boxes around the polygon vertices.
- `excluded_frames` and `frame_flags` with `flag: "exclude"` are ignored.

Point boxes are a practical detector-training trick. They are not true keypoint or pose training.

## Limitations

- This trains object detection, not persistent tracking.
- Small datasets may overfit. Label visually diverse examples.
- 10 examples are enough for a demo, not a reliable model.
- 50-100 examples can work when the visual target is consistent.
- YOLO segmentation from shapes is future work.
- YOLO pose/keypoint training from points is future work.
