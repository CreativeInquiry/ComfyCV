# Method Examples

Methods are the mathematical techniques used to ask "what pixels mattered to this model's decision?" Each produces a fundamentally different visual character.

> model: vgg16 · composition: pure_white · colormap: magma · intensity: 0.75 · contrast: 1.5 · threshold: 0.25 · class_index: -1 · input_size: 224 · use_smoothgrad: true · smoothgrad_samples: 25 · **method: varies**

| Method | Approach | Character |
|--------|----------|-----------|
| **Vanilla Gradients** | Derivative of output w.r.t. each pixel | Raw, noisy, chaotic — every pixel with any influence at all, including spurious ones |
| **SmoothGrad** | Vanilla Gradients averaged over many noise-perturbed runs | Smoother and more stable than vanilla, but still texture-rich |
| **Integrated Gradients** | Accumulates gradients along a path from black image → input | Clean, theoretically grounded, highlights semantically meaningful regions. Usually the best starting method. |
| **Blur IG** | Like IG, but interpolates from a blurred image → sharp input | Focused on edges and structural transitions rather than color/texture. More architectural. |
| **Guided IG** | IG with an adaptive path that concentrates steps where gradients are largest | Sharpest, highest-contrast results. Most visually striking for portraits. |
| **XRAI** | Segments image into regions, attributes importance per region rather than per pixel | Patchwork/stained glass aesthetic — very different from gradient methods. Slower. |

---

**Vanilla Gradients** ![vanilla_grad](method_demo/vanilla_grad.png)

**SmoothGrad** ![smooth_grad](method_demo/smooth_grad.png)

**Integrated Gradients** ![integrated_grad](method_demo/integrated_grad.png)

**Blur IG** ![blur_ig](method_demo/blur_ig.png)

**Guided IG** ![guided_ig](method_demo/guided_ig.png)

**XRAI** ![XRAI](method_demo/XRAI.png)