let rawData;
let sequence;
let loadError = null;
let startedAt = 0;
let layerToggles = {};
let isPaused = false;
let pausedFrameIndex = 0;
const DEFAULT_INPUT_PATH = "input/bouncing.json";
const DEFAULT_INPUT_FILENAME = "bouncing.json";
const DEFAULT_SOURCE_WIDTH = 960;
const DEFAULT_SOURCE_HEIGHT = 540;
const MAX_DISPLAY_DIMENSION = 1280;
let sourceFileName = DEFAULT_INPUT_FILENAME;
let displayScale = 1;
let gifCapture = null;
let gifButton = null;

// Each layer key maps to a p5 DOM checkbox. The same keys gate drawing in drawDetection().
const layerDefinitions = [
  ["masks", "RLE contours (filled)"],
  ["rleContours", "RLE contours"],
  ["contours", "Simplified contours"],
  ["boxes", "Bounding boxes"],
  ["labels", "Object labels, IDs, and score"],
  ["points", "Centroid points"],
  ["trackPoints", "Track points"],
  ["frameCounter", "Frame counter"],
  ["legend", "Legend"],
];

const palette = [
  [255, 82, 82],
  [0, 224, 167],
  [76, 154, 255],
  [255, 201, 71],
  [204, 126, 255],
  [255, 137, 78],
  [85, 226, 255],
  [190, 255, 91],
  [255, 112, 178],
  [155, 191, 255],
];

/**
 * Loads the tracking JSON before setup() runs.
 *
 * p5 blocks setup() until loadJSON() completes, so the rest of the sketch can
 * normalize rawData synchronously in setup().
 */
function preload() {
  rawData = loadJSON(DEFAULT_INPUT_PATH);
}

/**
 * Creates the canvas, UI controls, and normalized frame sequence.
 */
function setup() {
  const sourceDimensions = sourceDimensionsForData(rawData);
  const displaySize = displaySizeForSource(sourceDimensions.width, sourceDimensions.height);
  displayScale = displaySize.scale;

  pixelDensity(2);
  createCanvas(displaySize.width, displaySize.height);
  frameRate(positiveNumber(rawData && rawData.fps, 24));
  textFont("monospace");
  textSize(14);
  createLayerControls();

  if (!loadError) {
    applyRawData(rawData, sourceFileName);
  }

  startedAt = millis();
}

/**
 * Draws the current animation frame and all enabled data layers.
 */
function draw() {
  background(0);
  if (layerEnabled("legend")) {
    drawSourceFilename();
  }

  if (loadError) {
    drawStatus(loadError);
    return;
  }

  if (!sequence || !sequence.frames.length) {
    drawStatus(`No frame data found in ${sourceFileName}`);
    return;
  }

  const frameIndex = getPlaybackFrameIndex();
  const detections = sequence.frames[frameIndex] || [];

  push();
  scale(displayScale);
  for (const detection of detections) {
    drawDetection(detection);
  }
  pop();

  if (layerEnabled("frameCounter")) {
    drawOverlay(frameIndex, detections.length);
  }

  advanceGifCaptureFrame();
}

/**
 * Builds visualization checkbox controls outside the canvas.
 *
 * Optional modules can append their own controls to the same panel.
 */
function createLayerControls() {
  const panel = createDiv();
  panel.class("layer-controls");
  panel.attribute("aria-label", "View/export filters");

  const layerSection = createDiv();
  layerSection.class("controls-section controls-section--layers");
  layerSection.parent(panel);

  const title = createDiv("View/export filters");
  title.class("layer-controls__title");
  title.parent(layerSection);

  for (const [key, label] of layerDefinitions) {
    const checkbox = createCheckbox(label, true);
    checkbox.class("layer-controls__item");
    checkbox.parent(layerSection);
    layerToggles[key] = checkbox;
  }

  const actionSection = createDiv();
  actionSection.class("controls-section controls-section--actions");
  actionSection.parent(panel);
  createImportControls(actionSection);

  // Export features are optional. Remove easytrackExporter.js from index.html
  // and this sketch will continue to run without showing export controls.
  if (window.EasyTrackExporter) {
    window.EasyTrackExporter.createControls(actionSection, () => sequence, getLayerExportFilters);
  }

  createGifExportControl(actionSection);
  createUsageSection(panel);
}

/**
 * Returns the current layer checkbox state for optional exporters.
 *
 * @returns {object} Map of layer keys to checked state.
 */
function getLayerExportFilters() {
  const filters = {};
  for (const [key] of layerDefinitions) {
    filters[key] = layerEnabled(key);
  }
  return filters;
}

/**
 * Builds the JSON import button and hidden file input.
 *
 * @param {object} parent p5.Element that should contain the import controls.
 */
function createImportControls(parent) {
  const button = createButton("Import JSON");
  button.class("import-button");
  button.parent(parent);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.className = "json-file-input";
  input.addEventListener("change", handleJsonFileSelected);
  parent.elt.appendChild(input);

  button.mousePressed(() => input.click());
}

/**
 * Builds the p5 canvas GIF export button.
 *
 * @param {object} parent p5.Element that should contain the GIF control.
 */
function createGifExportControl(parent) {
  gifButton = createButton("Save as GIF");
  gifButton.class("export-button");
  gifButton.parent(parent);
  gifButton.mousePressed(saveCanvasGif);
}

/**
 * Adds compact usage notes to the controls area.
 *
 * @param {object} parent p5.Element that should contain the usage notes.
 */
