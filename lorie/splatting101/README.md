# 3D Gaussian Splatting for Creative Workflows

This guide explains 3D Gaussian Splatting, often shortened to 3DGS, for people with a creative background. You do not need to be a computer graphics researcher to use it. The goal is to help you decide when 3DGS is useful, what kind of material it needs, what can go wrong, and how it might fit into a creative pipeline.

3DGS is especially interesting when you want to capture the feeling of a real place, object, installation, set, performance space, or material surface and move through it later in 3D. It sits somewhere between photography, video, photogrammetry, game assets, and volumetric capture.

## Quick Summary

Use 3DGS when you want:

- A realistic 3D capture of a real object, room, set, or environment.
- The look of real-world lighting, reflections, texture, and atmosphere.
- A scene that can be viewed from new camera angles after capture.
- A faster alternative to NeRF-style capture and rendering.
- A web, installation, game-engine, or video pipeline where visual fidelity matters more than physically perfect geometry.

Be careful with 3DGS when you need:

- Clean, editable mesh geometry.
- Accurate measurements.
- Collision, physics, rigging, or fabrication-ready 3D models.
- Fully controllable lighting after capture.
- Objects that must be seen from angles you did not photograph.

3DGS is best understood as a viewable 3D photograph, not as a traditional 3D model.

## What Is 3DGS?

3D Gaussian Splatting was introduced in a 2023 research paper by Inria: [3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/).

Before 3DGS, many people used Neural Radiance Fields, or NeRFs, to reconstruct realistic 3D scenes from photos or video. NeRFs showed that a computer could learn how a scene looks from many viewpoints, but they often required long training times and expensive rendering. 3DGS was developed as a faster approach that can still produce highly realistic results.

Instead of building a scene from polygons, like a normal 3D model, 3DGS represents a scene as many small soft blobs in 3D space. Each blob has a position, size, rotation, color, opacity, and view-dependent appearance. These blobs are called Gaussians. When thousands, hundreds of thousands, or millions of them are rendered together, they can recreate the appearance of the captured scene.

An easy way to imagine it:

- A mesh is like a sculpture made from connected surfaces.
- A point cloud is like a cloud of dots.
- A 3D Gaussian splat is like a cloud of soft, colored, semi-transparent brush marks floating in space.

The result can look extremely photographic from the right viewpoints, even though the underlying structure is not a clean object model. It can also have a painterly effect.

## What Is a Radiance Field?

A radiance field is a way of describing how light appears in a 3D space. It does not only ask, "What object is here?" It asks, "If I stand here and look in this direction, what color and brightness should I see?"

This matters because real scenes contain effects that are hard for traditional 3D scans to capture:

- Reflections
- Highlights
- Soft transparency
- View-dependent shine
- Subtle lighting gradients
- Fine texture
- Atmospheric or photographic qualities

Radiance field methods, including NeRFs and 3DGS, are useful because they can preserve some of those visual qualities from photographs.

## What You Need

There are two broad ways to make a splat: an easy app-based workflow or a more controlled custom workflow.

### Fast and Accessible

This is the best starting point for most creative tests.

- A phone with a decent camera
- A 3DGS capture app or cloud service
- Good lighting
- A subject you can walk around
- Patience while learning how capture quality affects the result

This approach is good for sketches, prototypes, student projects, quick scans, web experiments, and early creative direction.

### Slower and More Controlled

This is better when the splat will be part of a polished piece, exhibition, film asset, game environment, or client-facing project.

- A DSLR or mirrorless camera
- A nice drone
- Manual exposure controls
- RAW photo capture if possible
- A RAW-to-JPEG workflow, such as Lightroom, Capture One, darktable, or custom scripts
- A computer with a strong GPU
- Local training software or a paid desktop tool
- Time for testing, cleanup, and re-capture

The controlled workflow is slower, but it gives you more control over exposure, sharpness, color, and coverage.

See the [3D capture flowchart](./imgs_pdfs/3D_capture_flowchart.pdf) for a broader comparison between 3DGS and other capture methods.

## When to Use 3DGS

3DGS is a strong choice when the final work depends on visual impression more than editable geometry.

Good use cases include:

