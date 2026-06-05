"""
ComfyUI Saliency Nodes — Algorithmic Attention
For Mac (Apple Silicon) + comfyenv conda setup.

Install:  pip install saliency torchvision matplotlib
Place in: ComfyUI/custom_nodes/creative_code/saliency_nodes.py
"""

import torch
import torch.nn.functional as F
import numpy as np

# ── Lazy imports ──────────────────────────────────────────────────────────────
_saliency = None
_torchvision_models = None

def _ensure_deps():
    global _saliency, _torchvision_models
    if _saliency is None:
        try:
            import saliency.core as sal
            _saliency = sal
        except ImportError:
            raise ImportError("[SaliencyNodes] Run: pip install saliency")
    if _torchvision_models is None:
        try:
            import torchvision.models as models
            _torchvision_models = models
        except ImportError:
            raise ImportError("[SaliencyNodes] Run: pip install torchvision")

# ── Constants ─────────────────────────────────────────────────────────────────
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

SUPPORTED_MODELS = [
    "vgg16", "vgg19", "resnet50", "resnet101",
    "inception_v3", "mobilenet_v3_large",
    "densenet121",
]

_model_cache: dict = {}

# ── ImageNet class labels ─────────────────────────────────────────────────────
_imagenet_labels: list = []

def _get_imagenet_label(class_idx: int) -> str:
    global _imagenet_labels
    if not _imagenet_labels:
        try:
            import torchvision.models as tv
            _imagenet_labels = tv.VGG16_Weights.DEFAULT.meta["categories"]
        except Exception:
            pass
    if _imagenet_labels and 0 <= class_idx < len(_imagenet_labels):
        return _imagenet_labels[class_idx]
    return f"class_{class_idx}"
def _load_model(model_name: str):
    if model_name not in _model_cache:
        _ensure_deps()
        # Must load outside inference_mode — ComfyUI wraps everything in it,
        # and tensors created inside inference_mode can't be used with autograd.
        with torch.inference_mode(False):
            with torch.enable_grad():
                constructor = getattr(_torchvision_models, model_name)
                try:
                    import torchvision.models as tv
                    weight_map = {
                        "inception_v3":       tv.Inception_V3_Weights.DEFAULT,
                        "resnet50":           tv.ResNet50_Weights.DEFAULT,
                        "resnet101":          tv.ResNet101_Weights.DEFAULT,
                        "vgg16":              tv.VGG16_Weights.DEFAULT,
                        "vgg19":              tv.VGG19_Weights.DEFAULT,
                        "mobilenet_v3_large": tv.MobileNet_V3_Large_Weights.DEFAULT,
                        # "efficientnet_b0":    tv.EfficientNet_B0_Weights.DEFAULT,
                        "densenet121":        tv.DenseNet121_Weights.DEFAULT,
                    }
                    model = constructor(weights=weight_map.get(model_name))
                except AttributeError:
                    model = constructor(pretrained=True)

                model.eval().cpu()
                # Deep clone all params and buffers to ensure no inference tensors remain
                for param in model.parameters():
                    param.data = param.data.clone()
                for buf_name, buf in model.named_buffers():
                    if buf is not None:
                        # set_buffer isn't directly available, use the parent module
                        parts = buf_name.rsplit('.', 1)
                        if len(parts) == 2:
                            parent = dict(model.named_modules())[parts[0]]
                            setattr(parent, parts[1], buf.clone())
                        else:
                            setattr(model, buf_name, buf.clone())

                _model_cache[model_name] = model
                print(f"[SaliencyNodes] Loaded {model_name} on CPU (grad-safe)")
    return _model_cache[model_name]


# ── Image helpers ─────────────────────────────────────────────────────────────
def _comfy_to_np(image_tensor: torch.Tensor) -> np.ndarray:
    return image_tensor[0].cpu().numpy().astype(np.float32)

def _np_to_comfy(arr: np.ndarray) -> torch.Tensor:
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], axis=-1)
    return torch.from_numpy(np.clip(arr, 0.0, 1.0).astype(np.float32)).unsqueeze(0)