function createUsageSection(parent) {
  const section = createDiv();
  section.class("controls-section controls-section--usage");
  section.parent(parent);

  const title = createDiv("Usage");
  title.class("layer-controls__title");
  title.parent(section);

  const notes = createDiv();
  notes.class("usage-notes");
  notes.html([
    "Launch local server using:",
    "`python3 -m http.server 8000`",
    "Then visit: http://127.0.0.1:8000/",
    "Filters control canvas view and exports.",
    "Space pauses; step with L/R arrow keys.",
  ].join("<br>"));
  notes.parent(section);
}

/**
 * Restarts playback and captures one rendered source frame per GIF frame.
 *
 * During GIF export, getPlaybackFrameIndex() reads gifCapture.frameIndex rather
 * than wall-clock time. That avoids duplicate JSON frames when GIF encoding is
 * slower than the source FPS.
 */
function saveCanvasGif() {
  if (!sequence || !sequence.frames.length || typeof saveGif !== "function") {
    console.warn("p5 saveGif() is not available.");
    return;
  }

  const fps = positiveNumber(sequence.fps, 24);
  const capture = {
    fps,
    frameCount: sequence.frames.length,
    frameIndex: 0,
    wasPaused: isPaused,
    previousPausedFrameIndex: pausedFrameIndex,
    previousStartedAt: startedAt,
  };

  // Stop the live animation before enabling gifCapture. This prevents a queued
  // normal draw from consuming frame 0 before saveGif() starts its own redraw
  // loop.
  noLoop();
  setTimeout(() => startGifCapture(capture), 0);
}

/**
 * Starts p5's GIF capture loop after normal playback has been stopped.
 *
 * @param {object} capture GIF capture state.
 */
function startGifCapture(capture) {
  gifCapture = capture;

  frameRate(capture.fps);
  pausedFrameIndex = 0;
  isPaused = false;
  if (gifButton) {
    gifButton.attribute("disabled", "disabled");
    gifButton.html("Saving GIF...");
  }

  Promise.resolve(saveGif(gifExportFilename(), gifCapture.frameCount, {
    delay: 0,
    units: "frames",
    silent: false,
  }))
    .catch((error) => console.error(error))
    .finally(() => finishGifCapture(capture));
}

/**
 * Reads and applies a user-selected JSON file.
 *
 * @param {Event} event File input change event.
 */
function handleJsonFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyRawData(JSON.parse(reader.result), file.name);
    } catch (error) {
      loadError = `Could not parse ${file.name}`;
      console.error(error);
    }
  };
  reader.onerror = () => {
    loadError = `Could not read ${file.name}`;
  };
  reader.readAsText(file);

  // Allow selecting the same file again after editing it on disk.
  event.target.value = "";
}

/**
 * Normalizes new raw JSON data and resets playback state.
 *
 * @param {object|Array} data Raw EasyTrack JSON.
 * @param {string} filename Source filename to retain for export names.
 */
function applyRawData(data, filename) {
  rawData = data;
  sourceFileName = filename || DEFAULT_INPUT_FILENAME;
  sequence = buildSequence(rawData);
  sequence.sourceFileName = sourceFileName;
  sequence.sourceBaseName = baseNameWithoutExtension(sourceFileName);
  loadError = null;
  pausedFrameIndex = 0;
  isPaused = false;
  startedAt = millis();
  frameRate(positiveNumber(sequence.fps, 24));
  const displaySize = displaySizeForSource(sequence.width, sequence.height);
  displayScale = displaySize.scale;
  resizeCanvas(displaySize.width, displaySize.height);
}

/**
 * Computes the canvas display size for a source image.
 *
 * The largest displayed dimension is clamped to MAX_DISPLAY_DIMENSION while the
 * original source coordinate system is preserved for drawing and export data.
 *
 * @param {number} sourceWidth Source image width.
 * @param {number} sourceHeight Source image height.
 * @returns {{width:number, height:number, scale:number}}
 */
function displaySizeForSource(sourceWidth, sourceHeight) {
  const safeWidth = positiveNumber(sourceWidth, DEFAULT_SOURCE_WIDTH);
  const safeHeight = positiveNumber(sourceHeight, DEFAULT_SOURCE_HEIGHT);
  const largestDimension = max(safeWidth, safeHeight);
  const scale = largestDimension > MAX_DISPLAY_DIMENSION ? MAX_DISPLAY_DIMENSION / largestDimension : 1;
  return {
    width: max(1, round(safeWidth * scale)),
    height: max(1, round(safeHeight * scale)),
    scale,
  };
}

/**
 * Returns whether a named visualization layer should be drawn.
 *
 * Missing toggles default to enabled so drawing still works before controls are
 * created or if a layer key is added temporarily during development.
 *
 * @param {string} key Layer key from layerDefinitions.
 * @returns {boolean}
 */
function layerEnabled(key) {
  return !layerToggles[key] || layerToggles[key].checked();
}

/**
 * Handles playback keyboard controls.
 *
 * Space pauses/resumes. While paused, left/right arrows step one frame and wrap
 * around both ends of the sequence.
 *
 * @returns {boolean} false when p5/browser default key handling should stop.
 */
function keyPressed() {
  if (key === " ") {
    if (isPaused) {
      const fps = positiveNumber(sequence && sequence.fps, 24);
      startedAt = millis() - (pausedFrameIndex / fps) * 1000;
      isPaused = false;
    } else {
      pausedFrameIndex = getPlaybackFrameIndex();
      isPaused = true;
    }

    return false;
  }

  if (isPaused && keyCode === LEFT_ARROW) {
    stepPausedFrame(-1);
    return false;
  }

  if (isPaused && keyCode === RIGHT_ARROW) {
    stepPausedFrame(1);
    return false;
  }

  return true;
}

