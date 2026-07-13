# ComfyUI Vision Suite for Humans

![example](images/humancv_results.jpg)<br />Work products from a custom ComfyUI workflow, a "vision suite for humans". It produces the following data streams, among others (clockwise from top left): 

1. [Original image](3_people_walking_720x1280_1_4.jpg)
2. Extracted people
3. People masks
4. Depth estimation
5. Normal estimation
6. Inpainted background
7. Subject bounding boxes and labels
8. Automatic image segmentation 
9. Body, face, and hand pose estimation
10. Face subpart masks

---

## Workflows

*There are minor differences in the nodes supported by cloud.comfy.org versus RunComfy.com.*

<table>
<tr>
<td valign="top"><a href="humancv_workflow_comfycloud.json">Workflow for cloud.comfy.org</a><br/><img src="humancv_workflow_comfycloud.png"></td>
<td valign="top"><a href="humancv_workflow_runcomfy.json">Workflow for runcomfy.com</a><br/><img src="humancv_workflow_runcomfy.png"></td>
</tr>
</table>