- Capturing a room, studio, gallery, stage, set, or outdoor location.
- Creating a navigable memory of a place.
- Turning a real installation into a web or XR experience.
- Creating cinematic camera moves through a captured scene.
- Archiving temporary work, such as exhibitions, performances, pop-ups, or site-specific pieces.
- Capturing objects with complex surface appearance.
- Building reference material for later modeling, painting, animation, or compositing.
- Creating hybrid works that mix real capture with generative imagery, animation, sound, or interaction.

3DGS is especially useful for surfaces that are difficult for normal photogrammetry:

- Glass
- Mirrors
- Shiny metal
- Still water
- Polished ceramics
- Glossy plastic
- Soft, irregular, or highly detailed textures

Traditional photogrammetry often struggles with those because it wants stable surface features. 3DGS is more appearance-based, so it can sometimes preserve the look even when the geometry is imperfect.

## When Not to Use 3DGS

Do not use 3DGS as your primary method if your project depends on clean geometry.

Avoid 3DGS, or treat it only as reference, if you need:

- A model for 3D printing, CNC, or fabrication.
- Accurate dimensions.
- A clean mesh for sculpting or retopology.
- A riggable character or prop.
- Physics, collision, or gameplay surfaces.
- Architectural measurement.
- Product visualization where the object must be perfectly shaped.
- A model that can be re-lit from scratch like a normal 3D scene.

You can sometimes extract a mesh from a splat, but the results vary. If clean geometry is the goal, use photogrammetry, LiDAR, structured light, laser scanning, manual modeling, or a hybrid workflow.

## Choosing a Capture Method

Choose based on what you care about most.

### Phone App

Best for:

- Fast experiments
- Personal scans
- Prototypes
- Class demos
- Social or web sharing

Tradeoffs:

- Less control over image quality
- Cloud processing may limit export formats
- Results can vary widely
- Harder to fix a bad capture afterward

### DSLR or Mirrorless Camera

Best for:

- High-quality captures
- Controlled lighting
- Archival projects
- Polished creative work
- Scenes with difficult exposure or detail

Tradeoffs:

- More setup time
- More files to manage
- Requires training software or a service
- Requires more technical comfort

### Video Capture

Best for:

- Quick environment capture
- Moving around a scene continuously
- Fast documentation

Tradeoffs:

- Video frames are often blurrier than still photos
- Compression can reduce detail
- Motion blur creates artifacts
- You may need to extract frames before training

### LiDAR or Depth-Assisted Capture

Best for:

- Better spatial alignment
- Larger spaces
- Rough geometry support

Tradeoffs:

- LiDAR is usually lower visual resolution than photos
- It does not automatically solve reflective or transparent surfaces
- The final look still depends heavily on image quality

## Capture Principles

The quality of a splat is decided before training starts. Bad source material usually creates a bad splat.

### Light

Use consistent lighting. Avoid lighting that changes during capture, such as moving sunlight, flickering screens, flashing LEDs, or people casting shadows across the scene.

Good lighting is:

- Even enough that details are visible.
- Stable from the beginning to the end of the capture.
- Not so dark that the camera creates noise.
- Not so bright that highlights are blown out.

You usually want to lock exposure and white balance if your camera or app allows it. Auto-exposure can make images inconsistent, which makes reconstruction harder.

### Sharpness

Sharp source images matter. Avoid:

- Motion blur
- Heavy camera shake
- Shallow depth of field
- Out-of-focus foregrounds
- Fast movement

For camera capture, use a smaller aperture when possible so more of the scene is in focus. For phone capture, move slowly and give the camera time to focus.

### Overlap

Each photo should overlap significantly with the previous and next photo. The software needs to understand how images connect.

A good habit:

- Move in small steps.
- Keep the subject visible across many images.
- Capture from multiple heights.
- Circle the subject or move through the room in a steady path.
- Add extra photos around complicated details.

If you only photograph the front of an object, the splat will not magically know what the back looks like.

### Coverage

Think like you are giving the computer enough memories to reconstruct a place.

For an object:

- Capture a full circle around it.
- Add a higher ring looking down.
- Add a lower ring looking up.
- Include close-ups of important details.

For a room:

- Walk the perimeter.
- Capture corners carefully.
- Look up and down.
- Capture entrances, occluded areas, and furniture from multiple angles.

For a large environment:

- Break it into zones.
- Keep visual continuity between zones.
- Avoid long jumps between viewpoints.

### Surface Detail

The software needs visual features to align images. Feature-rich surfaces are easier than blank surfaces.

Easy surfaces:

- Brick
- Wood grain
- Fabric
- Posters
- Bookshelves
- Patterned floors
- Natural textures

Difficult surfaces:

- Plain white walls
- Glossy blank plastic
- Transparent glass
- Mirrors
- Repeating patterns
- Moving foliage
- Water

For blank spaces, adding temporary visual markers can help. Remove them only if the final result requires it, and understand that removing them may make alignment harder.

## Common Artifacts

3DGS artifacts are often visually strange but predictable once you know what causes them.

### Floaters

Floaters are stray blobs that appear suspended in space. They often come from blur, reflections, moving objects, poor alignment, or missing viewpoints.

Ways to reduce them:

- Capture sharper images.
- Add more viewpoints.
- Avoid moving people or objects.
- Use better lighting.
- Clean up the splat in an editor when possible.

### Popping

Popping happens when parts of the splat flicker, shift, or appear and disappear as the camera moves. It usually means the training process had uncertain information.

Ways to reduce it:

- Improve image overlap.
- Capture from more angles.
- Avoid inconsistent exposure.
- Avoid shiny surfaces that dominate the scene.

### Holes

Holes appear where the software did not have enough information.

Common causes:

- Missing camera angles
- Occluded areas
- Thin structures
- Dark corners
- Overexposed highlights

### Smearing

Smearing can happen when the software stretches visual information across space.

Common causes:

- Fast camera movement
- Low-detail surfaces
- Motion blur
- Objects moving during capture

### Ghosting

Ghosting appears when something moved during capture, such as a person, car, curtain, tree branch, or shadow.

The simplest fix is to keep the scene still.

## Training: What Happens After Capture

Training is the process that turns photos or video frames into a splat.

Most workflows follow this general pattern:

1. Gather images or video frames.
2. Estimate where each camera was when each image was taken.
3. Build a rough point cloud.
4. Place many Gaussians into the scene.
5. Adjust the Gaussians until rendered views match the source images.
6. Export the final splat.