/**
 * Computes the frame index currently shown by the animation.
 *
 * GIF capture is frame-indexed so every captured GIF frame maps to exactly one
 * JSON frame. Normal playback derives frame index from elapsed wall-clock time
 * so animation rate follows the source FPS rather than p5's render cadence.
 *
 * @returns {number}
 */
function getPlaybackFrameIndex() {
  if (!sequence || !sequence.frames.length) {
    return 0;
  }
  if (gifCapture) {
    return min(sequence.frames.length - 1, gifCapture.frameIndex);
  }
  if (isPaused) {
    return pausedFrameIndex % sequence.frames.length;
  }

  const fps = positiveNumber(sequence.fps, 24);
  return floor(((millis() - startedAt) / 1000) * fps) % sequence.frames.length;
}

/**
 * Advances deterministic GIF capture by one source frame after each draw.
 */
function advanceGifCaptureFrame() {
  if (!gifCapture) {
    return;
  }

  gifCapture.frameIndex = min(gifCapture.frameIndex + 1, gifCapture.frameCount);
}

/**
 * Restores normal playback state after saveGif() has finished capturing.
 *
 * @param {object} capture GIF capture state to restore from.
 */
function finishGifCapture(capture) {
  if (gifCapture !== capture) {
    return;
  }
  gifCapture = null;
  isPaused = capture.wasPaused;
  pausedFrameIndex = capture.previousPausedFrameIndex;
  startedAt = capture.wasPaused ? capture.previousStartedAt : millis();
  frameRate(positiveNumber(sequence && sequence.fps, capture.fps));

  if (gifButton) {
    gifButton.elt.removeAttribute("disabled");
    gifButton.html("Save as GIF");
  }
}

/**
 * Steps the paused frame index by a signed amount, wrapping at sequence ends.
 *
 * @param {number} delta Usually -1 or +1.
 */
function stepPausedFrame(delta) {
  if (!sequence || !sequence.frames.length) {
    return;
  }
  pausedFrameIndex = (pausedFrameIndex + delta + sequence.frames.length) % sequence.frames.length;
}

/**
 * Converts supported JSON layouts into a frame-indexed sequence.
 *
 * The default input JSON is object-indexed: objects[id].frames[frameNumber].
 * This function also accepts common frame-indexed shapes such as data.frames or
 * data.annotations, then normalizes every detection into one internal format.
 *
 * @param {object|Array} data Raw tracking JSON.
 * @returns {{width:number, height:number, fps:number, frames:Array<Array<object>>}}
 */
function buildSequence(data) {
  const sourceDimensions = sourceDimensionsForData(data);
  const width = sourceDimensions.width;
  const height = sourceDimensions.height;
  const fps = positiveNumber(data && data.fps, 24);
  const frameCount = positiveInteger(
    data && (data.num_frames || data.frame_count || data.frameCount || data.length),
    inferFrameCount(data),
  );
  const frames = Array.from({ length: max(1, frameCount) }, () => []);

  // Object-indexed tracks are inverted into frames so draw() can simply read
  // sequence.frames[currentFrame].
  const objectMap = data && data.objects;
  if (objectMap && typeof objectMap === "object") {
    const objects = Array.isArray(objectMap) ? objectMap : Object.values(objectMap);

    for (const objectRecord of objects) {
      const objectFrames = objectRecord && objectRecord.frames;
      if (!objectFrames || typeof objectFrames !== "object") {
        continue;
      }

      for (const key of Object.keys(objectFrames)) {
        const frameIndex = Number(key);
        if (!Number.isInteger(frameIndex) || frameIndex < 0) {
          continue;
        }
        ensureFrame(frames, frameIndex);
        frames[frameIndex].push(normalizeDetection(objectFrames[key], objectRecord, frameIndex, width, height));
      }
    }
  }

  const frameRecords = getFrameRecords(data);
  if (frameRecords.length) {
    frameRecords.forEach((record, index) => {
      const frameIndex = positiveInteger(record && (record.frame || record.frame_id || record.frameIndex), index);
      ensureFrame(frames, frameIndex);
      const detections = getDetectionRecords(record);

      for (const detection of detections) {
        frames[frameIndex].push(normalizeDetection(detection, detection, frameIndex, width, height));
      }
    });
  }

  return { width, height, fps, frames };
}

/**
 * Finds a top-level frame array in common tracking/annotation JSON layouts.
 *
 * @param {object|Array} data Raw JSON.
 * @returns {Array}
 */
function getFrameRecords(data) {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  for (const key of ["frames", "frameData", "frame_data", "annotations", "data"]) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }
  return [];
}

/**
 * Finds detection records inside a frame record.
 *
 * If the frame itself appears to be a detection, it is returned as a singleton
 * list so the rest of the pipeline can be uniform.
 *
 * @param {object} frameRecord One frame's raw data.
 * @returns {Array<object>}
 */
function getDetectionRecords(frameRecord) {
  if (!frameRecord || typeof frameRecord !== "object") {
    return [];
  }
  for (const key of ["objects", "detections", "instances", "items", "tracks", "segments"]) {
    if (Array.isArray(frameRecord[key])) {
      return frameRecord[key];
    }
    if (frameRecord[key] && typeof frameRecord[key] === "object") {
      return Object.values(frameRecord[key]);
    }
  }
  return [frameRecord];
}

