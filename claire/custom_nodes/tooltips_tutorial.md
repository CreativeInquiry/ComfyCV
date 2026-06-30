# Adding Tooltips to Your ComfyUI Node

Tooltips are the little hover-text bubbles that pop up when you point at an input, output, or widget on a node. They're one of the easiest ways to make your node feel polished and beginner-friendly, and they're also what powers the help panel (the orange **?** icon) on your node.

This guide assumes you already have a working custom node. If you can see your node in ComfyUI and run it, you're ready.

---

## What tooltips look like

When a user hovers over an input socket, an output socket, or a widget on your node, ComfyUI shows a short description. There are three kinds you can add:

1. **Input / widget tooltips**: explain what each parameter does.
2. **Output tooltips**: explain what each output returns.
3. **A node description**: a one- or two-sentence summary of the whole node.


---

## 1. Input and widget tooltips

Every input in your node is defined inside `INPUT_TYPES`. An input is written as a tuple:

```python
"input_name": ("TYPE", { ...options... })
```

That second part is the options dictionary, where tooltips go. Just add a `"tooltip"` key:

```python
"strength": ("FLOAT", {
    "default": 1.0,
    "min": 0.0,
    "max": 1.0,
    "step": 0.01,
    "tooltip": "How strongly the effect is applied. 0 = no change, 1 = full effect."
}),
```

What if your input has **no** options dictionary, like a plain image input? Add one with just the tooltip:

```python
# Before
"image": ("IMAGE",),

# After
"image": ("IMAGE", {"tooltip": "The image to process."}),
```

> **Watch the comma.** `("IMAGE",)` needs that trailing comma to be a tuple. When you add the options dict it becomes `("IMAGE", {...})` — still two items, still a tuple. Forgetting the comma is the single most common beginner error here.

---

## 2. Output tooltips

Outputs are defined by `RETURN_TYPES`. To describe them, add a matching `OUTPUT_TOOLTIPS` tuple to your class. **The order must line up with `RETURN_TYPES`.**

```python
RETURN_TYPES = ("IMAGE", "MASK")
RETURN_NAMES = ("processed_image", "mask")
OUTPUT_TOOLTIPS = (
    "The processed image, same size as the input.",
    "A black-and-white mask showing which pixels were changed.",
)
```

If you have one output, it's a one-item tuple (remember the trailing comma):

```python
RETURN_TYPES = ("IMAGE",)
OUTPUT_TOOLTIPS = ("The brightened image.",)
```

---

## 3. A description for the whole node

Add a `DESCRIPTION` attribute to your class. This shows up as a summary and feeds the help panel:

```python
DESCRIPTION = "Adjusts image brightness by a strength factor. Useful as a quick exposure tweak before saving."
```

Keep it short — one or two sentences. Save the detail for the individual tooltips.

---

## Full example

Here's a small but complete node with all three kinds of tooltip in place. Notice how the description, input tooltips, and output tooltips work together so a new user never has to guess.

```python
class BrightnessNode:
    DESCRIPTION = "Adjusts image brightness by a strength factor."
    CATEGORY = "examples"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE", {
                    "tooltip": "The image to brighten."
                }),
                "strength": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 3.0,
                    "step": 0.01,
                    "tooltip": "Brightness multiplier. 1.0 keeps the image unchanged."
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    OUTPUT_TOOLTIPS = ("The brightened image.",)

    FUNCTION = "apply"

    def apply(self, image, strength):
        return (image * strength,)
```

---

## Seeing your changes

1. Save the file.
2. Restart ComfyUI (or use the reload/refresh button if your setup supports it).
3. Refresh your browser tab so the frontend picks up the change.
4. Add your node and hover over its inputs, outputs, and widgets.

If nothing appears, check that tooltips aren't switched off: ComfyUI has a setting that can disable hover tooltips globally. It's on by default, but worth knowing if a classmate's setup behaves differently from yours.

---

## How this connects to the help panel (the orange `?`)

Once your node has tooltips and a `DESCRIPTION`, ComfyUI can automatically assemble a **help page** for it — that's the orange question-mark icon you may have seen on other nodes. You don't have to write anything extra; the help panel reuses the tooltips and description you already added. (If you want a richer page with images or video, you can add a markdown doc file too, but tooltips alone are enough to get the icon and a clean, readable panel.)

---

## Quick checklist

- [ ] Every input has a `"tooltip"` in its options dictionary
- [ ] Inputs without options got a `{...}` dictionary added (mind the comma!)
- [ ] `OUTPUT_TOOLTIPS` exists and matches `RETURN_TYPES` order
- [ ] The class has a short `DESCRIPTION`
- [ ] You restarted ComfyUI and refreshed the browser

That's it!