# Simple Media Annotator

A small local-first web app for labeling points, bounding boxes, and closed shapes on short `.mp4` videos or folders of images. It uses plain HTML, CSS, and JavaScript with no backend, build system, cloud services, or external dependencies.

## Run Locally

Open `index.html` directly in a browser.

If your browser restricts local files, run a tiny local server from this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Load Media

Click **Open Media Folder** and choose a folder containing either one local video or a flat image sequence. Media stays on your computer and is loaded with browser object URLs.

If the folder contains one video, the app loads it as a video project. If the folder contains several images and no video, the app sorts the image filenames naturally and treats them as sequential frames. For example, the sample folder `media/images/bellybutton/` loads as a short frame sequence.

If a folder has multiple videos, the app uses a compatible project JSON to choose the matching video when possible. Otherwise, it asks which video to load.

If the folder also contains a compatible annotation JSON, the app loads those annotations automatically. Video JSON is matched by metadata such as `source_filename` or `source_video_path`. Image JSON is matched when `images[].filename` entries match the image files in the selected folder.

## Project JSON

Compatible project JSON files are loaded automatically when they are in the selected media folder. The exported JSON includes `metadata.source_video_path` for video projects and grouped `images` entries for image projects.

The JSON acts like a project file: choose the media folder that contains both the media and compatible JSON, and the app will restore the annotations it can match.

## Label Points, Boxes, and Shapes

- The app starts in **Edit mode** when it opens and after loading media, which helps prevent accidental new annotations.
- **Point mode:** click and release on the media to create a point annotation.
- **Bounding box mode:** click, drag, and release to create a box.
- **Shape mode:** click to add vertices for a closed polyline. Click near the first vertex, shown as a small circle, to close and save the shape.
- **Edit mode:** click an annotation to select it. Drag points to move them. Drag deep inside boxes or inside shapes to move them. Drag box corners or shape vertices to resize/edit them.
- Press **P**, **B**, **S**, or **E** to switch between Point, Bounding Box, Shape, and Edit modes unless an input field is focused.

Use the label field before creating an annotation. Point, Bounding Box, and Shape modes default to `point`, `bbox`, and `shape`. Multiple labels and multiple annotations per frame are allowed.

The annotation list shows only annotations on the current frame. Use **Delete** in the list, or select an annotation and press Backspace/Delete.

Press **Z** to undo the most recent annotation change, including accidental point, box, or shape additions.

## Timeline Controls

- **Frame:** type a frame number and press Enter, or leave the field, to jump to that frame.
- The progress bar under the media shows the current frame position across the loaded video or image sequence.
- **Transport controls:** `|<`, `Play`, `<`, `>`, `+>`, `>|`.
- **Play:** advances through frames using the same frame-step path as the next-frame button, at the project FPS.
- **+>:** copies all annotations on the current frame to the next frame with fresh IDs, then jumps to that next frame.
- **Spacebar:** pause or resume playback, unless an input field is focused.
- **Left / Right arrow keys:** previous frame and next frame, unless an input field is focused.
- **Shift + Right Arrow:** copy annotations to the next frame, unless an input field is focused.
- Playback loops automatically while video or image sequences are playing.
- For videos, the app tracks the requested frame number directly and seeks to the middle of that frame's time span. For image folders, each image is one frame. The FPS value is stored in exported project JSON.

## Onion-Skinning

Enable **Onion skin** to show annotations from the previous frame as a faint reference.

Onion-skin annotations are visual references only. They are not included in the current frame annotation list unless they actually belong to the current frame.

## Export JSON

Click **Export JSON** to download an annotation file.

Video projects use a flat annotation list:

```json
{
  "metadata": {
    "source_filename": "example.mp4",
    "source_video_path": "example.mp4",
    "media_type": "video",
    "image_folder": "",
    "image_count": 0,
    "media_width": 1920,
    "media_height": 1080,
    "video_width": 1920,
    "video_height": 1080,
    "fps": 30,
    "created_with": "minimal-media-annotator"
  },
  "annotations": []
}
```

Image-folder projects group annotations by image:

```json
{
  "metadata": {
    "media_type": "images",
    "image_folder": "bellybutton",
    "image_count": 16,
    "media_width": 1280,
    "media_height": 720,
    "fps": 30,
    "created_with": "minimal-media-annotator"
  },
  "images": [
    {
      "frame": 0,
      "filename": "bellybutton_00000.jpg",
      "path": "bellybutton/bellybutton_00000.jpg",
      "width": 1280,
      "height": 720,
      "annotations": []
    }
  ]
}
```

Point annotations include `x`, `y`, `nx`, and `ny`. Bounding boxes include `x`, `y`, `width`, `height`, `nx`, `ny`, `nwidth`, and `nheight`. Shape annotations include `points`, with each point storing `x`, `y`, `nx`, and `ny`.

Video annotations include `time`. Image-batch annotations do not include `time`.

Coordinates are stored in original video or image pixels, not displayed CSS pixels. Normalized values are relative to the original media width and height.

## Code Layout

- `index.html` defines the static controls and media/canvas stack.
- `style.css` handles the compact app layout, overlay cursor, progress bar, and annotation controls.
- `app.js` owns all browser behavior: media loading, frame stepping, coordinate conversion, drawing, editing, import/export, and keyboard shortcuts.
- `test/render_point_overlays.py` is an optional test helper for checking point annotations against decoded video frames.

## Render Point Overlays

For a visual timing check, `test/render_point_overlays.py` loads a video and annotation JSON, draws circles for `point` annotations, and exports annotated PNG frames.

Create and install the local Python environment:

```bash
python3 -m venv venv
venv/bin/python -m pip install -r test/requirements.txt
```

Run the default `piles_test` export:

```bash
venv/bin/python test/render_point_overlays.py
```

By default, it reads `media/video/piles_test/piles_test.mp4` and `media/video/piles_test/piles_test_annotations.json`, then writes PNGs to `media/video/piles_test/annotated_frames/`.

## Known Limitations

- Video frame accuracy depends on browser video seeking and the project FPS value matching the media's intended frame rate.
- Image folder loading uses browser directory selection support, commonly exposed as `webkitdirectory`.
- Image folders are intended to contain frames with the same dimensions.
- No model training.
- No automatic tracking yet.
- Intended for short videos and lightweight classroom use.
- Project JSON files can only auto-load MP4 paths the browser is allowed to reach; otherwise, choose the MP4 manually after opening the JSON.

## Notes for Agents

- This is intentionally a no-build, local-first app. Avoid adding a framework, backend, bundler, cloud dependency, or package manager unless the user explicitly changes that constraint.
- Main UI files are `index.html`, `style.css`, and `app.js`. The Python code in `test/` is only for verification exports and should not be required to run the browser annotator.
- `app.js` keeps all annotations in one array. Video projects export a flat `annotations` array; image projects export grouped `images[]` entries with each image filename and that frame's annotations.
- Annotation coordinates are intrinsic media pixels, not CSS pixels. Use `canvasToVideo()` and `videoToCanvas()` for coordinate transforms; do not derive annotation coordinates from displayed element sizes directly.
- Video frame state is logical and explicit: `currentVideoFrameIndex` is the source of truth for the current frame. The video element is seeked to the midpoint of the frame interval with `getSeekTimeForFrame()` to avoid browser boundary-seek ambiguity.
- `getMaxFrame()` returns the largest valid zero-based frame index. For a 41-frame video, valid frames are `0..40`; do not change this back to `duration * fps`.
- Playback is simulated frame stepping through `startVideoFramePlaybackLoop()`, not native `video.play()`. Native video looping is disabled because it caused wrong-frame display near the end of short MP4s.
- The default annotation mode is Edit (`select`) on startup and after loading media to reduce accidental point creation.
- Onion skinning shows only the previous frame. It is a drawing aid and does not affect the current-frame annotation list or JSON export.
- Image-folder projects use browser directory selection (`webkitdirectory`) and assume a flat image directory. If a compatible JSON is in the selected folder, the app auto-loads it.
- Verification commands used during development: `node --check app.js`, `venv/bin/python -B -m py_compile test/render_point_overlays.py`, and `venv/bin/python test/render_point_overlays.py`.