/**
 * Converts one raw detection/frame entry into the sketch's internal shape.
 *
 * The normalizer keeps display data and lazy cache slots together so downstream
 * drawing code does not need to know the original JSON field names.
 *
 * @param {object} frameRecord Per-frame detection record.
 * @param {object} objectRecord Parent object/track record, when available.
 * @param {number} frameIndex Frame number in the sequence.
 * @param {number} sourceWidth Source image width.
 * @param {number} sourceHeight Source image height.
 * @returns {object}
 */
function normalizeDetection(frameRecord, objectRecord, frameIndex, sourceWidth, sourceHeight) {
  const id = firstDefined(
    frameRecord && (frameRecord.object_id ?? frameRecord.id ?? frameRecord.track_id ?? frameRecord.trackId),
    objectRecord && (objectRecord.object_id ?? objectRecord.id ?? objectRecord.track_id ?? objectRecord.trackId),
    "obj",
  );
  const label = firstDefined(frameRecord && frameRecord.label, objectRecord && objectRecord.label, `obj${id}`);
  const bbox = normalizeBBox(frameRecord && (frameRecord.bbox || frameRecord.box || frameRecord.bounds), sourceWidth, sourceHeight);
  const point = normalizePoint(frameRecord && (frameRecord.point || frameRecord.center || frameRecord.centroid));
  const contours = normalizeContours(
    firstDefined(
      frameRecord && frameRecord.contour,
      frameRecord && frameRecord.contours,
      frameRecord && frameRecord.polygon,
      frameRecord && frameRecord.polygons,
      frameRecord && frameRecord.segmentation,
    ),
  );
  const rle = normalizeRle(
    firstDefined(
      frameRecord && frameRecord.mask_rle,
      frameRecord && frameRecord.rle,
      frameRecord && frameRecord.mask,
      frameRecord && frameRecord.segmentation,
    ),
  );

  return {
    id,
    label,
    frameIndex,
    bbox,
    point,
    contours,
    rle,
    area: frameRecord && frameRecord.area,
    score: firstDefined(frameRecord && frameRecord.score, objectRecord && objectRecord.score),
    visible: firstDefined(frameRecord && frameRecord.visible, true),
    trackPoints: normalizePointList(frameRecord && (frameRecord.track_points || frameRecord.trackPoints)),
    trackVisible: frameRecord && (frameRecord.track_visible || frameRecord.trackVisible),
    sourceWidth,
    sourceHeight,
    maskImage: null,
    boundaryPoints: null,
    boundarySegments: null,
  };
}

/**
 * Draws all enabled visual layers for one detection.
 *
 * @param {object} detection Normalized detection.
 */
function drawDetection(detection) {
  if (!detection.visible) {
    return;
  }

  const c = colorForId(detection.id);
  if (layerEnabled("masks")) {
    drawMask(detection, c);
  }
  if (layerEnabled("rleContours")) {
    drawRleContour(detection, c);
  }
  if (layerEnabled("contours")) {
    drawContours(detection, c);
  }
  if (layerEnabled("boxes")) {
    drawBBox(detection, c);
  }
  if (layerEnabled("points")) {
    drawPoint(detection.point, c, 7);
  }
  if (layerEnabled("trackPoints")) {
    drawTrackPoints(detection, c);
  }
  if (layerEnabled("labels")) {
    drawLabel(detection, c);
  }
}

/**
 * Draws a translucent bitmap mask decoded from compressed RLE.
 *
 * @param {object} detection Normalized detection with optional rle.
 * @param {number[]} c RGB color triplet.
 */
function drawMask(detection, c) {
  if (!detection.rle) {
    return;
  }

  const img = getMaskImage(detection, c);
  if (!img) {
    return;
  }

  push();
  tint(255, 72);
  image(img, 0, 0, detection.sourceWidth, detection.sourceHeight);
  noTint();
  pop();
}

/**
 * Draws simplified polygon contours using p5 beginShape()/endShape().
 *
 * These are the simplified contour arrays from the JSON, not the dense boundary
 * reconstructed from the RLE mask.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 */
function drawContours(detection, c) {
  const contours = detection.contours;
  if (!contours.length) {
    return;
  }

  push();
  stroke(c[0], c[1], c[2], 245);
  strokeWeight(2);
  strokeJoin(ROUND); 
  noFill();

  for (const contour of contours) {
    if (contour.length < 2) {
      continue;
    }
    beginShape();
    for (const point of contour) {
      vertex(point[0], point[1]);
    }
    endShape(CLOSE);
  }
  pop();
}

/**
 * Draws a thin mask boundary reconstructed from decoded RLE pixels.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 */
function drawRleContour(detection, c) {
  const segments = getBoundarySegments(detection);
  if (!segments.length) {
    return;
  }

  push();
  stroke(c[0], c[1], c[2], 120);
  strokeWeight(1);
  strokeCap(ROUND);
  strokeJoin(ROUND); 
  for (const segment of segments) {
    line(segment[0], segment[1], segment[2], segment[3]);
  }
  pop();
}

/**
 * Draws a dashed bounding box.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 */
function drawBBox(detection, c) {
  if (!detection.bbox) {
    return;
  }

  push();
  noFill();
  stroke(c[0], c[1], c[2], 180);
  strokeWeight(1.5);
  strokeJoin(ROUND); 
  drawingContext.setLineDash([7, 5]);
  rect(detection.bbox.x, detection.bbox.y, detection.bbox.w, detection.bbox.h);
  drawingContext.setLineDash([]);
  pop();
}

