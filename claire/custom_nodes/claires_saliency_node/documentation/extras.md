# Other Parameters

> model: vgg16 · method: Guided IG · composition: invert · colormap: magma · **parameter: varies** · all others at default

| Parameter | Default | Effect |
|-----------|---------|--------|
| **intensity** | 0.75 | How strongly the saliency map blends onto the original. 0 = invisible, 1 = full replacement. |
| **contrast** | 1.5 | Power function applied to saliency values. Above 1.0 makes top regions pop and low regions fade. 2.5–3.0 is extreme — only the very highest attention survives. |
| **threshold** | 0.25 | Minimum saliency value to count as "attended to." Used mainly by `isolation` and `cutout`. Higher = sparser, more selective output. |
| **class_index** | -1 (auto) | Which ImageNet class to visualize attention for. -1 auto-detects the model's top prediction. Overriding forces the model to answer a different question — e.g. class 207 (golden retriever) on a human portrait shows attention for a question it was never meant to answer. |
| **input_size** | 224 | Models require fixed-size square inputs. 224×224 is standard; InceptionV3 requires 299. Not adjusted here — most models require 224 to run correctly. |
| **use_smoothgrad** | true | Adds SmoothGrad noise-averaging on top of any method. Produces smoother, more aesthetically stable results at the cost of speed. |
| **smoothgrad_samples** | 25 | How many noisy passes to average when SmoothGrad is active. 25 balances smoothness and speed; 50+ is noticeably smoother but proportionally slower. |

---

### Intensity

Default **0.75** — chosen as the point where the saliency map clearly dominates while still leaving enough of the original image readable as context.

**0.5** (lower) ![intensity_0.5](extras_demo/intensity_0.5.png)

**1.0** (full) ![intensity_1.0](extras_demo/intensity_1.0.png)

---

### Contrast

Default **1.5** — adds drama without becoming so aggressive that only a handful of pixels survive. Values above 2.0 start to feel like thresholding.

**1.0** (flat, no adjustment) ![contrast_1.0](extras_demo/contrast_1.0.png)

**2.0** (more aggressive) ![contrast_2.0](extras_demo/contrast_2.0.png)

---

### Threshold

Default **0.25** — eliminates low-confidence gradient noise while preserving the meaningful attended region. At 0.0 everything is included; at 0.5 only the top quarter of saliency values show.

**0.0** (nothing filtered) ![threshold_0](extras_demo/threshold_0.png)

**0.5** (aggressive filtering) ![threshold_0.5](extras_demo/threshold_0.5.png)

---

### Class Index

Default **-1 (auto)** — visualizes attention for whatever the model actually predicted. Overriding this forces the model to attend to features of a class it wasn't trying to find, producing maps that can feel alien or misaligned — attention patterns searching for something that isn't there.

**class 1** (slight displacement) ![class_index_1](extras_demo/class_index_1.png)

**class 10** (larger displacement) ![class_index_10](extras_demo/class_index_10.png)

---

### Input Size

Default **224** — not demonstrated here because most models require this exact size to run correctly. InceptionV3 is the only exception, requiring 299.

---

### Use SmoothGrad

Default **true** — the smoothing improvement is significant and 25 samples is fast enough that the tradeoff is worth it for almost all use cases.

**false** (raw gradients, no smoothing) ![smooth_grad_false](extras_demo/smooth_grad_false.png)

---

### Smoothgrad Samples

Default **25** — a reliable balance. Below 10 starts to look patchy; above 50 the improvement becomes marginal relative to the time cost.

**50 samples** ![samples_50](extras_demo/samples_50.png)