def _resize_np(img: np.ndarray, h: int, w: int) -> np.ndarray:
    t = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)
    t = F.interpolate(t, size=(h, w), mode="bilinear", align_corners=False)
    return t.squeeze(0).permute(1, 2, 0).numpy()


# ── call_model_function for PAIR saliency ─────────────────────────────────────
def _make_call_model_fn(model, class_idx):
    """
    ComfyUI runs node execution inside torch.inference_mode() which disables
    autograd entirely. We must escape that context to compute gradients.
    Everything runs on CPU to avoid MPS autograd issues.
    """
    def call_model_function(images, call_model_args=None, expected_keys=None):
        import saliency.core as saliency

        # Double-escape any no_grad / inference_mode context from ComfyUI
        with torch.inference_mode(False):
            with torch.enable_grad():
                images_np = np.array(images, dtype=np.float32)
                images_tensor = torch.from_numpy(images_np).permute(0, 3, 1, 2)

                mean = torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1)
                std  = torch.tensor(IMAGENET_STD).view(1, 3, 1, 1)
                images_tensor = (images_tensor - mean) / std

                # .clone() is required when escaping inference_mode
                images_tensor = images_tensor.clone().detach().requires_grad_(True)

                output = model(images_tensor)
                if hasattr(output, "logits"):
                    output = output.logits

                target = output[:, class_idx].sum()
                model.zero_grad()
                target.backward()

                gradients = images_tensor.grad.detach().numpy()
                gradients = np.transpose(gradients, (0, 2, 3, 1))  # BCHW→BHWC

                result = {}
                if saliency.INPUT_OUTPUT_GRADIENTS in (expected_keys or []):
                    result[saliency.INPUT_OUTPUT_GRADIENTS] = gradients
                if saliency.CONVOLUTION_LAYER_VALUES in (expected_keys or []):
                    result[saliency.CONVOLUTION_LAYER_VALUES] = gradients

                return result

    return call_model_function


# ── Top class prediction ───────────────────────────────────────────────────────
def _predict_top_class(model, img_np_hwc: np.ndarray) -> int:
    with torch.inference_mode(False):
        with torch.no_grad():
            t = torch.from_numpy(img_np_hwc).permute(2, 0, 1).unsqueeze(0)
            mean = torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1)
            std  = torch.tensor(IMAGENET_STD).view(1, 3, 1, 1)
            t = (t - mean) / std
            out = model(t)
            if hasattr(out, "logits"):
                out = out.logits
            return int(out.argmax(dim=1).item())


# ── Visualization helpers ──────────────────────────────────────────────────────
def _vis_grayscale(mask):
    """Handle both 3D (H,W,3) gradient masks and 2D (H,W) XRAI region masks."""
    if mask.ndim == 2:
        # XRAI returns 2D directly — just normalize it
        m = np.abs(mask)
        vmax = np.percentile(m, 99)
        return np.clip(m / (vmax + 1e-8), 0, 1)
    import saliency.core as saliency
    return saliency.VisualizeImageGrayscale(mask)

def _vis_diverging(mask3d):
    import saliency.core as saliency
    div = saliency.VisualizeImageDiverging(mask3d)
    return (div - div.min()) / (div.max() - div.min() + 1e-8)

def _apply_colormap(gray_2d, colormap_name):
    try:
        import matplotlib.cm as cm
        cmap = getattr(cm, colormap_name, cm.viridis)
        return cmap(gray_2d)[..., :3].astype(np.float32)
    except Exception:
        return np.stack([gray_2d, gray_2d * 0.5, np.zeros_like(gray_2d)], axis=-1)

def _apply_heatmap(gray2d, original_hwc, colormap="viridis"):
    heatmap = _apply_colormap(gray2d, colormap)
    return np.clip(original_hwc * 0.45 + heatmap * 0.55, 0, 1)