/**
 * Draws a circular point marker.
 *
 * In this data, detection.point is the centroid of the decoded RLE mask.
 *
 * @param {?number[]} point [x, y] point.
 * @param {number[]} c RGB color triplet.
 * @param {number} size Marker diameter in pixels.
 */
function drawPoint(point, c, size) {
  if (!point) {
    return;
  }
  push();
  noStroke();
  fill(c[0], c[1], c[2], 230);
  circle(point[0], point[1], size);
  fill(255, 230);
  circle(point[0], point[1], max(2, size * 0.32));
  pop();
}

/**
 * Draws optional track points when input JSON provides them.
 *
 * The default input JSON has track_points fields but they are all null; this is
 * kept for compatibility with future files.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 */
function drawTrackPoints(detection, c) {
  if (!detection.trackPoints.length) {
    return;
  }

  push();
  noStroke();
  for (let i = 0; i < detection.trackPoints.length; i += 1) {
    if (Array.isArray(detection.trackVisible) && detection.trackVisible[i] === false) {
      continue;
    }
    fill(c[0], c[1], c[2], 170);
    circle(detection.trackPoints[i][0], detection.trackPoints[i][1], 4);
  }
  pop();
}

/**
 * Draws a text label containing object label, ID, and score.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 */
function drawLabel(detection, c) {
  const anchor = detection.bbox
    ? [detection.bbox.x, max(16, detection.bbox.y - 7)]
    : detection.point || firstContourPoint(detection.contours);
  if (!anchor) {
    return;
  }

  const scoreText = Number.isFinite(detection.score) ? ` ${nf(detection.score, 1, 2)}` : "";
  const label = `${detection.label} #${detection.id}${scoreText}`;
  const labelWidth = textWidth(label) + 10;

  push();
  noStroke();
  fill(0, 190);
  rect(anchor[0] - 2, anchor[1] - 13, labelWidth, 18, 3);
  fill(c[0], c[1], c[2]);
  text(label, anchor[0] + 3, anchor[1]);
  pop();
}

/**
 * Draws the top-left frame/object counter.
 *
 * @param {number} frameIndex Zero-based current frame.
 * @param {number} detectionCount Number of detections in the frame.
 */
function drawOverlay(frameIndex, detectionCount) {
  const label = `frame ${frameIndex + 1}/${sequence.frames.length}  objects ${detectionCount}`;
  push();
  noStroke();
  fill(0, 128);
  rect(10, 10, textWidth(label) + 20, 28, 4);
  fill(255);
  text(label, 20, 29);
  pop();
}

/**
 * Draws the current input JSON filename in the upper-right canvas corner.
 *
 * This runs before detections and overlays so the filename stays visually below
 * all tracked data and the frame counter.
 */
function drawSourceFilename() {
  if (!sourceFileName) {
    return;
  }

  const dimensions = sourceDimensionsLabel();

  push();
  noStroke();
  fill(115);
  textAlign(RIGHT, BASELINE);
  text(sourceFileName, width - 20, 29);
  if (dimensions) {
    text(dimensions, width - 20, 45);
  }
  pop();
}

/**
 * Formats the source image dimensions shown under the input filename.
 *
 * @returns {string} Dimension label such as "960 x 540".
 */
function sourceDimensionsLabel() {
  const dimensions = sourceDimensionsForData(rawData || sequence);
  if (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height)) {
    return "";
  }
  return `${dimensions.width} x ${dimensions.height}`;
}

/**
 * Returns positive source dimensions, falling back for missing/pathological data.
 *
 * @param {?object} data Raw or normalized tracking data.
 * @returns {{width:number, height:number}}
 */
function sourceDimensionsForData(data) {
  return {
    width: positiveNumber(data && data.width, DEFAULT_SOURCE_WIDTH),
    height: positiveNumber(data && data.height, DEFAULT_SOURCE_HEIGHT),
  };
}

/**
 * Draws a simple status/error message on the canvas.
 *
 * @param {string} message Text to display.
 */
function drawStatus(message) {
  push();
  noStroke();
  fill(255);
  text(message, 20, 30);
  pop();
}

/**
 * Normalizes several common contour/polygon layouts into arrays of [x, y].
 *
 * Supports flat point arrays, OpenCV/SAM-style nested arrays, and object fields
 * such as points/vertices/path. RLE-like objects are ignored here because they
 * need pixel decoding rather than polygon parsing.
 *
 * @param {*} value Raw contour-like value.
 * @returns {Array<Array<number[]>>}
 */
function normalizeContours(value) {
  if (value == null || isRleLike(value)) {
    return [];
  }

  if (Array.isArray(value) && value.every((n) => typeof n === "number") && value.length >= 4) {
    return [numbersToPoints(value)];
  }

  const point = normalizePoint(value);
  if (point) {
    return [[point]];
  }

  if (Array.isArray(value)) {
    const directPoints = value.map(normalizePoint);
    if (directPoints.length && directPoints.every(Boolean)) {
      return [directPoints];
    }

    // Recurse through arbitrary nesting; OpenCV contours often arrive wrapped
    // in one or more single-item arrays depending on the serializer.
    const contours = [];
    for (const child of value) {
      contours.push(...normalizeContours(child));
    }
    return contours.filter((contour) => contour.length > 1);
  }

  if (typeof value === "object") {
    for (const key of ["points", "vertices", "path", "contour", "contours", "polygon", "polygons"]) {
      if (value[key] != null) {
        return normalizeContours(value[key]);
      }
    }
  }

  return [];
}

/**
 * Normalizes one point from array or object form.
 *
 * @param {*} value Raw point-like value.
 * @returns {?number[]} [x, y] or null.
 */
