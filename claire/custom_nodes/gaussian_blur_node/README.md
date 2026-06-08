# Build Your Own Blur: A Custom ComfyUI Node with OpenCV
### A beginner-friendly guide to making your first image-processing node

> **Who this is for:** Anyone who wants to build a custom ComfyUI node that actually *does something* to an image.
>
> This tutorial is part of a series. If you've never made a custom node before, check out [the Hello World tutorial](https://github.com/CreativeInquiry/ComfyCV/tree/main/claire/custom_nodes/hello_world_node) first.

---

## Table of Contents

1. [What Are We Building?](#what-are-we-building)
2. [What Is a Gaussian Blur, Actually?](#what-is-a-gaussian-blur-actually)
3. [Setting Up Your Files](#setting-up-your-files)
4. [The Trickiest Part: Image Formats](#the-trickiest-part-image-formats)
5. [Writing the Node, Step by Step](#writing-the-node-step-by-step)
6. [The `__init__.py`](#the-initpy)
7. [Uploading to GitHub](#uploading-to-github)
8. [Installing on RunComfy](#installing-on-runcomfy)
9. [Testing It!](#testing-it)
10. [Debugging Checklist](#debugging-checklist)
11. [Gotchas & Tips](#gotchas--tips)

---

## What Are We Building?

Now that we've made a very simple Comfy node, we want to *LEVEL UP* and make a ComfyUI node that takes an input and returns an (altered) output. We'll demonstrate the process through something called a Gaussian blur. Our node will take any image, blur it, and then spit the blurred version back out. We're going to use a library called **OpenCV**, which is a popular computer vision library that makes image manipulation easy. (With this demo, you'll learn the skills to be able to call on other tools or libraries too, so the world is your oyster ˖°🌊.·°*🫧𓇼⋆🦪₊)

It'll have two controls you can play with:
- **Kernel size**: basically, how blurry. Bigger number = blurrier.
<img src="../assets/kernel.webp" alt="Description" width="300" height="200">

- **Sigma**: fine-tunes the blur shape. Leave it at 0 and OpenCV figures it out for you.
<img src="../sigma.jpg" alt="Description" width="300" height="200">

TODO: ADD SCREENSHOT OF NODE IN CANVAS HERE

This tutorial also teaches you something that may apply to some other work you might build: **how to convert images between ComfyUI's format and OpenCV's format**. Once you know this, a whole world of OpenCV effects opens up (such as sharpening, edge detection, color grading, and more!).

---

## WTHeck is Gaussian Blur?

When you blur an image, you're replacing each pixel with some kind of average of its neighbors.

A Gaussian blur uses a **bell curve** (a "Gaussian" curve) to decide. Pixels right next to the center pixel count a lot. Pixels further away count less and less. The result is a smooth, natural-looking blur, like a blurry photo filter.

<img src="./custom_nodes/gaussian_blur_node/assets/gaussian_curve.jpg" alt="Description" width="300" height="200">

More in depth about the parameters you'll control:

**Kernel size**: A kernel size of 5 means each pixel looks at a 5×5 grid of surrounding pixels. A kernel of 15 looks at a 15×15 grid, so that's much blurrier.

> /btw kernel size must **always be an odd number** — 1, 3, 5, 7, 9... This is because CNNs (Convolutional Neural Networks), the ML that works like the "filter" in this case, prefers a center pixel. OpenCV will throw an error if you give it an even number. Our node handles this automatically, but good to know why!

**Sigma**: controls how steeply the bell curve drops off. High sigma = the blur spreads further. Low sigma = the blur stays tight. Setting it to **0** tells OpenCV "just figure it out from the kernel size," which we will use as the default.

---

## Setting Up Your Files

In your `ComfyUI/custom_nodes/` folder, create a new folder called `gaussian-blur-node` (or whatever you want to call it). Inside, create two files:

```
custom_nodes/
  gaussian-blur-node/
    __init__.py        ← tells Python this folder is a package
    blur_node.py       ← where our actual node code lives
```

---

## The Trickiest Part: Image Formats

Before we write a single line of code, we need to talk about something that trips up *everyone* the first time they try to process images in ComfyUI.

**ComfyUI and OpenCV store images in completely different formats.**

Here's the difference:

| | ComfyUI | OpenCV |
|---|---|---|
| **Shape** | 4D: `(batch, height, width, channels)` | 3D: `(height, width, channels)` |
| **Data type** | PyTorch tensor of `float32` | NumPy array of `uint8` |
| **Pixel values** | `0.0` to `1.0` | `0` to `255` |
| **Color order** | RGB 🔴🟢🔵 | BGR 🔵🟢🔴 ← !!! |

That last one is sneaky. OpenCV stores colors as **Blue-Green-Red** instead of the usual Red-Green-Blue. If you forget to swap them, your output will have a weird bluish or orange tint and you'll spend an hour wondering what went wrong. (Ask me how I know 😅)

### The conversion code

Here's how to go from ComfyUI → OpenCV:

```python
img_np = image[0].cpu().numpy()           # grab first image, convert to numpy
img_np = (img_np * 255).astype(np.uint8)  # scale 0–1 to 0–255
img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)  # flip RGB to BGR
```

And back from OpenCV → ComfyUI:

```python
img_rgb = cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB)     # flip BGR back to RGB
img_float = img_rgb.astype(np.float32) / 255.0        # scale 0–255 back to 0–1
output = torch.from_numpy(img_float).unsqueeze(0)     # add batch dimension back
```

---

## Writing the Node, Step by Step

Open `blur_node.py` and follow along. We'll build it piece by piece.

### Step 1: Imports

```python
import cv2
import numpy as np
import torch
```

- `cv2` is OpenCV, what does the actual blurring
- `numpy` handles the array math
- `torch` is PyTorch, which we need to convert back to a ComfyUI tensor at the end

### Step 2: Define the class

```python
class GaussianBlurNode:
    """
    Applies a Gaussian blur to an image using OpenCV.
    Kernel size controls how blurry the image gets.
    Sigma controls the shape of the blur.
    """
```

Every ComfyUI node is a Python class. The name can be anything (don't forget to capitalize it.)

### Step 3: Define the inputs

```python
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image":       ("IMAGE",),
                "kernel_size": ("INT",   {"default": 5,   "min": 1, "max": 31, "step": 2}),
                "sigma":       ("FLOAT", {"default": 0.0, "min": 0.0, "max": 10.0, "step": 0.1}),
            }
        }
```

A few things to notice here:

- `"IMAGE"` is a special ComfyUI type. It shows up as a dot connector on the node, so you'll need to connect something to it (a load image node, perhaps).
- `"step": 2` on the kernel size makes the slider jump by 2s, so it's always landing on odd numbers.
- `"default": 0.0` for sigma means "auto-calculate" by default, just to keep it simple.

### Step 4: Define the outputs and metadata

```python
    RETURN_TYPES  = ("IMAGE",)
    RETURN_NAMES  = ("blurred_image",)
    FUNCTION      = "apply_blur"
    CATEGORY      = "tutorials/opencv"
```

- `RETURN_TYPES` and `RETURN_NAMES` define what comes out of the right side of the node
- `FUNCTION` must match the method name exactly
- `CATEGORY` is where the node appears in the right-click menu (`tutorials → opencv`)

### Step 5: Write the function

```python
    def apply_blur(self, image, kernel_size, sigma):

        # Safety check: kernel size must be odd
        if kernel_size % 2 == 0:
            kernel_size += 1

        # ── ComfyUI tensor → OpenCV array ──────────────────────────────────
        img_np = image[0].cpu().numpy()           # grab first image in batch
        img_np = (img_np * 255).astype(np.uint8)  # float 0–1 → uint8 0–255
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)  # RGB → BGR

        # ── Apply the Gaussian blur ─────────────────────────────────────────
        blurred = cv2.GaussianBlur(
            img_cv,
            (kernel_size, kernel_size),  # kernel size — same for width & height
            sigma                        # sigmaX — 0 = auto from kernel size
        )

        # ── OpenCV array → ComfyUI tensor ──────────────────────────────────
        blurred_rgb = cv2.cvtColor(blurred, cv2.COLOR_BGR2RGB)  # BGR → RGB
        blurred_float = blurred_rgb.astype(np.float32) / 255.0  # uint8 → float
        output = torch.from_numpy(blurred_float).unsqueeze(0)   # add batch dim

        return (output,)
```

The three sections map directly to what we know about functions: convert in, do the thing, convert back out.

### Step 6: Register the node

```python
NODE_CLASS_MAPPINGS = {
    "GaussianBlur": GaussianBlurNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GaussianBlur": "Gaussian Blur 🌫️",
}
```

The mappings here are dictionaries are what ComfyUI reads at startup to know your node exists. The key in `NODE_CLASS_MAPPINGS` (`"GaussianBlur"`) is the internal ID, so we keep it unique. The value in `NODE_DISPLAY_NAME_MAPPINGS` is what shows up in the GUI search of Comfy.

### The complete file

Here's everything together:

```python
import cv2
import numpy as np
import torch


class GaussianBlurNode:
    """
    Applies a Gaussian blur to an image using OpenCV.
    Kernel size controls how blurry the image gets.
    Sigma controls the shape of the blur — set to 0 to auto-calculate.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image":       ("IMAGE",),
                "kernel_size": ("INT",   {"default": 5,   "min": 1, "max": 31, "step": 2}),
                "sigma":       ("FLOAT", {"default": 0.0, "min": 0.0, "max": 10.0, "step": 0.1}),
            }
        }

    RETURN_TYPES  = ("IMAGE",)
    RETURN_NAMES  = ("blurred_image",)
    FUNCTION      = "apply_blur"
    CATEGORY      = "tutorials/opencv"

    def apply_blur(self, image, kernel_size, sigma):

        # Safety check: kernel size must be odd
        if kernel_size % 2 == 0:
            kernel_size += 1

        # ── ComfyUI tensor → OpenCV array ──────────────────────────────────
        img_np = image[0].cpu().numpy()
        img_np = (img_np * 255).astype(np.uint8)
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # ── Apply the Gaussian blur ─────────────────────────────────────────
        blurred = cv2.GaussianBlur(
            img_cv,
            (kernel_size, kernel_size),
            sigma
        )

        # ── OpenCV array → ComfyUI tensor ──────────────────────────────────
        blurred_rgb = cv2.cvtColor(blurred, cv2.COLOR_BGR2RGB)
        blurred_float = blurred_rgb.astype(np.float32) / 255.0
        output = torch.from_numpy(blurred_float).unsqueeze(0)

        return (output,)


NODE_CLASS_MAPPINGS = {
    "GaussianBlur": GaussianBlurNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GaussianBlur": "Gaussian Blur 🌫️",
}
```

---

## The `__init__.py`

Now open your `__init__.py` file and add these two lines:

```python
from .blur_node import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
```

This file just works as a directory/pointer of where Comfy should access the actual node. 

---

## Uploading to GitHub

To install your node on RunComfy (or share it with anyone), it needs to be on GitHub.

Your repo should look like this:

```
gaussian-blur-node/
  __init__.py
  blur_node.py
  README.md           ← describe what your node does
  pyproject.toml      ← lists your dependencies
```

### `pyproject.toml`

This file tells ComfyUI Manager what Python packages to install when someone adds your node. Make sure `opencv-python-headless` is listed here:

```toml
[project]
name = "gaussian-blur-node"
version = "1.0.0"
description = "A Gaussian blur node for ComfyUI using OpenCV"
requires-python = ">=3.10"
dependencies = [
    "opencv-python-headless",
]

[tool.comfy]
PublisherId = "your-github-username"
DisplayName = "gaussian-blur-node"
```

> /btw: We use `opencv-python-headless` instead of `opencv-python`. The regular version includes GUI display tools that don't work on cloud servers and can cause weird import errors.

Push everything to GitHub, copy your repo URL, and you're ready to install.

---

## Installing on RunComfy

Here. we'll follow the same process as the [previous tutorial](https://github.com/CreativeInquiry/ComfyCV/blob/main/claire/custom_nodes/hello_world_node/README.md)

1. Open ComfyUI on RunComfy
2. Click **Manager** in the top menu
3. Click **Install via Git URL**
4. Paste your GitHub repo URL
5. Click **Install** and wait for it to finish
6. Click **Restart**
7. **Hard refresh your browser:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

---

## Testing It!

### Wire it up

```
[Load Image] → [Gaussian Blur 🌫️] → [Preview Image]
```

1. Double-click the canvas → search **Load Image** → add it
2. Double-click → search **Gaussian Blur** → add it
3. Double-click → search **Preview Image** → add it
4. Wire them: `Load Image IMAGE` output → `Gaussian Blur image` input → `Preview Image images` input
5. Upload a photo in Load Image and hit **Queue Prompt** 

TODO; ADD SCREENSHOT OF WIRED WORKFLOW HERE

### Fun things to try

- **Kernel 3, sigma 0** — barely any blur, almost the original
- **Kernel 15, sigma 0** — noticeably soft and dreamy
- **Kernel 31, sigma 0** — very blurry, shapes become abstract
- **Kernel 9, sigma 0.5** — tight, controlled blur
- **Kernel 9, sigma 5.0** — same kernel, much softer spread
- **Kernel 1** — no-op! Passes the image through unchanged

ADD BEFORE/AFTER COMPARISON SCREENSHOT HERE

---

## Debugging Checklist

Node not showing up? Walk through this list:

- [ ] Did you **restart the ComfyUI server**? (Not just refresh the browser — a full restart)
- [ ] Did you **hard refresh** after restarting? (`Cmd/Ctrl+Shift+R`)
- [ ] Is `opencv-python-headless` installed? Run `pip show opencv-python-headless` in the RunComfy terminal
- [ ] Does your `__init__.py` import from `.blur_node` (with the dot)?
- [ ] Are `NODE_CLASS_MAPPINGS` and `NODE_DISPLAY_NAME_MAPPINGS` defined at the bottom of `blur_node.py`?

Node shows up but errors when you run it?

- Check the ComfyUI log for the error message. It'll tell you exactly which line failed
- Most common culprit: OpenCV not installed. Run `pip install opencv-python-headless`


---

## Gotchas & Tips

**Always use `opencv-python-headless` on cloud.**
The non-headless version includes GUI tools that don't exist on servers.

**Don't forget the color channel flip.**
RGB ↔ BGR is the sneakiest bug. If your output looks weirdly tinted, that's why.

**`.cpu()` before `.numpy()`.**
If the image tensor is on the GPU, NumPy can't read it. `.cpu()` moves it to regular memory first. Always include it.

**Don't forget `.unsqueeze(0)` on the way out.**
After processing, the image is 3D `(H, W, C)`. ComfyUI needs 4D `(batch, H, W, C)`. Without `unsqueeze(0)` you'll get a shape mismatch error.

**This pattern works for almost any OpenCV effect.**
The convert-in / do-the-thing / convert-out pattern is the same for basically every OpenCV function. Swap `cv2.GaussianBlur` for `cv2.medianBlur`, `cv2.Canny`, `cv2.bilateralFilter`... the wrapper code is identical. OpenCV has hundreds of effects — you now have the key to all of them!

---

## Resources

- [OpenCV image filtering docs](https://docs.opencv.org/4.x/d4/d13/tutorial_py_filtering.html) — official reference for blur functions
- [opencv-python-headless on PyPI](https://pypi.org/project/opencv-python-headless/) — the package we installed
- [Hello World node tutorial](https://github.com/CreativeInquiry/ComfyCV/blob/main/claire/custom_nodes/hello_world_node/README.md) <—- the previous tutorial in this series
