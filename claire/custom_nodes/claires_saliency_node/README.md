# Running the Explainable AI Node

I created a custom node for [ComfyUI](https://github.com/comfyanonymous/ComfyUI), a local node-based interface for building AI pipelines. The node lets you point a pretrained image classifier at a photo and visualize what it's actually paying attention to when it makes a decision.

*CHECK OUT THE SALIENCY NODE DOCUMENTATION FILE IN THE DOCUMENTATION FOLDER FOR THE ACTUAL INFO!!!*
---

## What is ComfyUI?

ComfyUI is a visual programming environment for AI that runs entirely on your own machine. You build workflows by connecting nodes into a flow.

Per Golan's suggestion, I used it for this project because it let me treat saliency visualization as another step in a pipeline, something I could experiment with in real time, swap parameters and compare, and chain with other nodes. It's a bit of a learning curve at first but once it clicks, you can basically do anything you want.

---

## Running ComfyUI Locally

One challenge I had with the development of this tool was figuring out how to make my own nodes, which isn't very common suince there are already so many different nodes available for use. Rather than using the browser version RunComfy, I found it easiest to go full dev mode, running ComfyUI locally.

### What you need

- Python 3.10+ (I used **Python 3.13.5** via Anaconda)
- A conda environment keeps things clean and is strongly recommended
- Mac, Windows, or Linux — I ran this on a MacBook Pro M-series :) 

### Setup
```bash
# Clone ComfyUI
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI

# Create a conda environment
conda create -n comfyenv python=3.13
conda activate comfyenv

# Install dependencies
pip install -r requirements.txt

# Run it
python main.py
```

Open `http://127.0.0.1:8188` in your browser and you'll see the node canvas. That's it.

---

## Installing the Node

### 1. Install the extra Python packages

With your ComfyUI environment active:
```bash
pip install saliency matplotlib torchvision
```

### 2. Drop the files in

Copy the `creative_code/` folder into ComfyUI's custom nodes directory:
```
ComfyUI/
└── custom_nodes/
    └── creative_code/
        ├── __init__.py
        └── saliency_nodes.py
```

### 3. Restart ComfyUI
```bash
python main.py
```

If it worked, you'll see this in the startup log:
```
0.0 seconds: /path/to/ComfyUI/custom_nodes/creative_code
```

The nodes show up in the node menu under **creative-code/art** and **creative-code/explainability**.

---

## Basic Workflow

The simplest setup is three nodes:
```
[Load Image] → [ExplainableAI] → [Preview Image]
```

1. Right-click the canvas → Add Node → image → **Load Image**
2. Right-click → Add Node → creative-code/art → **ExplainableAI**
3. Right-click → Add Node → image → **Preview Image**
4. Wire them: Load Image `IMAGE` → ExplainableAI `image` → Preview Image `images`
5. Upload a photo, hit **Queue Prompt**

The first run will download the model weights automatically (~500MB for VGG16) and cache them. Every run after that is instant.

You can also wire the `classification_label` output to a **Show Text** node — it'll tell you what class the model predicted and which one is being visualized.

---

## How I Built the Node

ComfyUI custom nodes are Python classes where you define your inputs, outputs, and a function that runs when the pipeline executes. Straightforward in theory.

The structure looks like this:
```python
class MyNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "image": ("IMAGE",),
            "my_param": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0}),
        }}

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("output",)
    FUNCTION = "run"
    CATEGORY = "my-category"

    def run(self, image, my_param):
        return (processed_image,)

NODE_CLASS_MAPPINGS = {"MyNode": MyNode}
NODE_DISPLAY_NAME_MAPPINGS = {"MyNode": "My Node"}
```

ComfyUI reads `NODE_CLASS_MAPPINGS` at startup and registers each class. The `INPUT_TYPES` dict builds the UI automatically — dropdowns, sliders, toggles, all from the type declarations.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `saliency` | Google PAIR saliency methods |
| `torchvision` | Pretrained ImageNet models |
| `matplotlib` | Colormaps |
| `torch` | Comes with ComfyUI |
| `numpy` | Comes with ComfyUI |

## Resources

- [ComfyUI JS Extension Documentation](https://docs.comfy.org/custom-nodes/js/javascript_overview) - Official documentation for ComfyUI JavaScript Extensions
- [ComfyUI Registry Documentation](https://docs.comfy.org/registry/publishing) - Learn how to publish your extension
- [ComfyUI Frontend Repository](https://github.com/cvlases/ComfyUI-Frontend) - The main ComfyUI frontend codebase
- [Official ComfyUI Frontend Types](https://www.npmjs.com/package/@comfyorg/comfyui-frontend-types) - TypeScript definitions for ComfyUI
- [Claude Code](https://code.claude.com/docs/en/overview) - Claude helped me with this, especially the debugging!
- [Saliency Tutorial](https://github.com/PAIR-code/saliency/blob/master/Examples_pytorch.ipynb) - This tutorial is where I got the inspiration (and some of the code) from.



## License

MIT license