function normalizePoint(value) {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
      return [value[0], value[1]];
    }
    if (value.length === 1) {
      return normalizePoint(value[0]);
    }
    return null;
  }
  if (typeof value === "object") {
    const x = firstDefined(value.x, value.X, value[0]);
    const y = firstDefined(value.y, value.Y, value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return [x, y];
    }
  }
  return null;
}

/**
 * Normalizes a list of points, accepting either flat coordinates or contours.
 *
 * @param {*} value Raw point-list value.
 * @returns {Array<number[]>}
 */
function normalizePointList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value) && value.every((n) => typeof n === "number") && value.length >= 2) {
    return numbersToPoints(value);
  }
  return normalizeContours(value).flat();
}

/**
 * Converts [x1, y1, x2, y2, ...] into [[x1, y1], [x2, y2], ...].
 *
 * @param {number[]} numbers Flat coordinate list.
 * @returns {Array<number[]>}
 */
function numbersToPoints(numbers) {
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push([numbers[i], numbers[i + 1]]);
  }
  return points;
}

/**
 * Normalizes bounding boxes from object, xywh array, or xyxy array form.
 *
 * @param {*} value Raw bbox-like value.
 * @param {number} sourceWidth Source image width.
 * @param {number} sourceHeight Source image height.
 * @returns {?{x:number, y:number, w:number, h:number}}
 */
function normalizeBBox(value, sourceWidth, sourceHeight) {
  if (!value) {
    return null;
  }

  let box = value;
  if (typeof value === "object" && !Array.isArray(value)) {
    if (Array.isArray(value.bbox)) {
      box = value.bbox;
    } else {
      const x = firstDefined(value.x, value.left, value.xmin, value.x1);
      const y = firstDefined(value.y, value.top, value.ymin, value.y1);
      const w = firstDefined(value.w, value.width);
      const h = firstDefined(value.h, value.height);
      const x2 = firstDefined(value.xmax, value.x2, value.right);
      const y2 = firstDefined(value.ymax, value.y2, value.bottom);
      if ([x, y, w, h].every(Number.isFinite)) {
        return { x, y, w, h };
      }
      if ([x, y, x2, y2].every(Number.isFinite)) {
        return { x, y, w: x2 - x, h: y2 - y };
      }
    }
  }

  if (!Array.isArray(box) || box.length < 4 || !box.slice(0, 4).every(Number.isFinite)) {
    return null;
  }

  const [x1, y1, a, b] = box;
  // Ambiguous 4-number arrays are guessed as xyxy only when the third/fourth
  // values look like bottom-right image coordinates. Otherwise treat as xywh.
  const likelyXYXY = a > x1 && b > y1 && a <= sourceWidth && b <= sourceHeight;
  if (likelyXYXY) {
    return { x: x1, y: y1, w: a - x1, h: b - y1 };
  }
  return { x: x1, y: y1, w: a, h: b };
}

/**
 * Normalizes a COCO/OpenCV-style RLE mask object.
 *
 * @param {*} value Raw RLE-like value.
 * @returns {?{height:number, width:number, counts:(string|number[])}}
 */
function normalizeRle(value) {
  if (!isRleLike(value)) {
    return null;
  }
  const size = value.size || value.shape || value.dims;
  if (!Array.isArray(size) || size.length < 2) {
    return null;
  }
  return {
    height: size[0],
    width: size[1],
    counts: value.counts || value.rle,
  };
}

/**
 * Checks whether a value has the fields needed for RLE mask decoding.
 *
 * @param {*} value Candidate value.
 * @returns {boolean}
 */
function isRleLike(value) {
  return Boolean(value && typeof value === "object" && (value.counts || value.rle) && (value.size || value.shape || value.dims));
}

/**
 * Lazily builds a p5.Image containing the decoded filled mask for a detection.
 *
 * @param {object} detection Normalized detection.
 * @param {number[]} c RGB color triplet.
 * @returns {?p5.Image}
 */
function getMaskImage(detection, c) {
  if (detection.maskImage) {
    return detection.maskImage;
  }

  const decoded = decodeRle(detection.rle);
  if (!decoded) {
    return null;
  }

  const img = createImage(decoded.width, decoded.height);
  img.loadPixels();
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const maskIndex = y * decoded.width + x;
      if (!decoded.mask[maskIndex]) {
        continue;
      }
      const pixelIndex = 4 * maskIndex;
      img.pixels[pixelIndex] = c[0];
      img.pixels[pixelIndex + 1] = c[1];
      img.pixels[pixelIndex + 2] = c[2];
      img.pixels[pixelIndex + 3] = 150;
    }
  }
  img.updatePixels();
  detection.maskImage = img;
  return img;
}

/**
 * Returns sparse boundary points from a decoded RLE mask.
 *
 * Kept for compatibility with earlier point-based boundary drawing; the current
 * RLE contour layer uses getBoundarySegments() for cleaner outlines.
 *
 * @param {object} detection Normalized detection.
 * @returns {Array<Array<number[]>>}
 */
function getBoundaryPoints(detection) {
  if (detection.boundaryPoints) {
    return detection.boundaryPoints;
  }
  if (!detection.rle) {
    detection.boundaryPoints = [];
    return detection.boundaryPoints;
  }

  const decoded = decodeRle(detection.rle);
  if (!decoded) {
    detection.boundaryPoints = [];
    return detection.boundaryPoints;
  }

  const points = [];
  // Large masks can have tens of thousands of boundary pixels, so this older
  // point representation is downsampled based on source dimensions.
  const stride = max(1, floor(max(decoded.width, decoded.height) / 480));
  for (let y = 0; y < decoded.height; y += stride) {
    for (let x = 0; x < decoded.width; x += stride) {
      if (!decoded.mask[y * decoded.width + x]) {
        continue;
      }
      if (isMaskBoundary(decoded.mask, decoded.width, decoded.height, x, y)) {
        points.push([x, y]);
      }
    }
  }

  detection.boundaryPoints = points.length ? [points] : [];
  return detection.boundaryPoints;
}

