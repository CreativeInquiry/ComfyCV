# p5.comfyui-helper.js

A library for p5.js which adds support for interacting with ComfyUI (or ComfyUI run on RunComfy), using its API. It provides the following features:

* Submit ComfyUI workflows (saved in API format) from p5.js
* Modify various aspects of the workflow from within JavaScript
* Submit images or p5 drawing surfaces as inputs to workflows (e.g. for img2img, ...)
* Easy to use API that supports multiple outputs as well
* Works with promises or callbacks

## Reference

- [Demo](#demo)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Getting started](#getting-started)
- [Examples](examples/)

## Demo

[Demo video](https://drive.google.com/file/d/1PmOk6OqwHU_6oGd50JQBHdjLdV_oLrdt/view?usp=sharing)

## Prerequisites

* RunComfy Machine

## Setup

[Setup video](https://drive.google.com/file/d/16InuWI4nJpyUtFGbS6dUBLVXZadqM_OS/view?usp=drive_link)

* Install _comfyui-tooling-nodes_ (available to install via the ComfyUI Manager, or [manually](https://github.com/Acly/comfyui-tooling-nodes?tab=readme-ov-file#installation))
* Enable _Dev Mode_ in ComfyUI's setting (via the cog icon on the website), for the "Save (API format)" button to show.

![where settings on new runcomfy is located](doc/where_settings_runcomfy.png)
![where dev mode is](doc/where_dev_mode_runcomfy.png)

To make some later steps easier, we will change our ComfyUI to the following:

On RunComfy, we turn on the node numbers via the Lite Graph setting menu and scroll to the Node ID Badge mode and select 'Show All'. See the reference image.
![Node ID badge](doc/where_node_id_badge_runcomfy.png)

![example node](doc/example_node.png)


We can also change the dashboard/setup of the ComfyUI instance by changing the "Use new menu" under Menu in Settings to "Disable".
![change ComfyUI UI](doc/new_runcomfy_change_menu.png)


## Getting started

Include the following line in the `head` section of your HTML:
```
<script src="https://unpkg.com/@gohai/p5.comfyui-helper@^1/libraries/p5.comfyui-helper.js"></script>
```

or, download and use a local copy of the [library file](https://github.com/gohai/p5.comfyui-helper/blob/main/libraries/p5.comfyui-helper.js) like so:

```
<script src="p5.comfyui-helper.js"></script>
```

#### Connecting to the ComfyUI instance

Create a global variable, and set up the `ComfyUiP5Helper` like so. The only argument is the URL you're using to access ComfyUI (with or without a slash at the end).


For every new workflow/RunComfy session, you need to update the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX server-id since this updates every new work session
I would recommend setting your runcomfy session to be slightly longer than you anticipate so that you don't need to reset this url each time and wait for the 5 min load up period you can check that your url is correct, past <comfy_url> into your browser and it should display a ComfyUI instance without any RunComfy UI

```
let comfy;

function setup() {
  # below is an example URL
  # https://www.runcomfy.com/comfyui/89e60215-b0a1-4795-8437-e2743cddc806/servers/837eb0c1-c4f9-412a-befa-3921d368c130
  server_id = "837eb0c1-c4f9-412a-befa-3921d368c130";
  comfy_url = "https://" + server_id + "-comfyui.runcomfy.com";
  console.log("comfy url is " + comfy_url);
  comfy = new ComfyUiP5Helper(comfy_url); 
}
```

#### Loading a workflow

Save the desired workflow in ComfyUI by clicking the "Save (API Format)" button in the tool bar. (If you don't see this button, make sure that _Dev Mode_ is enabled in the settings accessible via the cog icon.)

This creates a JSON file that can be easily added to your p5.js project (e.g. by uploading it in the p5.js Web Editor), and loaded like so:

```
let workflow;

function preload() {
  workflow = loadJSON("workflow_api.json");
  console.log("workflow is", workflow);
}
```
![save api workflow from new runcomfy, look at export API](doc/new_comfyui_api.png)
![save api workflow from old runcomfy, look at Save (API format)](doc/old_comfyui_api.png)

The keys in this object correspond to the _#_ number ComfyUI shows at the top right of each node.

E.g. to change the seed of this KSampler node from within JavaScript, we'd do:

```
workflow[3].inputs.seed = random(999999);
```
##### Notes on loading a workflow:
- There's no correlation between the workflow in the runcomfy session and the workflow loaded here. I believe we are just using the session to load the workflow we've uploaded here. HOWEVER, the assets you call from the p5 workflow must be referencing assets availible on your machine (i.e. models and images must respect the file path system on RunComfy)
- Reminder: you can change certain fields in your workflow (random seed, prompt, etc) from p5.js
- IMPORTANT: this json must be obtained from turning dev mode on and saving the workflow as api format
 
#### Running a workflow

Submitting a workflow to ComfyUI's queue is as easy as calling its `run` method.

You can use this in two ways: either by passing a callback function as the second parameter.

```
comfy.run(workflow, gotImage);
```

This will call a function gotImage once the result are available:

```
function gotImage(results, error) {
  // ...
}
```

Alternatively, you can also use the `await` keyword to wait for the `run` method to eventually return the results:

```
let results = await comfy.run(workflow);
```

You can also add a third (optional) parameter to receive status updates while the workflow is running:

```
comfy.run(workflow, gotImage, gotStatus);

function gotStatus(status){
  console.log(status);
}
```

#### Receiving results

The `results` contains an array of objects, each with a `src` property and a `node` property. Use `src` with `loadImage()` to turn this into an image-type variable to be used for drawing.

```
let img;

function gotImage(results, error) {
  console.log(results);

  if (results.length > 0) {
    img = loadImage(results[0].src);
  }
}
``` 

The `node` property contains the id of the node that created the image.

#### Image inputs

Various types of workflows, such as image-to-image or inpainting, make use of existing images as part of the image generation.

The `image()` method is replacing any "Load Image" node (which loads an image from drive) by an image (or drawing context) variable in p5.js.

E.g.: the following image-to-image workflow has a "Load Image" as #10

```
let srcImg;

function preload() {
  srcImg = loadImage("example.png");
}

// ...
workflow[10] = comfy.image(srcImg);
```

```
let srcImg;

function setup() {
  createCanvas(512, 512);
  srcImg = createGraphics(width, height);
  srcImg.background(0);
  srcImg.fill("yellow");
  srcImg.circle(width/2, height/2, 100);

  // ...
  workflow[10] = comfy.image(srcImg);
}
```

The `mask()` method can be similarly used wherever the workflow contains a "Load Image (as mask)" node.


## Web Templates
COMING SOON
*please duplicate the templates*

#### p5.js
[comfyui-basic on p5.js editor](https://editor.p5js.org/loriechen333/sketches/DM99sXFz6)<br>

[comfyui-img2img on p5.js editor](https://editor.p5js.org/loriechen333/sketches/LmKeEqXun)<br>

WIP [comfyui-inpaint on p5.js editor](https://editor.p5js.org/loriechen333/sketches/)<br>

Note: for the inpainting example, its imperative that you have installed stable diffusion 512-inpainting-ema.safetensors
onto your RunComfy Assests library. After doing so, you'll need to restart then reboot your ComfyUI server.

![inpaint model loading](doc/inpainting_model_loading.png)

#### OpenProcessing 
COMING SOON

### Debugging
If you hit something like the follow (i.e. you see ```value_not_in_list\```), this likely means that you are referencing something on the ComfyUI server that doesn't exist there. In this case, double check that you are sending a asset to the ComfyUI server before you reference it (during ```workflow['10'] = <image_path>)``` etc)

```[Log] [helper] POST – "https://286796ce-c7d8-4278-9b36-8930e87469f8-comfyui.runcomfy.com/prompt" (p5.comfyui-helper.js, line 191)
[Error] Failed to load resource: the server responded with a status of 400 () (prompt, line 0)
[Log] [helper] /prompt status – 400 – "body:" (p5.comfyui-helper.js, line 195)
"{\"error\": {\"type\": \"prompt_outputs_failed_validation\", \"message\": \"Prompt outputs failed validation\", \"details\": \"\", \"extra_info\": {}}, \"node_errors\": {\"14\": {\"errors\": [{\"type\": \"value_not_in_list\", "
[Error] Unhandled Promise Rejection: Error: prompt_outputs_failed_validation: Prompt outputs failed validation ()
	(anonymous function) (p5.comfyui-helper.js:175)
```


#### Credits
Original library created by Gottfried Haider [original repo](https://github.com/gohai/p5.comfyui-helper)

Additional RunComfy changes made by Lorie Chen during her TA-ship for Golan Levin's Creative Coding 60-212 course at CMU.

Up to date for RunComfy's ComfyUI feature as of 09.29.2025