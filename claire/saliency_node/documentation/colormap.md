# Colormap Examples

Colormaps apply a color gradient to the greyscale saliency values — low saliency gets one end, high saliency gets the other.

> model: vgg16 · method: Guided IG · composition: invert · intensity: 0.75 · contrast: 1.5 · threshold: 0.25 · class_index: -1 · input_size: 224 · use_smoothgrad: true · smoothgrad_samples: 25 · **colormap: varies**

| Colormap | Range | Character |
|----------|-------|-----------|
| **inferno** | Black → purple → orange → yellow | Dramatic, high contrast. The default. |
| **plasma** | Purple → pink → yellow | Vibrant, synthetic, neon |
| **magma** | Black → deep purple → pink-white | Darker and moodier than inferno |
| **viridis** | Purple → teal → yellow-green | Standard scientific colormap, perceptually uniform |
| **hot** | Black → red → orange → white | Classic thermal camera aesthetic |
| **cool** | Cyan → magenta | Cold, clinical |
| **spring** | Magenta → yellow | Neon, synthetic |
| **copper** | Black → brown → copper-gold | Archival, almost daguerreotype-like |
| **twilight** | Purple → white → orange → purple | Smooth, atmospheric (cyclical) |
| **ocean** | Black-blue → cyan → white | Deep, watery |

**cool** ![cool](colormap_demo/cool.png)

**copper** ![copper](colormap_demo/copper.png)

**hot** ![hot](colormap_demo/hot.png)

**inferno** ![inferno](colormap_demo/inferno.png)

**magma** ![magma](colormap_demo/magma.png)

**ocean** ![ocean](colormap_demo/ocean.png)

**plasma** ![plasma](colormap_demo/plasma.png)

**spring** ![spring](colormap_demo/spring.png)

**twilight** ![twilight](colormap_demo/twilight.png)

**viridis** ![viridis](colormap_demo/viridis.png)