/**
 * Returns line segments around every exposed edge of a decoded RLE mask.
 *
 * @param {object} detection Normalized detection.
 * @returns {Array<number[]>} Segments as [x1, y1, x2, y2].
 */
function getBoundarySegments(detection) {
  if (detection.boundarySegments) {
    return detection.boundarySegments;
  }
  if (!detection.rle) {
    detection.boundarySegments = [];
    return detection.boundarySegments;
  }

  const decoded = decodeRle(detection.rle);
  if (!decoded) {
    detection.boundarySegments = [];
    return detection.boundarySegments;
  }

  const segments = [];
  // Cache the edge list after one full mask scan. Recomputing this every p5
  // frame is noticeably wasteful for full-resolution video masks.
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      if (!decoded.mask[y * decoded.width + x]) {
        continue;
      }
      if (x === 0 || !decoded.mask[y * decoded.width + x - 1]) {
        segments.push([x, y, x, y + 1]);
      }
      if (x === decoded.width - 1 || !decoded.mask[y * decoded.width + x + 1]) {
        segments.push([x + 1, y, x + 1, y + 1]);
      }
      if (y === 0 || !decoded.mask[(y - 1) * decoded.width + x]) {
        segments.push([x, y, x + 1, y]);
      }
      if (y === decoded.height - 1 || !decoded.mask[(y + 1) * decoded.width + x]) {
        segments.push([x, y + 1, x + 1, y + 1]);
      }
    }
  }

  detection.boundarySegments = segments;
  return detection.boundarySegments;
}

/**
 * Decodes an RLE mask into a row-major Uint8Array for canvas access.
 *
 * COCO/pycocotools-style RLE stores runs in column-major order, so each active
 * run index is remapped from Fortran order into row-major mask[y * width + x].
 *
 * @param {?{height:number, width:number, counts:(string|number[])}} rle Normalized RLE.
 * @returns {?{width:number, height:number, mask:Uint8Array}}
 */
function decodeRle(rle) {
  if (!rle || !Number.isFinite(rle.width) || !Number.isFinite(rle.height)) {
    return null;
  }

  const runs = typeof rle.counts === "string" ? decodeCompressedCounts(rle.counts) : rle.counts;
  if (!Array.isArray(runs)) {
    return null;
  }

  const mask = new Uint8Array(rle.width * rle.height);
  let cursor = 0;
  let value = 0;

  for (const rawRun of runs) {
    const run = max(0, floor(rawRun));
    if (value === 1) {
      for (let i = 0; i < run && cursor + i < mask.length; i += 1) {
        const fortranIndex = cursor + i;
        // COCO RLE advances y fastest. p5 pixels advance x fastest, so convert
        // before storing the decoded mask.
        const x = floor(fortranIndex / rle.height);
        const y = fortranIndex % rle.height;
        mask[y * rle.width + x] = 1;
      }
    }
    cursor += run;
    value = 1 - value;
  }

  return { width: rle.width, height: rle.height, mask };
}

/**
 * Decodes compressed COCO RLE counts into numeric run lengths.
 *
 * This mirrors pycocotools' compact ASCII representation: 5-bit chunks with a
 * continuation bit, sign extension, and delta coding after the first two runs.
 *
 * @param {string} counts Compressed counts string.
 * @returns {number[]}
 */
function decodeCompressedCounts(counts) {
  const runs = [];
  let pointer = 0;

  while (pointer < counts.length) {
    let x = 0;
    let shift = 0;
    let more = true;

    while (more) {
      let c = counts.charCodeAt(pointer) - 48;
      pointer += 1;
      // Low five bits carry payload; bit 0x20 says another character follows;
      // bit 0x10 sign-extends the final chunk.
      x |= (c & 0x1f) << (5 * shift);
      more = Boolean(c & 0x20);
      if (!more && (c & 0x10)) {
        x |= -1 << (5 * shift + 5);
      }
      shift += 1;
    }

    // COCO compresses counts[2:] as deltas against the value two runs earlier.
    if (runs.length > 2) {
      x += runs[runs.length - 2];
    }
    runs.push(x);
  }

  return runs;
}

/**
 * Tests whether a mask pixel touches the background or image edge.
 *
 * @param {Uint8Array} mask Row-major binary mask.
 * @param {number} maskWidth Mask width.
 * @param {number} maskHeight Mask height.
 * @param {number} x Pixel x coordinate.
 * @param {number} y Pixel y coordinate.
 * @returns {boolean}
 */
function isMaskBoundary(mask, maskWidth, maskHeight, x, y) {
  if (x === 0 || y === 0 || x === maskWidth - 1 || y === maskHeight - 1) {
    return true;
  }
  return (
    !mask[y * maskWidth + x - 1] ||
    !mask[y * maskWidth + x + 1] ||
    !mask[(y - 1) * maskWidth + x] ||
    !mask[(y + 1) * maskWidth + x]
  );
}

/**
 * Returns a fallback label anchor from the first simplified contour.
 *
 * @param {Array<Array<number[]>>} contours Normalized contours.
 * @returns {?number[]}
 */