# ── Shared saliency method runner ─────────────────────────────────────────────
def _run_saliency_method(method, call_fn, img_np, use_smoothgrad,
                          n_samples, noise, ig_steps):
    _ensure_deps()
    import saliency.core as saliency

    get_kw = dict(call_model_function=call_fn, call_model_args=None)
    smooth_kw = dict(call_model_function=call_fn, call_model_args=None,
                     stdev_spread=noise, nsamples=n_samples)

    if method == "Vanilla Gradients":
        algo = saliency.GradientSaliency()
        return algo.GetSmoothedMask(img_np, **smooth_kw) if use_smoothgrad \
               else algo.GetMask(img_np, **get_kw)

    elif method == "SmoothGrad":
        return saliency.GradientSaliency().GetSmoothedMask(img_np, **smooth_kw)

    elif method == "Integrated Gradients":
        algo = saliency.IntegratedGradients()
        baseline = np.zeros_like(img_np)
        if use_smoothgrad:
            return algo.GetSmoothedMask(img_np, **smooth_kw,
                                        x_baseline=baseline, x_steps=ig_steps)
        return algo.GetMask(img_np, **get_kw, x_baseline=baseline, x_steps=ig_steps)

    elif method == "Blur IG":
        algo = saliency.BlurIG()
        return algo.GetSmoothedMask(img_np, **smooth_kw, steps=ig_steps) \
               if use_smoothgrad else algo.GetMask(img_np, **get_kw, steps=ig_steps)

    elif method == "Guided IG":
        algo = saliency.GuidedIG()
        baseline = np.zeros_like(img_np)
        if use_smoothgrad:
            return algo.GetSmoothedMask(img_np, **smooth_kw,
                                        x_baseline=baseline, x_steps=ig_steps)
        return algo.GetMask(img_np, **get_kw, x_baseline=baseline, x_steps=ig_steps)

    elif method == "XRAI":
        algo = saliency.XRAI()
        params = saliency.XRAIParameters()
        params.algorithm = "fast"
        return algo.GetMask(img_np, **get_kw, extra_parameters=params)

    raise ValueError(f"Unknown method: {method}")


# ══════════════════════════════════════════════════════════════════════════════
# Node 1: Saliency Map
# ══════════════════════════════════════════════════════════════════════════════
class SaliencyMapNode:
    METHODS = ["Vanilla Gradients", "SmoothGrad", "Integrated Gradients",
               "Blur IG", "Guided IG", "XRAI"]
    OUTPUT_MODES = ["heatmap_overlay", "grayscale_mask", "diverging_mask", "overlay_and_mask"]

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "image":              ("IMAGE",),
            "model_name":         (SUPPORTED_MODELS, {"default": "vgg16"}),
            "method":             (cls.METHODS, {"default": "Integrated Gradients"}),
            "output_mode":        (cls.OUTPUT_MODES, {"default": "heatmap_overlay"}),
            "class_index":        ("INT", {"default": -1, "min": -1, "max": 999}),
            "smoothgrad_samples": ("INT", {"default": 25, "min": 5, "max": 100, "step": 5}),
            "smoothgrad_noise":   ("FLOAT", {"default": 0.15, "min": 0.01, "max": 0.5, "step": 0.01}),
            "ig_steps":           ("INT", {"default": 50, "min": 10, "max": 300, "step": 10}),
            "input_size":         ("INT", {"default": 224, "min": 224, "max": 512,
                                           "tooltip": "Use 299 for InceptionV3"}),
        }, "optional": {
            "use_smoothgrad": ("BOOLEAN", {"default": False}),
        }}

    RETURN_TYPES  = ("IMAGE", "IMAGE")
    RETURN_NAMES  = ("saliency_output", "original_resized")
    FUNCTION      = "compute_saliency"
    CATEGORY      = "creative-code/explainability"

    def compute_saliency(self, image, model_name, method, output_mode,
                          class_index, smoothgrad_samples, smoothgrad_noise,
                          ig_steps, input_size, use_smoothgrad=False):
        model = _load_model(model_name)
        img_np = _comfy_to_np(image)
        img_np_r = _resize_np(img_np, input_size, input_size)

        if class_index < 0:
            class_index = _predict_top_class(model, img_np_r)
            print(f"[SaliencyMap] Auto class: {class_index}")

        call_fn = _make_call_model_fn(model, class_index)
        mask3d = _run_saliency_method(method, call_fn, img_np_r, use_smoothgrad,
                                       smoothgrad_samples, smoothgrad_noise, ig_steps)

        return (self._render(output_mode, mask3d, img_np_r), _np_to_comfy(img_np_r))

    def _render(self, mode, mask3d, original):
        if mode == "heatmap_overlay":
            return _np_to_comfy(_apply_heatmap(_vis_grayscale(mask3d), original))
        elif mode == "grayscale_mask":
            return _np_to_comfy(_vis_grayscale(mask3d))
        elif mode == "diverging_mask":
            return _np_to_comfy(_vis_diverging(mask3d))
        elif mode == "overlay_and_mask":
            gray = _vis_grayscale(mask3d)
            overlay = _apply_heatmap(gray, original)
            gray_rgb = np.stack([gray, gray, gray], axis=-1)
            return _np_to_comfy(np.concatenate([original, overlay, gray_rgb], axis=1))
        raise ValueError(f"Unknown mode: {mode}")


