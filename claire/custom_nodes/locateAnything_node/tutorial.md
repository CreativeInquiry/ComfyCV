# Fixing ComfyUI-LocateAnything on RunComfy

A step-by-step guide to getting the `ComfyUI-LocateAnything` node working on RunComfy.
The node installs fine but crashes with `NotImplementedError: self._attn_implementation='flash_attention_2'`
because the model's code tries to use `magi` attention, falls back to `flash_attention_2`,
but the forward pass only actually implements `magi` and `sdpa`. The fix is two small edits
to the model's Python source files.

---

## What you need

- A RunComfy account with terminal access
- A GitHub account (for hosting the patched files as Gists)
- A text editor on your local computer

---

## Step 1 — Install the custom node

In ComfyUI Manager, search for **ComfyUI-LocateAnything** (by alisson-anjos) and install it.
Restart ComfyUI after installation.

---

## Step 2 — Download the model weights

Add the **LocateAnythingModelLoader** node to your workflow and set:
- `model_source`: `nvidia/LocateAnything-3B`
- `download_model`: `true`
- `attention`: `sdpa`

Run the workflow once. It will download the model weights (~6GB) to:
```
/workspace/ComfyUI/models/LocateAnything/nvidia--LocateAnything-3B/
```

It will crash — that's expected. The weights are now downloaded.

---

## Step 3 — Download the original source files to your computer

In your browser, download these two files directly:

- `https://huggingface.co/nvidia/LocateAnything-3B/resolve/main/modeling_locateanything.py`
- `https://huggingface.co/nvidia/LocateAnything-3B/resolve/main/modeling_qwen2.py`

---

## Step 4 — Edit the files

Open each file in a text editor and make the following changes.

### Edit 1: `modeling_locateanything.py`

Find this block (around line 116, inside `LocateAnythingForConditionalGeneration.__init__`):

```python
text_attn_impl = (
    getattr(config.text_config, '_attn_implementation', None)
    or getattr(config, '_attn_implementation', None)
    or 'magi'
)
```

Change `'magi'` to `'sdpa'`:

```python
text_attn_impl = (
    getattr(config.text_config, '_attn_implementation', None)
    or getattr(config, '_attn_implementation', None)
    or 'sdpa'
)
```

### Edit 2: `modeling_qwen2.py`

Find this block (inside `Qwen2DecoderLayer.__init__`):

```python
        if config._attn_implementation == 'magi' and not _MAGI_AVAILABLE:
            if is_flash_attn_2_available():
                logger.warning_once(
                    'magi_attention not available, falling back to flash_attention_2'
                )
                config._attn_implementation = 'flash_attention_2'
            else:
                logger.warning_once(
                    'magi_attention not available, falling back to sdpa'
                )
                config._attn_implementation = 'sdpa'
```

Replace the entire block with this (indentation matters — use spaces, not tabs):

```python
        if config._attn_implementation == 'magi' and not _MAGI_AVAILABLE:
            logger.warning_once(
                'magi_attention not available, falling back to sdpa'
            )
            config._attn_implementation = 'sdpa'
```

Save both files.

---

## Step 5 — Upload to GitHub Gists

1. Go to [gist.github.com](https://gist.github.com)
2. Create a **public** gist for `modeling_locateanything.py` — paste the full edited file content
3. After saving, click the **Raw** button and copy that URL
4. Repeat for `modeling_qwen2.py`

Your raw URLs will look like:
```
https://gist.githubusercontent.com/YOUR-USERNAME/GIST-ID/raw/modeling_locateanything.py
https://gist.githubusercontent.com/YOUR-USERNAME/GIST-ID/raw/modeling_qwen2.py
```

---

## Step 6 — Apply the fixes on RunComfy

In the RunComfy terminal, run these commands one at a time:

```bash
wget -O /workspace/ComfyUI/models/LocateAnything/nvidia--LocateAnything-3B/modeling_locateanything.py "YOUR_GIST_RAW_URL_FOR_LOCATEANYTHING"
```

```bash
wget -O /workspace/ComfyUI/models/LocateAnything/nvidia--LocateAnything-3B/modeling_qwen2.py "YOUR_GIST_RAW_URL_FOR_QWEN2"
```

```bash
rm -rf /root/.cache/huggingface/modules/transformers_modules/nvidia_hyphen__hyphen_LocateAnything_hyphen_3B/
```

Verify the downloads worked (files should be much larger than 29 bytes):

```bash
ls -la /workspace/ComfyUI/models/LocateAnything/nvidia--LocateAnything-3B/modeling*
```

Expected output: `modeling_locateanything.py` ~22K, `modeling_qwen2.py` ~77K.

---

## Step 7 — Restart ComfyUI and run

Restart ComfyUI. Run your workflow with:
- `attention`: `sdpa`
- `download_model`: `false` (weights already downloaded)

The model should load and run without errors.

---

## Why this fix works

The `nvidia/LocateAnything-3B` model was built to use NVIDIA's proprietary `magi_attention`
library for fast training. When `magi_attention` isn't installed (which it won't be on a
standard RunComfy instance), the code falls back to `flash_attention_2`. However, the
model's custom `Qwen2Model.forward()` method only implements two attention paths —
`magi` and `sdpa` — so `flash_attention_2` hits a `raise NotImplementedError`.

The fix forces the fallback to `sdpa` (PyTorch's native scaled dot product attention)
instead, which is fully supported and works great on A6000 GPUs.

---

## Notes

- These edits need to be re-applied if the model is re-downloaded from scratch
  (the weights persist but the source files can be overwritten)
- The `rm -rf` cache clear is required after editing the source files, otherwise
  the old cached version continues to be used
- The `wget` approach is necessary on RunComfy because `python3` is not in the
  allowed terminal commands