function firstContourPoint(contours) {
  return contours && contours[0] && contours[0][0] ? contours[0][0] : null;
}

/**
 * Chooses a stable color for a numeric or string object ID.
 *
 * The first few numeric IDs use the hand-picked palette. Higher IDs are mapped
 * to generated HSL colors so projects with many tracked objects do not wrap
 * back to the same ten colors or risk indexing beyond the palette.
 *
 * @param {number|string} id Object ID.
 * @returns {number[]} RGB color triplet.
 */
function colorForId(id) {
  const index = colorIndexForId(id);
  if (index < palette.length) {
    return palette[index];
  }
  return generatedColorForIndex(index);
}

/**
 * Converts any object ID into a non-negative integer color index.
 *
 * @param {number|string} id Object ID.
 * @returns {number}
 */
function colorIndexForId(id) {
  const numericId = Number(id);
  const numeric = Number.isFinite(numericId) ? numericId : hashString(String(id));
  return Math.abs(Math.floor(numeric));
}

/**
 * Generates a readable RGB color for palette indices beyond the base palette.
 *
 * @param {number} index Non-negative color index.
 * @returns {number[]} RGB color triplet.
 */
function generatedColorForIndex(index) {
  const hue = (index * 0.618033988749895) % 1;
  return hslToRgb(hue, 0.68, 0.58);
}

/**
 * Converts HSL components in the 0..1 range to an RGB triplet.
 *
 * @param {number} h Hue.
 * @param {number} s Saturation.
 * @param {number} l Lightness.
 * @returns {number[]} RGB color triplet.
 */
function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    round(255 * hueToRgb(p, q, h + 1 / 3)),
    round(255 * hueToRgb(p, q, h)),
    round(255 * hueToRgb(p, q, h - 1 / 3)),
  ];
}

/**
 * Converts one HSL hue channel to RGB.
 *
 * @param {number} p Intermediate HSL value.
 * @param {number} q Intermediate HSL value.
 * @param {number} t Hue offset.
 * @returns {number}
 */
function hueToRgb(p, q, t) {
  let normalized = t;
  if (normalized < 0) {
    normalized += 1;
  }
  if (normalized > 1) {
    normalized -= 1;
  }
  if (normalized < 1 / 6) {
    return p + (q - p) * 6 * normalized;
  }
  if (normalized < 1 / 2) {
    return q;
  }
  if (normalized < 2 / 3) {
    return p + (q - p) * (2 / 3 - normalized) * 6;
  }
  return p;
}

/**
 * Hashes string IDs into deterministic integers for palette lookup.
 *
 * @param {string} value String to hash.
 * @returns {number}
 */
function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Extracts a display/export base name from a JSON filename.
 *
 * @param {string} filename Source filename.
 * @returns {string}
 */
function baseNameWithoutExtension(filename) {
  const name = String(filename || DEFAULT_INPUT_FILENAME).split(/[\\/]/).pop();
  return name.replace(/\.[^/.\\]+$/, "") || "input";
}

/**
 * Builds a GIF export filename using the current JSON source name.
 *
 * @returns {string}
 */
function gifExportFilename() {
  return `${sanitizeFilenameBase(baseNameWithoutExtension(sourceFileName))}_gif_${timestampForFilename(new Date())}.gif`;
}

/**
 * Converts arbitrary source names into safe export filename prefixes.
 *
 * @param {string} value Raw filename base.
 * @returns {string}
 */
function sanitizeFilenameBase(value) {
  return String(value)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "input";
}

/**
 * Formats a local timestamp as YYYYMMDDHHMM for export filenames.
 *
 * @param {Date} date Timestamp to format.
 * @returns {string}
 */
function timestampForFilename(date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
  ].join("");
}

/**
 * Pads a number to two digits.
 *
 * @param {number} value Number to format.
 * @returns {string}
 */
function pad2(value) {
  return String(value).padStart(2, "0");
}

/**
 * Infers sequence length when input JSON does not provide an explicit count.
 *
 * @param {object|Array} data Raw JSON.
 * @returns {number}
 */
function inferFrameCount(data) {
  let maxFrame = -1;

  if (data && data.objects && typeof data.objects === "object") {
    const objects = Array.isArray(data.objects) ? data.objects : Object.values(data.objects);
    for (const objectRecord of objects) {
      for (const key of Object.keys((objectRecord && objectRecord.frames) || {})) {
        const frameIndex = Number(key);
        if (Number.isInteger(frameIndex)) {
          maxFrame = max(maxFrame, frameIndex);
        }
      }
    }
  }

  const frameRecords = getFrameRecords(data);
  if (frameRecords.length) {
    maxFrame = max(maxFrame, frameRecords.length - 1);
  }

  return maxFrame + 1;
}

/**
 * Extends the frame array until frameIndex is valid.
 *
 * @param {Array<Array<object>>} frames Frame-indexed detection arrays.
 * @param {number} frameIndex Desired frame index.
 */
function ensureFrame(frames, frameIndex) {
  while (frames.length <= frameIndex) {
    frames.push([]);
  }
}

/**
 * Returns a positive number or a fallback.
 *
 * @param {*} value Candidate numeric value.
 * @param {number} fallback Fallback value.
 * @returns {number}
 */
function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Returns a positive integer or a fallback.
 *
 * @param {*} value Candidate integer value.
 * @param {number} fallback Fallback value.
 * @returns {number}
 */
function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

/**
 * Returns the first argument that is neither null nor undefined.
 *
 * @param {...*} values Candidate values.
 * @returns {*}
 */
function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}