# ══════════════════════════════════════════════════════════════════════════════
# Node 2: Saliency Comparison Grid
# ══════════════════════════════════════════════════════════════════════════════
class SaliencyComparisonNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "image":       ("IMAGE",),
            "model_name":  (SUPPORTED_MODELS, {"default": "vgg16"}),
            "class_index": ("INT", {"default": -1, "min": -1, "max": 999}),
            "ig_steps":    ("INT", {"default": 50, "min": 10, "max": 200}),
            "input_size":  ("INT", {"default": 224, "min": 224, "max": 512}),
        }}

    RETURN_TYPES  = ("IMAGE",)
    RETURN_NAMES  = ("comparison_grid",)
    FUNCTION      = "run_comparison"
    CATEGORY      = "creative-code/explainability"

    def run_comparison(self, image, model_name, class_index, ig_steps, input_size):
        model = _load_model(model_name)
        img_np = _comfy_to_np(image)
        img_np_r = _resize_np(img_np, input_size, input_size)

        if class_index < 0:
            class_index = _predict_top_class(model, img_np_r)

        call_fn = _make_call_model_fn(model, class_index)
        node = SaliencyMapNode()
        results = []

        for method in SaliencyMapNode.METHODS:
            mask3d = _run_saliency_method(method, call_fn, img_np_r,
                                          False, 25, 0.15, ig_steps)
            out = node._render("heatmap_overlay", mask3d, img_np_r)
            results.append(out[0].numpy())

        row1 = np.concatenate(results[0:3], axis=1)
        row2 = np.concatenate(results[3:6], axis=1)
        return (_np_to_comfy(np.concatenate([row1, row2], axis=0)),)