The camera-position step is often done with Structure from Motion, or SfM. A common open-source tool for this is [COLMAP](https://colmap.github.io/tutorial.html). You do not need to understand all of COLMAP to use app-based 3DGS, but it helps to know that the software is trying to match visual features across photos.

If the software cannot understand where the cameras were, training will fail or produce a distorted result.

## File Formats

Different tools use different formats. The format you choose depends on where the splat will be displayed.

### PLY

`.PLY` is one of the most common base formats for Gaussian splats. Many services can import or export it. It is often the safest format for archiving because it preserves the core splat data.

Use PLY when:

- You want a general-purpose export.
- You are moving between tools.
- You want to keep a high-quality source version.

### SPZ

`.SPZ` is a compressed format introduced by Niantic. It is useful for apps, mobile use, and distribution where file size matters.

Use SPZ when:

- You need smaller files.
- You are targeting app or mobile workflows.
- Your viewer supports it.

### SOG

`.SOG` is a compressed format introduced by PlayCanvas for web use.

Use SOG when:

- You are building for the browser.
- Load time matters.
- Your web viewer supports it.

### What Is Inside a Splat File?

You will often see per-point or per-Gaussian values such as:

- Position: `x`, `y`, `z`
- Scale: how large the Gaussian is in each direction
- Rotation: which way the Gaussian is oriented
- Opacity: how transparent or solid it appears
- Color: base red, green, and blue values
- Spherical harmonics: extra values that describe how the color changes from different viewing angles

You do not need to edit these values by hand for most creative workflows. They matter because they explain why a splat is not just a mesh or a point cloud.

## Spherical Harmonics, Plainly

Spherical harmonics are a compact way to store view-dependent appearance.

In a normal photo, a shiny object may look different when you move your head. A highlight can slide across the surface. In 3DGS, spherical harmonics help each Gaussian change color depending on the viewing direction. This is one reason splats can preserve reflective or glossy appearances better than many traditional scans.

For most users, the practical takeaway is simple: 3DGS does not store only one flat color per point. It can store some information about how that point looks from different angles.

## Rendering a Splat

Traditional 3D engines are built around meshes: vertices, edges, faces, materials, lights, and textures. A Gaussian splat is different. It is a large collection of soft, transparent, view-dependent elements.

Because of this, a normal mesh renderer will not automatically display a splat correctly. You need a renderer or plugin that understands Gaussian splatting.

Common display contexts:

- Web viewer
- Three.js project
- PlayCanvas project
- Unity or Unreal project with a plugin
- Blender with a splat add-on
- Desktop viewer
- Custom installation software

When choosing a renderer, check:

- Which file formats it supports
- Whether it runs in the browser
- Whether it works on mobile
- Whether it supports editing or only viewing
- Whether it can handle your splat size
- Whether it supports camera animation
- Whether it supports transparency with other scene elements

## Editing and Cleanup

Most splats need some cleanup.

Common edits include:

- Cropping unwanted background.
- Removing floaters.
- Aligning the splat to the ground.
- Scaling the splat.
- Compressing the file.
- Reducing splat count for performance.
- Exporting to a different format.
- Setting camera paths for presentation.

Think of cleanup as part of the process, not as a failure. A raw splat is often like a raw photo scan: useful, but not always ready for presentation.

## Working With 3DGS in a Creative Pipeline

The right pipeline depends on your final output.

### For Web

Possible path:

1. Capture with phone, camera, or app.
2. Train with a cloud service or desktop tool.
3. Clean up in SuperSplat or similar software.
4. Export to a web-friendly format such as SOG, SPZ, or optimized PLY.
5. Display with a web renderer such as PlayCanvas or a Three.js-based library.

Prioritize file size, loading time, and camera controls.

### For Installation

Possible path:

1. Capture the scene or object at high quality.
2. Train locally or with a service that allows high-resolution export.
3. Test playback on the actual installation machine.
4. Build interaction, camera movement, projection, or sensor input around the splat.
5. Leave time for performance tuning.

Prioritize stability, frame rate, hardware testing, and graceful failure.

### For Film, Animation, or Motion Design

Possible path:

1. Capture the real location, prop, or scene.
2. Train and clean the splat.
3. Import into Blender, Unreal, After Effects, or another supported tool.
4. Animate cameras through the capture.
5. Composite with video, typography, particles, or rendered 3D elements.

Prioritize camera path, framing, resolution, and export quality.

### For Games or Interactive 3D

Possible path:

1. Use 3DGS for background environments, memories, portals, cutscenes, or atmospheric spaces.
2. Use meshes for collision, characters, props, and gameplay objects.
3. Combine the two inside a game engine.

Prioritize interaction design. A splat can look realistic, but it does not automatically behave like a game level.

### For Archiving Creative Work

Possible path:

1. Capture the work with generous coverage.
2. Export a high-quality PLY for storage.
3. Export smaller versions for sharing.
4. Keep the original photos or video frames.
5. Document the tool, settings, date, location, and author.

Prioritize preservation. The source images are often as important as the trained splat.

## Planning a 3DGS Shoot

Before you capture, answer these questions:

- What is the final output: web, video, installation, game, archive, or research?
- Does the viewer need to move freely, or will you control the camera?
- What parts of the scene matter most?
- Can the subject stay still?
- Can the lighting stay consistent?
- Is the scene small enough to capture in one pass?
- Are there reflective, transparent, blank, or moving surfaces?
- Do you need accurate geometry, or mainly the look of the space?
- What file format does your final software need?
- How much time do you have for re-capture?

If the project matters, do a small test first. Capture one corner, one object, or one short path before committing to a full production workflow.

## Practical Capture Checklist

Before capture:

- Clean the subject or scene.
- Remove objects you do not want in the final result.
- Stabilize anything that might move.
- Charge batteries.
- Clear storage.
- Lock exposure and white balance if possible.
- Plan your path.

During capture:

- Move slowly.
- Keep images sharp.
- Maintain overlap.
- Capture from multiple heights.
- Avoid sudden jumps.
- Avoid people walking through the scene.
- Take extra passes around important details.

After capture:

- Review images before leaving the location.
- Check for blur, darkness, glare, and missing angles.
- Keep source files organized.
- Save the original capture even after export.
- Make notes about the tool and settings used.

## Variants and Related Methods

### NeRF

Neural Radiance Fields were an earlier major approach to radiance field reconstruction. They can create high-quality novel views, but often require slower training and rendering than 3DGS.

### 2DGS

[2D Gaussian Splatting](https://surfsplatting.github.io) represents the scene with small oriented 2D disks instead of 3D blobs. It is designed to improve surface reconstruction compared with standard 3DGS.

### 4DGS

[4D Gaussian Splatting](https://github.com/hustvl/4DGaussians) adds time as another dimension. This is useful for dynamic scenes and is conceptually closer to volumetric video.

### Gaussian Surfels and Gaussian Wrapping

[Gaussian Wrapping](https://diego1401.github.io/BlobsToSpokesWebsite/) is a follow-up research direction from Inria that aims to reconstruct surfaces from Gaussian-based representations more effectively.

### Photogrammetry

Photogrammetry reconstructs mesh geometry from many photos. It is often better than 3DGS when you need a mesh, but it can struggle with reflective, transparent, or visually ambiguous surfaces.

### LiDAR and Laser Scanning

LiDAR and laser scanners are useful when spatial accuracy matters. They are often better for measurement, architecture, and fabrication, but they may not capture the photographic richness of a scene by themselves. It can be paired with 3DGS training methods to generate a geometrically accurate Gaussian Splat.

## Resources

Websites and software change quickly, so check each tool's documentation before starting a serious project. Pay attention to input requirements, export formats, licensing, cloud processing limits, and whether you can keep local copies of your data.

### Free or Freemium

- [SuperSplat: web-based splat editing, viewing, and sharing](https://superspl.at)
- [Blender: open-source 3D software with community and commercial 3DGS plugins](https://www.blender.org)
- [Scaniverse: app and website from Niantic for capturing, sharing, and training splats](https://dev.scaniverse.com/support)
- [COLMAP: open-source Structure from Motion software](https://colmap.github.io/tutorial.html)

### Paid or Commercial

- [Postshot: Windows desktop app for local training, editing, and plugin support for Unreal Engine and After Effects](https://www.jawset.com/docs/d/Postshot+User+Guide)
- [Polycam: app and web service with Gaussian Splatting support](https://poly.cam/tools/gaussian-splatting)
- [Kiri Engine: app with 3DGS and 3DGS-to-mesh workflows](https://www.kiriengine.app/features/3d-gaussian-splatting)
- [Marble by World Labs: generative 3D world creation](https://marble.worldlabs.ai)

A broader list of software with Gaussian Splatting support is available at [Radiance Fields](https://radiancefields.com/3d-gaussian-splatting-engine-support).

## Libraries and Repositories

These are useful for students and creatives with advanced coding skills. Most require command-line comfort, GPU setup, Python or JavaScript environments, and patience with dependencies.

- [Spark.js: 3DGS renderer for Three.js](https://sparkjs.dev)
- [COLMAP: Structure from Motion tool for camera alignment and point clouds](https://colmap.github.io/tutorial.html)
- [Inria 3DGS implementation](https://github.com/graphdeco-inria/gaussian-splatting)
- [2DGS implementation](https://github.com/hbb1/2d-gaussian-splatting)
- [Gaussian Wrapping implementation](https://github.com/diego1401/GaussianWrapping)
- [Splatfacto: nerfstudio's 3DGS method](https://docs.nerf.studio/nerfology/methods/splat.html)

Large AI coding tools can help with setup, but they can also confidently suggest broken commands. Read install instructions, use virtual environments when possible, and avoid running commands you do not understand.

## Creative Prompts for Thinking With 3DGS

These questions can help you decide whether 3DGS adds something meaningful to a project:

- What real place, object, or moment would be valuable to move through later?
- Does the work benefit from photographic imperfection?
- Is the viewer exploring a memory, archive, reconstruction, or dreamlike space?
- Would a mesh feel too clean or artificial?
- What should remain fixed, and what can be transformed?
- Should the capture feel documentary, cinematic, interactive, distorted, or intimate?
- Can the artifacts become part of the aesthetic instead of a problem?

3DGS is not only a technical capture method. It can also be a visual language: soft edges, unstable surfaces, partial memory, photographic depth, and a sense of being inside an image.

## Cool Examples

Add examples here as you find them. Useful categories to collect:

- Artist projects using 3DGS
- Web-based splat viewers
- Installation work
- Game or XR experiments
- Film and music video workflows
- Research demos
- Before-and-after capture breakdowns

<!-- find the gaussian splat of the small gallery -->

## References

- [Original 3D Gaussian Splatting paper and project page](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)
- [Radiance Fields: news and resources for NeRFs, 3DGS, and related research](https://radiancefields.com)
- [PlayCanvas SOG format documentation](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/sog/)
- [Niantic SPZ format announcement](https://www.nianticspatial.com/blog/spz4)

author: lorie chen
