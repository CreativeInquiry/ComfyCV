# EasyVision & ComfyCV

> *A Modular AI Toolkit for Computational Perception in the Arts*

This repository collects a suite of open-source pedagogical tools for
computer vision and computational perception, developed by Prof. [Golan
Levin](https://github.com/golanlevin) and student research assistants
[Claire Vlases](https://github.com/cvlases) and [Lorie
Chen](https://github.com/ylchen333). The project was created during the
Summer 2026 CFA GenAI Toolmaking for the Arts Residency at Carnegie
Mellon University, supported by the College of Fine Arts and the
Frank-Ratchye STUDIO for Creative Inquiry.

Rather than treating AI primarily as a system for image generation,
**EasyVision** and **ComfyCV** use contemporary computer vision models
as instruments for observation, measurement, and analysis. The toolkit
is intended for artists, designers, educators, and students who wish to
build their own workflows for computational perception using open,
modifiable software. For more information, see [About EasyVision & ComfyCV](about.md).

---

## Contents

* [**Overview**](#overview)
* [**EasyVision Software Tools**](#easyvision-software-tools)<br />An end-to-end toolkit for annotation, training, detection, tracking, and export.
  * [EasyLabeler](#easylabeler)
  * [EasyTrain (YOLO)](#easytrain-yolo)
  * [EasyTrack Viewer](#easytrack-viewer)
* [**ComfyCV: ComfyUI Workflows for Computer Vision**](#comfycv-comfyui-workflows-for-computer-vision)<br/>Curated workflows for state-of-the-art computer vision models and techniques.. 
  * [Locate Anything](#locate-anything)
  * [Segment Anything](#segment-anything)
  * [Segment Anything to Contours](#segment-anything-to-contours)
  * [Vision Suite for Humans & Quadrupeds](#vision-suite-for-humans--quadrupeds)
  * [DAAM Concept Activation Heatmaps](#daam-concept-activation-heatmaps)
  * [DINOv3 Image Similarity Heatmaps](#dinov3-image-similarity-heatmaps)


---

## Overview

[**EasyVision**](#easyvision-software-tools) and [**ComfyCV**](#comfycv-comfyui-workflows-for-computer-vision) provide an end-to-end workflow for building
custom computer vision systems without requiring extensive
machine-learning infrastructure. Together, the tools support a complete
pipeline:

-   [**EasyLabeler**](#easylabeler) — annotate images and video with points, boxes,
    and polygons.
-   [**EasyTrain**](#easytrain-yolo) — train custom YOLO detectors from EasyLabeler
    annotations.
-   **EasyDetect** — detect objects using custom YOLO models or
    foundation models such as LocateAnything and Segment Anything.
-   **EasyTrack** — convert detections into a unified `TRACKS`
    representation, enrich them with temporal tracking, and export the
    results for creative software.

Alongside this pipeline, [**ComfyCV**](#comfycv-comfyui-workflows-for-computer-vision) provides a curated collection of
documented ComfyUI workflows demonstrating state-of-the-art computer
vision techniques including open-vocabulary detection, segmentation,
contour extraction, pose estimation, monocular depth estimation,
semantic saliency, concept activation heatmaps, and image similarity
analysis.

A central design goal is interoperability. Rather than presenting
isolated demonstrations of individual AI models, the toolkit emphasizes
reusable workflows, common data formats, and modular components that
students can inspect, modify, and recombine into systems of their own
design.

### Educational Context

This project was developed to support [**Experimental Capture**](https://github.com/golanlevin/ExperimentalCapture), an
interdisciplinary studio course at Carnegie Mellon University in which
students create systems for sensing and representing phenomena beyond
ordinary human perception. A recurring assignment in the course,
[**Typology Machine**](https://courses.ideate.cmu.edu/60-461/f2024/deliverables/typology-machine/index.html), asks students to build computational systems that
collect, regularize, analyze, and compare observations in order to
investigate a research question.

The toolkit treats AI as a framework for **computational perception**,
not simply image generation. Students use these tools to build workflows
that detect, segment, track, measure, classify, and visualize the world,
turning contemporary computer vision research into practical instruments
for artistic inquiry. By packaging research-grade models into
approachable, well-documented ComfyUI workflows, EasyVision and ComfyCV
substantially reduce the software engineering overhead traditionally
required to use these techniques in the classroom. 

For more information, please see [About EasyVision & ComfyCV](about.md).

### Use / Installation Requirements

Most projects in this repository assume familiarity with a small
collection of open-source tools:

-   **ComfyUI.** Workflows are primarily developed and tested for the
    [RunComfy.com](https://www.runcomfy.com/) cloud platform, though many can be adapted to local ComfyUI installations.
-   **Python 3.10+.** Several utilities are local command-line
    applications. A dedicated Python virtual environment (`venv`) is
    strongly recommended.
-   **ffmpeg.** Many workflows assume the ability to batch-process,
    resize, crop, or transcode image and video media.
-   **Terminal.** Basic familiarity with the macOS (or Linux) command
    line is helpful for installation, model management, and
    troubleshooting.

Where additional dependencies, custom nodes, or model downloads are
required, detailed installation instructions are provided in the
documentation for each individual tool.

---

## EasyVision Software Tools

**EasyVision** is a collection of interoperable software tools for computational perception. Together, they support the complete lifecycle of a custom computer vision project: annotating media, training detectors, detecting and tracking phenomena, and exporting structured observations for visualization, creative coding, animation, and further analysis.

Unlike many computer vision libraries, EasyVision is designed for artists, designers, and educators. It combines lightweight browser applications, local Python utilities, and ComfyUI workflows into a coherent pipeline, allowing students to construct custom vision systems without needing to build machine learning infrastructure from scratch.

The principal components are:

* **EasyLabeler** — a browser-based tool for annotating images and video with points, bounding boxes, and polygons.
* **EasyTrain** — a local Python utility that trains custom YOLO detectors from EasyLabeler annotations.
* **EasyDetect** *(in development)* — a family of ComfyUI workflows for detecting phenomena using custom-trained YOLO models together with foundation models such as *LocateAnything* and *Segment Anything*.
* **EasyTrack** *(in development)* — a collection of ComfyUI workflows and custom nodes that transform detections into a unified `TRACKS` representation, optionally enrich them with dense temporal tracking, and export the results for downstream creative tools such as p5.js, Blender, Maya, and After Effects.


---

### EasyLabeler

[**EasyLabeler**](easylabeler/README.md) is a browser-based utility for annotating videos or image collections with points, bounding boxes, and closed polygonal shapes. It works entirely locally; uses plain HTML, CSS, and JavaScript; and produces JSON annotation files. 

Datasets annotated with EasyLabeler can be used to train custom detectors with [EasyTrain](easytrain-yolo/README.md) (see below). EasyLabeler and EasyTrain can be useful when the thing you wish to detect is not easy to describe in words.

[![easylabeler_screenshot.png](easylabeler/images/easylabeler_screenshot.png)](easylabeler/README.md)


--- 

### EasyTrain (YOLO)

[**`easytrain-yolo`**](easytrain-yolo/README.md) is a command-line tool for custom-training an Ultralytics YOLO computer vision model, in order to recognize and locate objects in images and video. In order to train the detector, [EasyTrain](easytrain-yolo/README.md) consumes annotations created with [EasyLabeler](https://github.com/CreativeInquiry/ComfyCV/tree/main/easylabeler) (see above). EasyTrain [includes a ComfyUI workflow](easytrain-yolo/README.md#6-use-your-model-in-comfyui) that demonstrates the end-to-end use of the `comfyui-ultralytics-yolo` node with a custom-trained model.

[![piles_test_with_yolo_inference.gif](easytrain-yolo/images/piles_test_with_yolo_inference_cropped.gif)](easytrain-yolo/README.md)

[![easytrain-yolo_inference_workflow_for_runcomfy.png](easytrain-yolo/comfy_workflows/easytrain-yolo_inference_workflow_for_runcomfy.png)](easytrain-yolo/README.md#6-use-your-model-in-comfyui)

---

### EasyTrack Viewer

[![images/easytrack_p5.gif](easytrack_viewer/images/easytrack_p5.gif)](easytrack_viewer/README.md) 

[**EasyTrack Viewer**](easytrack_viewer/README.md) is a browser-based tool for previewing the JSON files produced by other EasyTracking apps (such as [Segment Anything to Contours](#segment-anything-to-contours), below). Additionally, it can convert these JSON data into numerous other formats, such as CSV, SVG, GIF, and specialized animation formats for use with AfterEffects, Blender, and Maya.


---

## ComfyCV: ComfyUI Workflows for Computer Vision

In addition to the *EasyVision* suite of tools and workflows, we also provide a collection of self-contained ComfyUI workflows for contemporary computer vision.

Although ComfyUI is best known as a platform for generative AI, we use it here as a **computer vision workbench**: a modular environment for assembling workflows that detect, segment, track, measure, and analyze visual phenomena. Rather than generating images, these workflows transform images and video into new forms of information—bounding boxes, masks, contours, poses, depth maps, motion tracks, heatmaps, and other computational representations that can be visualized, measured, or incorporated into downstream creative tools.


### Locate Anything

[A ComfyUI workflow](comfyui_workflows/locate_anything/README.md) for nVidia's powerful *LocateAnything* model, which uses text prompts to perform precise object localization, dense detection, and point-based localization across a wide range of domains.

[![locate_anything_people_droplets_ants.png](comfyui_workflows/locate_anything/images/locate_anything_people_droplets_ants2.png)](comfyui_workflows/locate_anything/README.md)

![locate_anything_basic_workflowimg.png](comfyui_workflows/locate_anything/workflows/locate_anything_basic_workflowimg.png)

---

### Segment Anything

This [set of ComfyUI workflows](comfyui_workflows/segment_anything/README.md) demonstrates Meta's *Segment Anything 3.1* model, which produces accurate pixel-level masks for objects specified by natural language text prompts, points, and/or bounding boxes. Workflows are provided for images, video, and image batches.

[![sam3_result.jpg](comfyui_workflows/segment_anything/sam3_result.jpg)](comfyui_workflows/segment_anything/README.md)

![sam3.1_image_workflowimg.png](comfyui_workflows/segment_anything/workflows/sam3.1_image_workflow/sam3.1_image_workflowimg.png)


---

### Segment Anything to Contours

This [ComfyUI workflow](comfyui_workflows/segment_anything_to_contours/README.md) extends Segment Anything with custom nodes that allow you to export sequences of vector-based contours of tracked objects. These sequences may than be viewed and transcoded using [EasyTrack Viewer](#easytrack-viewer) (see above). 

![bee_video_and_contours.gif](comfyui_workflows/segment_anything_to_contours/images/bee_video_and_contours.gif)

![sam3_with_tracks_export_workflowimg.png](comfyui_workflows/segment_anything_to_contours/workflow/sam3_with_tracks_export_workflowimg.png)


---

### Vision Suite for Humans & Quadrupeds

[A ComfyUI workflow](comfyui_workflows/human_cv/README.md) that demonstrates the use of a variety of analyses of media containing **people**, including (among others): segmentation of the body from the background; monocular depth estimation; scene segmentation; normal map estimation; and pose estimation of the body, face, and hands. 

[![humancv_results](comfyui_workflows/human_cv/images/humancv_results_wide.jpg)](comfyui_workflows/human_cv/README.md)

![humancv_workflow_runcomfy_horiz.png](comfyui_workflows/human_cv/humancv_workflow_runcomfy_horiz.png)

[A related ComfyUI workflow](comfyui_workflows/quadruped_cv/README.md) computes similar analyses of media featuring quadruped **animals**:

[![quadrupedcv_results](comfyui_workflows/quadruped_cv/images/quadrupedcv_results_wide.jpg)](comfyui_workflows/quadruped_cv/README.md)


---

### DAAM Concept Activation Heatmaps

[This set of ComfyUI workflows](comfyui_workflows/daam_heatmaps/README.md) provide heatmaps that show which parts of an image correspond to specific words in a prompt, as measured by activations in a Stable Diffusion model. This can be even be used for adjectives like "angry" and "bald". 

[![daam_example](comfyui_workflows/daam_heatmaps/images/daam_example.jpg)](comfyui_workflows/daam_heatmaps/README.md)

![comfyui_daam_simple_workflow.png](comfyui_workflows/daam_heatmaps/daam_simple_workflow/comfyui_daam_simple_workflow.png)

---

### DINOv3 Image Similarity Heatmaps

[This ComfyUI workflow](comfyui_workflows/dinov3_image_similarity/README.md) provides heatmaps that show which parts of an image are similar to a provided query point.  

[![dinov3_image_similarity_results](comfyui_workflows/dinov3_image_similarity/images/dinov3_image_similarity_results.jpg)](comfyui_workflows/dinov3_image_similarity/README.md)

![dinov3_image_similarity_workflowimg.png](comfyui_workflows/dinov3_image_similarity/dinov3_image_similarity_workflowimg.png)