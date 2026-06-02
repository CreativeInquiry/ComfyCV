# Composition Examples

Composition modes control how the saliency map is rendered back onto the original image. This is where the artistic intent lives.

> model: vgg16 · method: Guided IG · colormap: magma · intensity: 0.75 · contrast: 1.5 · threshold: 0.25 · class_index: -1 · input_size: 224 · use_smoothgrad: true · smoothgrad_samples: 25 · **composition: varies**

| Mode | Effect |
|------|--------|
| **isolation** | Salient regions in full colormap color; everything else greyscale. The machine's gaze burns in color while what it ignores fades away. The default — most direct visual commentary on algorithmic attention. |
| **overlay** | Classic heatmap alpha-blend over the original. Familiar and readable, less subversive. |
| **spotlight** | Salient regions bright, everything else darkened dramatically. Feels like a searchlight or surveillance camera — forensic, clinical. |
| **ghost** | Original fades to 25% opacity, saliency map glows over it. Subject becomes spectral, haunted by its own classification. |
| **invert** | Shows what the algorithm *ignores* instead of what it sees. The most subversive mode — visualizes blind spots, the parts of a face invisible to the machine. |
| **cutout** | Hard binary mask. Pixels above threshold show the original; below shows a dim heatmap. The subject literally cut out by the algorithm's attention boundary. |
| **multiply** | Photoshop-style multiply blend. Ignored regions sink into shadow. Dark and moody. |
| **screen** | Photoshop-style screen blend. Salient regions glow brighter. Lighter and more luminous than multiply. |
| **triptych** | Three panels side by side: original · saliency map · composite. Full chain of the visualization in one frame. Gallery-ready. |
| **mask_only** | Just the colored saliency map, no original. Pure algorithmic output, no human context. |
| **pure_white** | Black background, saliency values mapped to white intensity. Like an x-ray or photogram — the raw shape of what the algorithm attended to, stripped of all color and context. |

**cutout** ![cutout](composition_demo/cutout.png)

**ghost** ![ghost](composition_demo/ghost.png)

**invert** ![invert](composition_demo/invert.png)

**isolation** ![isolation](composition_demo/isolation.png)

**mask_only** ![mask_only](composition_demo/mask_only.png)

**multiply** ![multiply](composition_demo/multiply.png)

**overlay** ![overlay](composition_demo/overlay.png)

**pure_white** ![pure_white](composition_demo/pure_white.png)

**screen** ![screen](composition_demo/screen.png)

**triptych** ![triptych](composition_demo/triplych.png)