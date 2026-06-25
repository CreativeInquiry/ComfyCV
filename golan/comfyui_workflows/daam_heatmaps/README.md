# DAAM Heatmaps

![example](images/elephant_result_example.jpg)<br />
Input image and heatmap produced by DAAM for the term `elephant`, showing which pixels were most activated by the SDXL model by that term. 

---

## About DAAM 

[**Diffusion attentive attribution maps**](https://github.com/castorini/daam) (DAAM, by Tang et al.) are a method for interpreting the behavior of Stable Diffusion models. DAAM provides "heat maps" that show exactly which parts of the image correspond to specific words in the prompt. You can use DAAM as a method for analyzing images! But note that what's really going on here is that you're visualizing how a particular Stable Diffusion model is activated by your term of interest. There is a DAAM [GitHub repo](https://github.com/castorini/daam), [paper](https://aclanthology.org/2023.acl-long.310), [Huggingface demo](https://huggingface.co/spaces/tetrisd/Diffusion-Attentive-Attribution-Maps), and [online documentation](https://castorini.github.io/daam/).

DAAM might be useful in identifying: 

* diffuse objects that are not easily segmentable; 
* parts of images that are correlated to abstract concepts

![daam_example.jpg](images/daam_example.jpg)

[**ComfyUI-DAAM**](https://github.com/nisaruj/comfyui-daam/tree/main) is a ComfyUI node that wraps the DAAM algorithm, developed by Nisaruj Rattanaaram. There is a [GitHub repo](https://github.com/nisaruj/comfyui-daam/tree/main) with [documentation](https://github.com/nisaruj/comfyui-daam/tree/main#-daam-nodes) and [sample workflows](https://github.com/nisaruj/comfyui-daam/tree/main/workflows), and it is available on the [Comfy Registry](https://registry.comfy.org/nodes/comfyui-daam) and Custom Node Manager.

---
## Workflows

In this annotated workflow, an image is analyzed by a QwenVL captioner, which automatically produces a set of descriptive tags for the provided image. Those tags then guide a KSampler which has been specially modified to produce DAAM heatmap data. The heatmaps are then decoded and converted into images. The original [input image is here](daam_workflow/original_rgb.png), a [workflow JSON is here](daam_workflow/comfyui_analysis_with_DAAM_heatmaps_workflow.json), and a ["workflow image" is here](daam_workflow/comfyui_analysis_with_DAAM_heatmaps_workflow.png) (i.e. a screenshot with a ComfyUI workflow embedded in its metadata):

![comfyui_analysis_with_DAAM_heatmaps_workflow.png](daam_workflow/comfyui_analysis_with_DAAM_heatmaps_workflow.png)

Below is a simplified version of the above workflow, which is driven by tags that are user-defined, rather than automatically generated. The original [input image is here](daam_workflow/original_rgb.png), a [workflow JSON is here](daam_simple_workflow/comfyui_daam_simple_workflow.json), and a ["workflow image" is here](daam_simple_workflow/comfyui_daam_simple_workflow.png):

![comfyui_daam_simple_workflow.png](daam_simple_workflow/comfyui_daam_simple_workflow.png)

---



