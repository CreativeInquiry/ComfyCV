# Computer Vision in ComfyUI

**Contents:**

* [EasyLabeler](#easylabeler)
* [EasyTrain (YOLO)](#easytrain-yolo)
* [**Additional ComfyUI Workflows for Computer Vision**](#additional-comfyui-workflows-for-computer-vision)
  * [Locate Anything](#locate-anything)
  * [Segment Anything](#segment-anything)
  * [Vision Suite for Humans & Quadrupeds](#vision-suite-for-humans--quadrupeds)
  * [DAAM Concept Activation Heatmaps](#daam-concept-activation-heatmaps)
  * [DINOv3 Image Similarity Heatmaps](#dinov3-image-similarity-heatmaps)


---

## EasyLabeler

[**EasyLabeler**](easylabeler/README.md) is a browser-based utility for annotating videos or image collections with points, bounding boxes, and closed polygonal shapes. It works entirely locally; uses plain HTML, CSS, and JavaScript; and produces JSON annotation files. 

Datasets annotated with EasyLabeler can be used to train custom detectors with [EasyTrain](easytrain-yolo/README.md) (see below). EasyLabeler and EasyTrain can be useful when the thing you wish to detect is not easy to describe in words.

[![easylabeler_screenshot.png](easylabeler/images/easylabeler_screenshot.png)](easylabeler/README.md)


--- 

## EasyTrain (YOLO)

[**`easytrain-yolo`**](easytrain-yolo/README.md) is a command-line tool for custom-training an Ultralytics YOLO computer vision model, in order to recognize and locate objects in images and video. In order to train the detector, [EasyTrain](easytrain-yolo/README.md) consumes annotations created with [EasyLabeler](https://github.com/CreativeInquiry/ComfyCV/tree/main/easylabeler) (see above). EasyTrain [includes a ComfyUI workflow](easytrain-yolo/README.md#6-use-your-model-in-comfyui) that demonstrates the end-to-end use of the comfyui-ultralytics-yolo node with a custom-trained easytrain-yolo model.

[![piles_test_with_yolo_inference.gif](easytrain-yolo/images/piles_test_with_yolo_inference_cropped.gif)](easytrain-yolo/README.md)


---

## Additional ComfyUI Workflows for Computer Vision

In addition to the *Easy* suite of tools and workflows for computer vision, we also offer these self-contained workflows for performing select computer vision tasks in ComfyUI.


### Locate Anything

[A ComfyUI workflow](comfyui_workflows/locate_anything/README.md) for nVidia's *LocateAnything* model, which uses text prompts to perform precise object localization, dense detection, and point-based localization across a wide range of domains.

[![locate_anything_people_droplets_ants.png](comfyui_workflows/locate_anything/images/locate_anything_people_droplets_ants2.png)](comfyui_workflows/locate_anything/README.md)


---

### Segment Anything

This [set of ComfyUI workflows](comfyui_workflows/segment_anything/README.md) demonstrates Meta's *Segment Anything 3.1* model, which produces accurate pixel-level masks for objects specified by natural language text prompts, points, and/or bounding boxes. 

[![sam3_result.jpg](comfyui_workflows/segment_anything/sam3_result.jpg)](comfyui_workflows/segment_anything/README.md)


---

### Vision Suite for Humans & Quadrupeds

[A ComfyUI workflow](comfyui_workflows/human_cv/README.md) that demonstrates the use of a variety of analyses of media containing **people**, including (among others): segmentation of the body from the background; monocular depth estimation; scene segmentation; normal map estimation; and pose estimation of the body, face, and hands. 

[![humancv_results](comfyui_workflows/human_cv/images/humancv_results_wide.jpg)](comfyui_workflows/human_cv/README.md)

[A ComfyUI workflow](comfyui_workflows/quadruped_cv/README.md) that computes similar analyses of media featuring quadruped **animals**:

[![quadrupedcv_results](comfyui_workflows/quadruped_cv/images/quadrupedcv_results_wide.jpg)](comfyui_workflows/quadruped_cv/README.md)


---

### DAAM Concept Activation Heatmaps

[This set of ComfyUI workflows](comfyui_workflows/daam_heatmaps/README.md) provide **heatmaps** that show which parts of an image correspond to specific words in a prompt, as measured by activations in a Stable Diffusion model. This can be even be used for adjectives like "angry" and "bald". 

[![daam_example](comfyui_workflows/daam_heatmaps/images/daam_example.jpg)](comfyui_workflows/daam_heatmaps/README.md)


---

### DINOv3 Image Similarity Heatmaps

[This ComfyUI workflow](comfyui_workflows/dinov3_image_similarity/README.md) provides heatmaps that show which parts of an image are similar to a provided query point.  

[![dinov3_image_similarity_results](comfyui_workflows/dinov3_image_similarity/images/dinov3_image_similarity_results.jpg)](comfyui_workflows/dinov3_image_similarity/README.md)