# ══════════════════════════════════════════════════════════════════════════════
# Node 3: Explainable AI — the main art node
# ══════════════════════════════════════════════════════════════════════════════
class ExplainableAIArtNode:

    METHODS = SaliencyMapNode.METHODS

    COLORMAPS = [
        "inferno", "plasma", "magma", "viridis", "hot",
        "cool", "spring", "copper", "twilight", "ocean",
    ]

    COMPOSITIONS = [
        "isolation",   # color only where AI looks, grayscale elsewhere
        "overlay",     # classic heatmap blend
        "spotlight",   # radial fade from salient to dark
        "ghost",       # faded original + bright highlights
        "invert",      # show what the algorithm IGNORES
        "cutout",      # hard binary: only pixels above threshold
        "multiply",    # attention dims non-salient areas
        "screen",      # attention brightens salient areas
        "triptych",    # original | mask | composite side by side
        "mask_only",   # just the colored saliency map
        "pure_white",  # black background, white gradient pixels only
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "image":       ("IMAGE",),
            "model_name":  (SUPPORTED_MODELS, {"default": "vgg16"}),
            "method":      (cls.METHODS, {"default": "Integrated Gradients"}),
            "composition": (cls.COMPOSITIONS, {"default": "isolation"}),
            "colormap":    (cls.COLORMAPS, {"default": "inferno"}),
            "intensity":   ("FLOAT", {"default": 0.75, "min": 0.0, "max": 1.0, "step": 0.05}),
            "contrast":    ("FLOAT", {"default": 1.5, "min": 0.5, "max": 4.0, "step": 0.1}),
            "threshold":   ("FLOAT", {"default": 0.25, "min": 0.0, "max": 0.95, "step": 0.05}),
            "class_index": ("INT", {"default": -1, "min": -1, "max": 999}),
            "input_size":  ("INT", {"default": 224, "min": 224, "max": 512}),
        }, "optional": {
            "use_smoothgrad":     ("BOOLEAN", {"default": True}),
            "smoothgrad_samples": ("INT", {"default": 25, "min": 5, "max": 50}),
        }}

    RETURN_TYPES  = ("IMAGE", "STRING")
    RETURN_NAMES  = ("artwork", "classification_label")
    FUNCTION      = "create_art"
    CATEGORY      = "creative-code/art"

    def create_art(self, image, model_name, method, composition, colormap,
                   intensity, contrast, threshold, class_index, input_size,
                   use_smoothgrad=True, smoothgrad_samples=25):

        model = _load_model(model_name)
        img_np = _comfy_to_np(image)
        img_np_r = _resize_np(img_np, input_size, input_size)

        if class_index < 0:
            class_index = _predict_top_class(model, img_np_r)

        label = _get_imagenet_label(class_index)
        print(f"[ExplainableAI] Visualizing class {class_index}: {label}")

        call_fn = _make_call_model_fn(model, class_index)
        mask3d = _run_saliency_method(method, call_fn, img_np_r,
                                       use_smoothgrad, smoothgrad_samples,
                                       0.15, 50)

        artwork = self._compose(mask3d, img_np_r, composition, colormap,
                                intensity, contrast, threshold)

        caption = f"{label} (class {class_index}) — {model_name} / {method}"
        return (_np_to_comfy(artwork), caption)

    def _compose(self, mask3d, original, composition, colormap,
                 intensity, contrast, threshold):
        gray = _vis_grayscale(mask3d)
        gray = np.clip(np.power(gray, 1.0 / max(contrast, 0.01)), 0, 1)
        heatmap = _apply_colormap(gray, colormap)
        mask = gray[..., None]

        if composition == "overlay":
            return np.clip(original * (1 - intensity) + heatmap * intensity, 0, 1)

        elif composition == "mask_only":
            return heatmap

        elif composition == "isolation":
            gray_img = np.mean(original, axis=-1, keepdims=True).repeat(3, axis=-1)
            return np.clip(
                gray_img * (1 - mask * intensity) + heatmap * mask * intensity, 0, 1
            )

        elif composition == "spotlight":
            darkened = original * (0.15 + 0.85 * mask)
            return np.clip(darkened * (1 - intensity) + heatmap * intensity, 0, 1)

        elif composition == "ghost":
            return np.clip(original * 0.25 + heatmap * intensity, 0, 1)

        elif composition == "invert":
            inv_heatmap = _apply_colormap(1 - gray, colormap)
            return np.clip(original * (1 - intensity) + inv_heatmap * intensity, 0, 1)

        elif composition == "cutout":
            binary = (gray > threshold).astype(np.float32)[..., None]
            return np.clip(original * binary + heatmap * (1 - binary) * 0.08, 0, 1)

        elif composition == "multiply":
            return np.clip(original * (1 - mask * intensity) + heatmap * intensity * 0.3, 0, 1)

        elif composition == "screen":
            return np.clip(1 - (1 - original) * (1 - heatmap * intensity), 0, 1)

        elif composition == "triptych":
            overlay = np.clip(original * (1 - intensity) + heatmap * intensity, 0, 1)
            return np.concatenate([original, heatmap, overlay], axis=1)

        elif composition == "pure_white":
            # Black background, white where the gradient fires
            white = gray[..., None] * np.ones((1, 1, 3), dtype=np.float32)
            return np.clip(white, 0, 1)

        return heatmap


# ── Registration ───────────────────────────────────────────────────────────────
NODE_CLASS_MAPPINGS = {
    "SaliencyMap":        SaliencyMapNode,
    "SaliencyComparison": SaliencyComparisonNode,
    "SaliencyArt":        ExplainableAIArtNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SaliencyMap":        "Saliency Map (PAIR)",
    "SaliencyComparison": "Saliency Comparison Grid (PAIR)",
    "SaliencyArt":        "Explainable AI",
}