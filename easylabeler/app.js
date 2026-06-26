const mediaFolderInput = document.getElementById("mediaFolder");
const stage = document.getElementById("stage");
const video = document.getElementById("video");
const imageFrame = document.getElementById("imageFrame");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const copyNextFrameButton = document.getElementById("copyNextFrame");
const jumpStartButton = document.getElementById("jumpStart");
const deckPlayButton = document.getElementById("deckPlay");
const deckPrevFrameButton = document.getElementById("deckPrevFrame");
const deckNextFrameButton = document.getElementById("deckNextFrame");
const jumpEndButton = document.getElementById("jumpEnd");
const frameInput = document.getElementById("frameInput");
const timeDisplay = document.getElementById("timeDisplay");
const frameProgress = document.getElementById("frameProgress");
const frameProgressFill = document.getElementById("frameProgressFill");
const frameProgressMarker = document.getElementById("frameProgressMarker");
const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
const classInput = document.getElementById("classInput");
const labelInput = document.getElementById("labelInput");
const onionEnabledInput = document.getElementById("onionEnabled");
const excludeFrameInput = document.getElementById("excludeFrame");
const annotationList = document.getElementById("annotationList");
const exportButton = document.getElementById("exportJson");
const clearFrameButton = document.getElementById("clearFrame");
const clearAllButton = document.getElementById("clearAll");

/**
 * @typedef {Object} Annotation
 * @property {string} id
 * @property {"point"|"bbox"|"shape"} type
 * @property {string} class Object/category name shared by related part labels.
 * @property {string} label
 * @property {number} frame
 * @property {number=} time Present for video annotations, omitted for image batches.
 * @property {number=} x Point/box x coordinate in intrinsic media pixels.
 * @property {number=} y Point/box y coordinate in intrinsic media pixels.
 * @property {number=} width Box width in intrinsic media pixels.
 * @property {number=} height Box height in intrinsic media pixels.
 * @property {{x:number,y:number,nx:number,ny:number}[]=} points Shape vertices.
 * @property {string|null=} track_id Optional identity used by downstream tracking/model code.
 * @property {number=} confidence Manual annotations default to 1.0.
 * @property {string=} visibility Manual annotations default to "visible".
 * @property {string=} source Manual annotations default to "manual".
 */

let sourceFilename = "";
let sourceUrl = "";
let sourceVideoPath = "";
let sourceImageFolder = "";
/** @type {"none"|"video"|"images"} */
let mediaMode = "none";
let imageFrames = [];
let imageFrameIndex = 0;
// Videos are seeked by time, but the app's annotation state uses frame numbers.
let currentVideoFrameIndex = 0;
/** @type {Annotation[]} */
let annotations = [];
let excludedFrames = new Set();
let nextAnnotationNumber = 1;
let selectedAnnotationId = null;
let dragState = null;
let draftBox = null;
let draftPoint = null;
let draftShape = null;
let undoStack = [];
let rafId = null;
let videoFramePlaybackRafId = null;
let videoFramePlaybackLastTime = null;
let imagePlaybackRafId = null;
let imagePlaybackLastTime = null;
let lastAnnotationListFrame = null;
let preserveAnnotationsOnNextVideoOpen = false;
let preserveAnnotationsOnNextImageFolderOpen = false;
let projectFPS = 30;
const DEFAULT_CLASS_NAME = "myCategory";
const MANUAL_ANNOTATION_EXPORT_FIELDS = {
  track_id: null,
  confidence: 1.0,
  visibility: "visible",
  source: "manual"
};

function getFPS() {
  return projectFPS;
}

/**
 * Returns the app's logical frame index, not the browser's raw video time.
 * This keeps annotation frame numbers stable while MP4 seeking settles.
 */
function getCurrentFrame() {
  if (mediaMode === "images") return imageFrameIndex;
  if (mediaMode === "video") return currentVideoFrameIndex;
  return 0;
}

/** Returns the annotation/export timestamp for the current logical frame. */
function getCurrentMediaTime() {
  if (mediaMode === "images") return imageFrameIndex / getFPS();
  if (mediaMode === "video") return currentVideoFrameIndex / getFPS();
  return 0;
}

/** Returns the largest valid zero-based frame index for the loaded media. */
function getMaxFrame() {
  if (mediaMode === "images") return Math.max(0, imageFrames.length - 1);
  if (!Number.isFinite(video.duration)) return 0;
  return Math.max(0, Math.round(video.duration * getFPS()) - 1);
}

function getCurrentTimeForFrame(frame) {
  return frame / getFPS();
}

/**
 * Browser video seeks are time-based and can be ambiguous at exact frame
 * boundaries. Seeking to the middle of the desired frame makes frame stepping
 * match the decoded-frame tests much more reliably.
 */
function getSeekTimeForFrame(frame) {
  const fps = getFPS();
  const midpointTime = (frame + 0.5) / fps;
  if (!Number.isFinite(video.duration)) return frame / fps;
  return Math.min(midpointTime, Math.max(0, video.duration - 0.001));
}

function currentFrameAnnotations() {
  const frame = getCurrentFrame();
  return annotations.filter((ann) => ann.frame === frame);
}

function getMediaWidth() {
  if (mediaMode === "images") return imageFrames[imageFrameIndex]?.width || imageFrame.naturalWidth || 0;
  return video.videoWidth || 0;
}

function getMediaHeight() {
  if (mediaMode === "images") return imageFrames[imageFrameIndex]?.height || imageFrame.naturalHeight || 0;
  return video.videoHeight || 0;
}

/** Loads one browser-selected video file and resets per-project UI state. */
function loadVideo(file) {
  if (!file) return;
  stopAllPlaybackLoops();
  revokeObjectSources();

  const shouldPreserveAnnotations =
    preserveAnnotationsOnNextVideoOpen && (!sourceFilename || file.name === sourceFilename);

  mediaMode = "video";
  currentVideoFrameIndex = 0;
  sourceFilename = file.name;
  sourceVideoPath = file.name;
  sourceImageFolder = "";
  sourceUrl = URL.createObjectURL(file);
  if (!shouldPreserveAnnotations) {
    annotations = [];
    excludedFrames = new Set();
    nextAnnotationNumber = 1;
    projectFPS = 30;
    undoStack = [];
  }
  selectedAnnotationId = null;
  draftBox = null;
  draftPoint = null;
  draftShape = null;
  setMode("select");
  resetClassAndLabelFields();
  preserveAnnotationsOnNextVideoOpen = false;

  imageFrame.removeAttribute("src");
  video.src = sourceUrl;
  video.load();
  stage.classList.add("has-video", "video-mode");
  stage.classList.remove("image-mode");
  video.loop = false;
  updateDisplays();
  renderAnnotationList();
}

/**
 * Loads a folder containing one or more videos and optional JSON project files.
 * If possible, the JSON metadata chooses which video belongs to the project.
 */
async function loadVideoFolder(fileList) {
  const allFiles = Array.from(fileList || []);
  const videoFiles = allFiles
    .filter(isVideoFile)
    .sort((a, b) => getFilePath(a).localeCompare(getFilePath(b), undefined, { numeric: true }));
  const jsonFiles = allFiles
    .filter(isJSONFile)
    .sort((a, b) => getJSONProjectPriority(a, videoFiles[0]) - getJSONProjectPriority(b, videoFiles[0]));

  if (!videoFiles.length) {
    window.alert("No MP4 or video file found in that folder.");
    return;
  }

  const parsedProjects = await parseJSONProjectFiles(jsonFiles);
  const videoFile = chooseVideoFileForProjects(videoFiles, parsedProjects);
  if (!videoFile) return;
  loadVideo(videoFile);
  await waitForVideoMetadata();

  const project = findCompatibleVideoProject(parsedProjects, videoFile);
  if (project) {
    applyVideoProjectPayload(project.payload);
    sourceFilename = videoFile.name;
    sourceVideoPath = getFilePath(videoFile);
    warnIfVideoMetadataDiffers(project.payload.metadata || {});
    updateDisplays();
    draw();
    renderAnnotationList();
  }
}

/** Chooses video mode or image-sequence mode from a selected folder. */
async function loadMediaFolder(fileList) {
  const allFiles = Array.from(fileList || []);
  const videoFiles = allFiles.filter(isVideoFile);
  const imageFiles = allFiles.filter(isImageFile);

  if (videoFiles.length) {
    await loadVideoFolder(allFiles);
    return;
  }

  if (imageFiles.length) {
    await loadImageFolder(allFiles);
    return;
  }

  window.alert("No video or image files found in that folder.");
}

function waitForVideoMetadata() {
  if (video.videoWidth && video.videoHeight) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      video.removeEventListener("error", done);
      resolve();
    };
    video.addEventListener("loadedmetadata", done, { once: true });
    video.addEventListener("error", done, { once: true });
  });
}

/**
 * Loads a flat directory of images as sequential frames, sorted naturally by
 * file path, and restores compatible image-batch JSON when present.
 */
async function loadImageFolder(fileList) {
  const allFiles = Array.from(fileList || []);
  const files = allFiles
    .filter(isImageFile)
    .sort((a, b) => getFilePath(a).localeCompare(getFilePath(b), undefined, { numeric: true }));
  const jsonFiles = allFiles
    .filter(isJSONFile)
    .sort((a, b) => getJSONProjectPriority(a, files[0]) - getJSONProjectPriority(b, files[0]));

  if (!files.length) {
    window.alert("No image files found in that folder.");
    return;
  }

  stopAllPlaybackLoops();
  revokeObjectSources();

  mediaMode = "images";
  video.pause();
  video.removeAttribute("src");
  video.load();

  sourceFilename = getFolderName(files[0]) || "image_folder";
  const shouldPreserveAnnotations =
    preserveAnnotationsOnNextImageFolderOpen && (!sourceImageFolder || sourceFilename === sourceImageFolder);
  sourceVideoPath = "";
  sourceImageFolder = sourceFilename;
  if (!shouldPreserveAnnotations) {
    annotations = [];
    excludedFrames = new Set();
    nextAnnotationNumber = 1;
    projectFPS = 30;
    undoStack = [];
  }
  selectedAnnotationId = null;
  draftBox = null;
  draftPoint = null;
  draftShape = null;
  imageFrameIndex = 0;
  setMode("select");
  resetClassAndLabelFields();
  preserveAnnotationsOnNextImageFolderOpen = false;

  try {
    imageFrames = await Promise.all(
      files.map(async (file, index) => {
        const url = URL.createObjectURL(file);
        const dimensions = await loadImageDimensions(url);
        return {
          index,
          file,
          name: file.name,
          path: getFilePath(file),
          url,
          width: dimensions.width,
          height: dimensions.height
        };
      })
    );
  } catch (error) {
    window.alert("Could not load one or more images from that folder.");
    revokeImageSources();
    mediaMode = "none";
    return;
  }

  stage.classList.add("has-video", "image-mode");
  stage.classList.remove("video-mode");
  if (!shouldPreserveAnnotations) {
    await loadCompatibleImageJSONFromFolder(jsonFiles);
  }
  showImageFrame(0);
}

function revokeObjectSources() {
  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
    sourceUrl = "";
  }
  revokeImageSources();
}

function revokeImageSources() {
  imageFrames.forEach((frame) => URL.revokeObjectURL(frame.url));
  imageFrames = [];
  imageFrame.removeAttribute("src");
}

function loadVideoPath(path) {
  return new Promise((resolve, reject) => {
    if (!path) {
      reject(new Error("Missing video path."));
      return;
    }

    stopAllPlaybackLoops();
    revokeObjectSources();

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      stage.classList.add("has-video");
      resizeCanvasToVideo();
      updateDisplays();
      renderAnnotationList();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Could not load linked video: ${path}`));
    };

    sourceVideoPath = path;
    sourceFilename = path.split("/").pop() || sourceFilename;
    sourceImageFolder = "";
    mediaMode = "video";
    currentVideoFrameIndex = 0;
    stage.classList.add("video-mode");
    stage.classList.remove("image-mode");
    video.loop = false;
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.src = path;
    video.load();
  });
}

function resizeCanvasToVideo() {
  resizeCanvasToMedia();
}

function resizeCanvasToMedia() {
  const width = getMediaWidth();
  const height = getMediaHeight();
  if (!width || !height) return;
  canvas.width = width;
  canvas.height = height;
  refreshNormalizedCoordinates();
  draw();
}

function showImageFrame(frame) {
  if (mediaMode !== "images" || !imageFrames.length) return;
  imageFrameIndex = clamp(Math.round(Number(frame) || 0), 0, imageFrames.length - 1);
  const current = imageFrames[imageFrameIndex];
  if (imageFrame.src !== current.url) {
    imageFrame.src = current.url;
  }
  resizeCanvasToMedia();
  updateDisplays();
  renderAnnotationList();
}

function loadImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(file.name);
}

function isVideoFile(file) {
  return file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|ogg)$/i.test(file.name);
}

function isJSONFile(file) {
  return file.type === "application/json" || /\.json$/i.test(file.name);
}

function getFilePath(file) {
  return file.webkitRelativePath || file.name;
}

function getFolderName(file) {
  const path = getFilePath(file);
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "";
}

function getJSONProjectPriority(file, firstImageFile) {
  const folder = firstImageFile ? getFolderName(firstImageFile) : "";
  const expected = folder ? `${folder}_annotations.json` : "";
  if (file.name === expected) return 0;
  if (/_annotations\.json$/i.test(file.name)) return 1;
  return 2;
}

async function parseJSONProjectFiles(jsonFiles) {
  const projects = [];
  for (const file of jsonFiles) {
    try {
      const payload = JSON.parse(await file.text());
      if (payload && (Array.isArray(payload.annotations) || Array.isArray(payload.images))) {
        projects.push({ file, payload });
      }
    } catch (error) {
      // Ignore non-project JSON files in the folder.
    }
  }
  return projects;
}

function chooseVideoFileForProjects(videoFiles, projects) {
  const matchedVideos = projects
    .filter((project) => !(project.payload.metadata?.media_type === "images" || Array.isArray(project.payload.images)))
    .map((project) => getVideoFilenameFromMetadata(project.payload.metadata || {}))
    .filter(Boolean)
    .map((filename) => videoFiles.find((file) => file.name === filename))
    .filter(Boolean);

  const uniqueMatches = [...new Map(matchedVideos.map((file) => [file.name, file])).values()];
  if (uniqueMatches.length === 1) return uniqueMatches[0];
  if (videoFiles.length === 1) return videoFiles[0];

  return promptForVideoFile(videoFiles);
}

function promptForVideoFile(videoFiles) {
  const list = videoFiles
    .map((file, index) => `${index + 1}. ${getFilePath(file)}`)
    .join("\n");
  const answer = window.prompt(`Multiple videos found. Enter the number to load:\n\n${list}`);
  if (answer === null) return null;

  const index = Number.parseInt(answer, 10) - 1;
  if (index >= 0 && index < videoFiles.length) {
    return videoFiles[index];
  }

  window.alert("No valid video selected.");
  return null;
}

function findCompatibleVideoProject(projects, videoFile) {
  const videoName = videoFile.name;
  return projects.find(({ payload }) => {
    if (payload.metadata?.media_type === "images" || Array.isArray(payload.images)) return false;
    const filename = getVideoFilenameFromMetadata(payload.metadata || {});
    return filename ? filename === videoName : projects.length === 1;
  });
}

function getVideoFilenameFromMetadata(metadata) {
  const source = metadata.source_filename || metadata.source_video_path || metadata.source_url || metadata.video_path || "";
  return basename(source);
}

function applyVideoProjectPayload(payload) {
  const metadata = payload.metadata || {};
  if (Number(metadata.fps) > 0) {
    projectFPS = Math.max(1, Number(metadata.fps));
  }

  annotations = getImportedAnnotations(payload).map(normalizeImportedAnnotation);
  excludedFrames = getImportedExcludedFrames(payload);
  selectedAnnotationId = null;
  nextAnnotationNumber = getNextAnnotationNumberFrom(annotations);
  undoStack = [];
}

async function loadCompatibleImageJSONFromFolder(jsonFiles) {
  for (const file of jsonFiles) {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (error) {
      continue;
    }

    if (!isCompatibleImageProject(payload)) continue;
    applyImageProjectPayload(payload);
    sourceFilename = payload.metadata?.source_filename || sourceFilename;
    sourceImageFolder = payload.metadata?.image_folder || sourceImageFolder;
    return true;
  }
  return false;
}

function isCompatibleImageProject(payload) {
  if (!payload || !Array.isArray(payload.images)) return false;
  const loadedNames = new Set(imageFrames.map((frame) => frame.name));
  const jsonNames = payload.images
    .map((image) => image.filename || basename(image.path || ""))
    .filter(Boolean);

  if (!jsonNames.length) return false;
  return jsonNames.every((name) => loadedNames.has(name));
}

function applyImageProjectPayload(payload) {
  const metadata = payload.metadata || {};
  if (Number(metadata.fps) > 0) {
    projectFPS = Math.max(1, Number(metadata.fps));
  }

  annotations = getImportedAnnotations(payload).map(normalizeImportedAnnotation);
  excludedFrames = getImportedExcludedFrames(payload);
  selectedAnnotationId = null;
  nextAnnotationNumber = getNextAnnotationNumberFrom(annotations);
  undoStack = [];
}

function basename(path) {
  return String(path).split("/").pop();
}

/**
 * Converts intrinsic media pixels to displayed canvas CSS pixels.
 * Annotation data is always stored in intrinsic media coordinates.
 */
function videoToCanvas(point) {
  const rect = canvas.getBoundingClientRect();
  const width = getMediaWidth();
  const height = getMediaHeight();
  return {
    x: (point.x / width) * rect.width,
    y: (point.y / height) * rect.height
  };
}

/**
 * Converts a pointer event on the displayed canvas into intrinsic video/image
 * coordinates, clamped to the visible media bounds.
 */
function canvasToVideo(event) {
  const rect = canvas.getBoundingClientRect();
  const width = getMediaWidth();
  const height = getMediaHeight();
  // Mouse and touch positions are displayed CSS pixels; annotation data uses
  // the intrinsic video pixel grid stored in canvas.width/canvas.height.
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * width, 0, width),
    y: clamp(((event.clientY - rect.top) / rect.height) * height, 0, height)
  };
}

/** Adds a point annotation on the current frame at intrinsic media coordinates. */
function addPoint(x, y) {
  pushUndoState();
  const frame = getCurrentFrame();
  const width = getMediaWidth();
  const height = getMediaHeight();
  const ann = {
    id: nextId(),
    type: "point",
    class: getClassName(),
    label: getLabel(),
    ...MANUAL_ANNOTATION_EXPORT_FIELDS,
    frame,
    time: getCurrentTimeForFrame(frame),
    x: roundCoord(x),
    y: roundCoord(y),
    nx: roundNorm(x / width),
    ny: roundNorm(y / height)
  };
  annotations.push(ann);
  selectedAnnotationId = ann.id;
  draw();
  renderAnnotationList();
}

/** Adds a bounding box annotation, normalizing drag direction into x/y/width/height. */
function addBox(x, y, width, height) {
  if (Math.abs(width) < 3 || Math.abs(height) < 3) return;

  pushUndoState();
  const mediaWidth = getMediaWidth();
  const mediaHeight = getMediaHeight();
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const boxWidth = Math.abs(width);
  const boxHeight = Math.abs(height);
  const frame = getCurrentFrame();
  const ann = {
    id: nextId(),
    type: "bbox",
    class: getClassName(),
    label: getLabel(),
    ...MANUAL_ANNOTATION_EXPORT_FIELDS,
    frame,
    time: getCurrentTimeForFrame(frame),
    x: roundCoord(left),
    y: roundCoord(top),
    width: roundCoord(boxWidth),
    height: roundCoord(boxHeight),
    nx: roundNorm(left / mediaWidth),
    ny: roundNorm(top / mediaHeight),
    nwidth: roundNorm(boxWidth / mediaWidth),
    nheight: roundNorm(boxHeight / mediaHeight)
  };
  annotations.push(ann);
  selectedAnnotationId = ann.id;
  draw();
  renderAnnotationList();
}

/** Adds a closed polyline shape annotation from the current draft vertices. */
function addShape(points) {
  if (!points || points.length < 3) return;

  pushUndoState();
  const frame = getCurrentFrame();
  const ann = {
    id: nextId(),
    type: "shape",
    class: getClassName(),
    label: getLabel(),
    ...MANUAL_ANNOTATION_EXPORT_FIELDS,
    frame,
    time: getCurrentTimeForFrame(frame),
    points: points.map(normalizeShapePoint)
  };
  annotations.push(ann);
  selectedAnnotationId = ann.id;
  draw();
  renderAnnotationList();
}

function normalizeShapePoint(point) {
  const width = getMediaWidth();
  const height = getMediaHeight();
  const x = roundCoord(width ? clamp(Number(point.x) || 0, 0, width) : Number(point.x) || 0);
  const y = roundCoord(height ? clamp(Number(point.y) || 0, 0, height) : Number(point.y) || 0);
  return {
    x,
    y,
    nx: roundNorm(width ? x / width : Number(point.nx) || 0),
    ny: roundNorm(height ? y / height : Number(point.ny) || 0)
  };
}

/** Adds a shape vertex, or closes the draft if the click is near the first vertex. */
function handleShapeClick(point) {
  const frame = getCurrentFrame();
  if (!draftShape || draftShape.frame !== frame) {
    draftShape = { frame, points: [] };
  }

  const first = draftShape.points[0];
  if (first && draftShape.points.length >= 3 && distance(first, point) <= 16) {
    addShape(draftShape.points);
    draftShape = null;
    draw();
    return;
  }

  draftShape.points.push({ x: point.x, y: point.y });
  draw();
}

/** Duplicates all current-frame annotations onto the next frame with fresh IDs. */
function copyCurrentAnnotationsToNextFrame() {
  if (!getMediaWidth()) return;
  const frame = getCurrentFrame();
  const targetFrame = clamp(frame + 1, 0, getMaxFrame());
  if (targetFrame === frame) return;

  const copies = currentFrameAnnotations().map((ann) => cloneAnnotationForFrame(ann, targetFrame));
  if (!copies.length) return;
  pushUndoState();
  annotations.push(...copies);
  selectedAnnotationId = copies.length ? copies[copies.length - 1].id : null;
  seekToFrame(targetFrame);
  renderAnnotationList();
}

/** Redraws all visible annotations and drafts for the current logical frame. */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!getMediaWidth() || !getMediaHeight()) return;

  const frame = getCurrentFrame();

  if (onionEnabledInput.checked) {
    annotations.forEach((ann) => {
      if (ann.frame === frame - 1) {
        drawAnnotation(ann, 0.3, false);
      }
    });
  }

  annotations.forEach((ann) => {
    if (ann.frame === frame) {
      drawAnnotation(ann, 1, ann.id === selectedAnnotationId);
    }
  });

  if (draftBox) {
    drawBox(draftBox.x, draftBox.y, draftBox.width, draftBox.height, "rgba(20, 184, 166, 0.95)", true);
  }

  if (draftPoint) {
    drawDraftPoint(draftPoint.x, draftPoint.y);
  }

  if (draftShape?.frame === frame) {
    drawDraftShape(draftShape.points);
  }

  if (excludedFrames.has(frame)) {
    drawExcludedFrameOverlay();
  }
}

function drawExcludedFrameOverlay() {
  ctx.save();
  ctx.strokeStyle = "rgba(220, 38, 38, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.moveTo(canvas.width, 0);
  ctx.lineTo(0, canvas.height);
  ctx.stroke();
  ctx.restore();
}

function drawAnnotation(ann, opacity, selected) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeStyle = selected ? "#f97316" : "#14b8a6";
  ctx.fillStyle = selected ? "rgba(249, 115, 22, 0.6)" : "#14b8a6";

  if (ann.type === "point") {
    ctx.beginPath();
    ctx.arc(ann.x, ann.y, selected ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    drawLabel(ann.label, ann.x + 8, ann.y - 8);
  } else if (ann.type === "bbox") {
    drawBox(ann.x, ann.y, ann.width, ann.height, ctx.strokeStyle, selected);
    drawLabel(ann.label, ann.x, ann.y - 8);
  } else if (ann.type === "shape") {
    drawShape(ann, ctx.strokeStyle, selected);
    const first = ann.points[0];
    if (first) drawLabel(ann.label, first.x, first.y - 8);
  }

  ctx.restore();
}

function drawShape(ann, color, selected) {
  if (!ann.points?.length) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = selected ? "rgba(249, 115, 22, 0.08)" : "rgba(20, 184, 166, 0.08)";
  ctx.lineWidth = selected ? 2 : 1.5;
  drawClosedPath(ann.points);
  ctx.fill();
  ctx.stroke();

  if (selected) {
    ann.points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.45)";
      ctx.fill();
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawDraftShape(points) {
  if (!points.length) return;
  ctx.save();
  ctx.strokeStyle = "#14b8a6";
  ctx.fillStyle = "rgba(20, 184, 166, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.stroke();
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 0 ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawClosedPath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function drawBox(x, y, width, height, color, selected) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.strokeRect(x, y, width, height);

  if (selected) {
    ctx.lineWidth = 2;
    getBoxHandles({ x, y, width, height }).forEach((handle) => {
      drawResizeCornerTick(handle.x, handle.y, handle.name, color);
    });
  }
  ctx.restore();
}

function drawResizeCornerTick(x, y, name, color) {
  const size = 9;
  const sx = name.includes("w") ? 1 : -1;
  const sy = name.includes("n") ? 1 : -1;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + sy * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + sx * size, y);
  ctx.stroke();
}

function drawDraftPoint(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(20, 184, 166, 0.55)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLabel(label, x, y) {
  const text = String(label || "");
  if (!text) return;
  ctx.save();
  ctx.font = "14px system-ui, sans-serif";
  const padding = 4;
  const metrics = ctx.measureText(text);
  const boxWidth = metrics.width + padding * 2;
  const boxHeight = 20;
  const left = clamp(x, 0, Math.max(0, getMediaWidth() - boxWidth));
  const top = clamp(y - boxHeight, 0, Math.max(0, getMediaHeight() - boxHeight));
  ctx.fillStyle = "rgba(17, 24, 39, 0.78)";
  ctx.fillRect(left, top, boxWidth, boxHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, left + padding, top + 14);
  ctx.restore();
}

/** Selects the topmost current-frame annotation hit by an intrinsic media point. */
function selectAnnotation(point) {
  const hits = currentFrameAnnotations().filter((ann) => hitTest(ann, point));
  setSelectedAnnotation(hits.length ? hits[hits.length - 1].id : null);
  draw();
  renderAnnotationList();
  return getSelectedAnnotation();
}

function deleteAnnotation(id = selectedAnnotationId) {
  if (!id) return;
  pushUndoState();
  annotations = annotations.filter((ann) => ann.id !== id);
  if (selectedAnnotationId === id) selectedAnnotationId = null;
  draw();
  renderAnnotationList();
}

/** Saves a compact snapshot before a mutating annotation operation. */
function pushUndoState() {
  undoStack.push({
    annotations: annotations.map(cloneAnnotation),
    excludedFrames: getSortedExcludedFrames(),
    selectedAnnotationId,
    nextAnnotationNumber
  });
  if (undoStack.length > 100) {
    undoStack.shift();
  }
}

/** Restores the most recent annotation snapshot. */
function undoLastAction() {
  const state = undoStack.pop();
  if (!state) return;
  annotations = state.annotations.map(cloneAnnotation);
  excludedFrames = new Set(state.excludedFrames || []);
  selectedAnnotationId = state.selectedAnnotationId;
  nextAnnotationNumber = state.nextAnnotationNumber;
  clearDraftAnnotation();
  populateFieldsFromSelectedAnnotation();
  updateDisplays();
  draw();
  renderAnnotationList();
}

function updateAnnotationGeometry(ann) {
  const width = getMediaWidth();
  const height = getMediaHeight();
  if (ann.type === "point") {
    ann.x = roundCoord(clamp(ann.x, 0, width));
    ann.y = roundCoord(clamp(ann.y, 0, height));
    ann.nx = roundNorm(ann.x / width);
    ann.ny = roundNorm(ann.y / height);
  } else if (ann.type === "bbox") {
    normalizeBox(ann, dragState?.action === "moveBox");
    ann.nx = roundNorm(ann.x / width);
    ann.ny = roundNorm(ann.y / height);
    ann.nwidth = roundNorm(ann.width / width);
    ann.nheight = roundNorm(ann.height / height);
  } else if (ann.type === "shape") {
    ann.points = ann.points.map(normalizeShapePoint);
  }
}

function refreshNormalizedCoordinates() {
  const width = getMediaWidth();
  const height = getMediaHeight();
  if (!width || !height) return;
  const frame = getCurrentFrame();
  annotations.forEach((ann) => {
    if (mediaMode === "images" && ann.frame !== frame) return;
    if (ann.type === "shape") {
      ann.points = ann.points.map(normalizeShapePoint);
      return;
    }
    ann.nx = roundNorm(ann.x / width);
    ann.ny = roundNorm(ann.y / height);
    if (ann.type === "bbox") {
      ann.nwidth = roundNorm(ann.width / width);
      ann.nheight = roundNorm(ann.height / height);
    }
  });
}

/** Rebuilds the side-panel list for annotations on the current frame only. */
function renderAnnotationList() {
  lastAnnotationListFrame = getCurrentFrame();
  annotationList.innerHTML = "";
  const anns = currentFrameAnnotations();
  if (!anns.length) {
    const empty = document.createElement("li");
    empty.className = "empty-list";
    empty.textContent = "No annotations on this frame.";
    annotationList.appendChild(empty);
    return;
  }

  anns.forEach((ann) => {
    const item = document.createElement("li");
    if (ann.id === selectedAnnotationId) item.classList.add("selected");

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${ann.class || DEFAULT_CLASS_NAME}: ${ann.label} (${ann.type})`;
    const coords = document.createElement("span");
    coords.textContent = describeAnnotation(ann);
    details.append(title, coords);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-ann";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAnnotation(ann.id);
    });

    item.addEventListener("click", () => {
      setSelectedAnnotation(ann.id);
      draw();
      renderAnnotationList();
    });
    item.append(details, deleteButton);
    annotationList.appendChild(item);
  });
}

/** Exports the current project as downloadable JSON. */
function exportJSON() {
  const payload = {
    metadata: {
      source_filename: sourceFilename || "",
      source_video_path: sourceVideoPath || sourceFilename || "",
      media_type: mediaMode,
      image_folder: sourceImageFolder || "",
      image_count: imageFrames.length || 0,
      media_width: getMediaWidth(),
      media_height: getMediaHeight(),
      video_width: getMediaWidth(),
      video_height: getMediaHeight(),
      fps: getFPS(),
      created_with: "minimal-media-annotator"
    },
    excluded_frames: getSortedExcludedFrames()
  };

  if (mediaMode === "images") {
    payload.images = buildImageExportEntries();
  } else {
    payload.annotations = getSortedAnnotations().map(cleanAnnotationForExport);
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = sourceFilename ? sourceFilename.replace(/\.[^.]+$/, "") : "annotations";
  link.href = url;
  link.download = `${baseName}_annotations.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Builds image-batch JSON with filenames grouped beside each frame's annotations. */
function buildImageExportEntries() {
  return imageFrames.map((image) => ({
    frame: image.index,
    filename: image.name,
    path: image.path,
    width: image.width,
    height: image.height,
    annotations: getSortedAnnotations()
      .filter((ann) => ann.frame === image.index)
      .map(cleanImageAnnotationForExport)
  }));
}

function getSortedAnnotations() {
  return annotations
    .slice()
    .sort((a, b) => a.frame - b.frame || a.id.localeCompare(b.id));
}

function getSortedExcludedFrames() {
  return Array.from(excludedFrames).sort((a, b) => a - b);
}

/** Removes UI-only fields and rounds geometry before writing JSON. */
function cleanAnnotationForExport(ann) {
  const copy = cloneAnnotation(ann);
  addDefaultClassField(copy);
  addManualAnnotationTrainingFields(copy);
  delete copy.image_filename;
  delete copy.image_path;
  return copy;
}

/** Ensures every exported annotation has a class/category field. */
function addDefaultClassField(ann) {
  if (!hasOwn(ann, "class") || String(ann.class).trim() === "") {
    ann.class = DEFAULT_CLASS_NAME;
  }
}

/** Adds default model-training metadata for manual annotations. */
function addManualAnnotationTrainingFields(ann) {
  if (!hasOwn(ann, "track_id")) ann.track_id = MANUAL_ANNOTATION_EXPORT_FIELDS.track_id;
  if (!hasOwn(ann, "confidence")) ann.confidence = MANUAL_ANNOTATION_EXPORT_FIELDS.confidence;
  if (!hasOwn(ann, "visibility")) ann.visibility = MANUAL_ANNOTATION_EXPORT_FIELDS.visibility;
  if (!hasOwn(ann, "source")) ann.source = MANUAL_ANNOTATION_EXPORT_FIELDS.source;
}

/** Image annotations do not carry video timestamps. */
function cleanImageAnnotationForExport(ann) {
  const copy = cleanAnnotationForExport(ann);
  delete copy.time;
  return copy;
}

/** Applies a standalone project JSON file when called by an import path. */
async function openJSONFile(file) {
  if (!file) return;

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch (error) {
    window.alert("Could not read that JSON file.");
    return;
  }

  if (!payload || (!Array.isArray(payload.annotations) && !Array.isArray(payload.images))) {
    window.alert("That JSON file does not look like an annotation project.");
    return;
  }

  const metadata = payload.metadata || {};
  if (Number(metadata.fps) > 0) {
    projectFPS = Math.max(1, Number(metadata.fps));
  }

  annotations = getImportedAnnotations(payload).map(normalizeImportedAnnotation);
  excludedFrames = getImportedExcludedFrames(payload);
  selectedAnnotationId = null;
  nextAnnotationNumber = getNextAnnotationNumberFrom(annotations);
  undoStack = [];
  const isImageProject = metadata.media_type === "images" || Array.isArray(payload.images);
  sourceFilename = metadata.source_filename || metadata.image_folder || sourceFilename;
  sourceVideoPath = metadata.source_video_path || metadata.source_url || metadata.video_path || sourceFilename;
  sourceImageFolder = metadata.image_folder || sourceImageFolder;

  updateDisplays();
  draw();
  renderAnnotationList();

  if (isImageProject) {
    preserveAnnotationsOnNextImageFolderOpen = true;
    window.alert("Annotations were loaded. Use Open Media Folder to choose the matching image folder.");
    return;
  }

  const loaded = await loadLinkedVideoFromMetadata(metadata);
  if (!loaded) {
    preserveAnnotationsOnNextVideoOpen = true;
    window.alert(
      "Annotations were loaded, but the linked MP4 could not be opened automatically. Open the MP4 manually, or keep the MP4 at the JSON metadata source_video_path when using a local server."
    );
  }
}

async function loadLinkedVideoFromMetadata(metadata) {
  const filename = metadata.source_filename || "";
  const sourcePath = metadata.source_video_path || metadata.source_url || metadata.video_path || "";
  const candidates = [
    sourcePath,
    filename,
    ...getProjectVideoPathCandidates(sourcePath || filename),
    ...getProjectVideoPathCandidates(filename)
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    try {
      await loadVideoPath(candidate);
      warnIfVideoMetadataDiffers(metadata);
      return true;
    } catch (error) {
      // Try the next project-relative path.
    }
  }
  return false;
}

function getProjectVideoPathCandidates(pathOrFilename) {
  if (!pathOrFilename) return [];
  const filename = pathOrFilename.split("/").pop();
  const stemPrefix = filename.split("_")[0];
  const candidates = [
    `media/${filename}`,
    `media/video/${filename}`
  ];

  if (stemPrefix && stemPrefix !== filename) {
    candidates.push(
      `media/${stemPrefix}/${filename}`,
      `media/video/${stemPrefix}/${filename}`
    );
  }

  return candidates;
}

function getImportedAnnotations(payload) {
  if (Array.isArray(payload.annotations)) {
    return payload.annotations;
  }

  return payload.images.flatMap((image, index) => {
    const frame = Math.round(Number(image.frame ?? index) || 0);
    return (image.annotations || []).map((ann) => ({
      ...ann,
      frame,
      image_filename: image.filename || "",
      image_path: image.path || image.filename || ""
    }));
  });
}

function getImportedExcludedFrames(payload) {
  if (!Array.isArray(payload.excluded_frames)) return new Set();
  return new Set(
    payload.excluded_frames
      .map((frame) => Math.round(Number(frame)))
      .filter((frame) => Number.isFinite(frame) && frame >= 0)
  );
}

function normalizeImportedAnnotation(ann) {
  const copy = { ...ann };
  copy.id = copy.id || nextId();
  copy.type = ["point", "bbox", "shape"].includes(copy.type) ? copy.type : "point";
  copy.class = String(copy.class || DEFAULT_CLASS_NAME);
  copy.label = copy.label || getDefaultLabelForMode(copy.type);
  copy.frame = Math.round(Number(copy.frame) || 0);
  copy.time = Number(copy.time) || getCurrentTimeForFrame(copy.frame);

  if (copy.type === "shape") {
    copy.points = (copy.points || []).map(normalizeShapePoint);
  } else {
    copy.x = roundCoord(Number(copy.x) || 0);
    copy.y = roundCoord(Number(copy.y) || 0);
  }

  if (copy.type === "bbox") {
    copy.width = roundCoord(Number(copy.width) || 1);
    copy.height = roundCoord(Number(copy.height) || 1);
  }

  return copy;
}

function getNextAnnotationNumberFrom(items) {
  const maxNumber = items.reduce((max, ann) => {
    const match = String(ann.id || "").match(/^ann_(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return maxNumber + 1;
}

function warnIfVideoMetadataDiffers(metadata) {
  const width = Number(metadata.media_width || metadata.video_width) || 0;
  const height = Number(metadata.media_height || metadata.video_height) || 0;
  if (!width || !height) return;
  if (!getMediaWidth() || !getMediaHeight()) return;
  if (getMediaWidth() === width && getMediaHeight() === height) return;

  window.alert(
    `Loaded annotations for ${width}x${height}, but the loaded media is ${getMediaWidth()}x${getMediaHeight()}. Coordinates may not line up.`
  );
}

/** Seeks to a logical frame and updates UI state without relying on native playback. */
function seekToFrame(frame, options = {}) {
  const keepPlaying = options.keepPlaying === true;
  if (mediaMode === "images") {
    if (!keepPlaying) {
      stopImagePlaybackLoop();
      setPlayButtonLabels(false);
    }
    showImageFrame(frame);
    return imageFrameIndex;
  }

  if (!Number.isFinite(video.duration)) return;
  if (!keepPlaying) {
    stopVideoFramePlaybackLoop(true);
  }
  video.pause();
  // Browsers seek videos by time, not decoded frame number. Keep the app's
  // logical frame explicit, and seek to the middle of that frame's time span so
  // boundary rounding does not show the adjacent frame.
  const targetFrame = clamp(Math.round(Number(frame) || 0), 0, getMaxFrame());
  if (!keepPlaying && targetFrame === currentVideoFrameIndex && !video.seeking) {
    updateDisplays();
    draw();
    renderAnnotationList();
    return targetFrame;
  }
  currentVideoFrameIndex = targetFrame;
  video.currentTime = getSeekTimeForFrame(targetFrame);
  setPlayButtonLabels(keepPlaying);
  updateDisplays();
  return targetFrame;
}

function togglePlayback() {
  if (mediaMode === "images") {
    if (!imageFrames.length) return;
    if (imagePlaybackRafId === null) startImagePlaybackLoop();
    else stopImagePlaybackLoop(true);
    return;
  }

  if (!video.src) return;
  if (videoFramePlaybackRafId === null) startVideoFramePlaybackLoop();
  else stopVideoFramePlaybackLoop(true);
}

function jumpToFrameFromInput() {
  seekToFrame(frameInput.value);
}

function nextFrame() {
  const targetFrame = getCurrentFrame() >= getMaxFrame() ? 0 : getCurrentFrame() + 1;
  seekToFrame(targetFrame);
}

function scheduleDraw() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    updateDisplays();
    draw();
  });
}

/**
 * Plays videos by repeatedly using the same frame-step seek path as the Next
 * button. This keeps displayed annotations synchronized with stepped frames.
 */
function startVideoFramePlaybackLoop() {
  stopVideoFramePlaybackLoop();
  video.pause();
  setPlayButtonLabels(true);
  videoFramePlaybackLastTime = null;

  const step = (timestamp) => {
    if (videoFramePlaybackRafId === null) return;
    if (videoFramePlaybackLastTime === null) videoFramePlaybackLastTime = timestamp;

    const frameInterval = 1000 / getFPS();
    if (timestamp - videoFramePlaybackLastTime >= frameInterval && !video.seeking) {
      videoFramePlaybackLastTime = timestamp;
      const nextFrame = getCurrentFrame() >= getMaxFrame() ? 0 : getCurrentFrame() + 1;
      seekToFrame(nextFrame, { keepPlaying: true });
    }

    videoFramePlaybackRafId = requestAnimationFrame(step);
  };

  videoFramePlaybackRafId = requestAnimationFrame(step);
  updateAnnotationModeDisabled();
}

function stopVideoFramePlaybackLoop(updateButtons = false) {
  if (videoFramePlaybackRafId !== null) {
    cancelAnimationFrame(videoFramePlaybackRafId);
  }
  videoFramePlaybackRafId = null;
  videoFramePlaybackLastTime = null;
  if (updateButtons) setPlayButtonLabels(false);
  updateAnnotationModeDisabled();
}

/** Plays image sequences by advancing the current image index at project FPS. */
function startImagePlaybackLoop() {
  stopImagePlaybackLoop();
  setPlayButtonLabels(true);
  imagePlaybackLastTime = null;

  const step = (timestamp) => {
    if (imagePlaybackRafId === null) return;
    if (imagePlaybackLastTime === null) imagePlaybackLastTime = timestamp;

    const frameInterval = 1000 / getFPS();
    if (timestamp - imagePlaybackLastTime >= frameInterval) {
      imagePlaybackLastTime += frameInterval;
      imageFrameIndex = imageFrameIndex >= getMaxFrame() ? 0 : imageFrameIndex + 1;
      showImageFrame(imageFrameIndex);
    }

    imagePlaybackRafId = requestAnimationFrame(step);
  };

  imagePlaybackRafId = requestAnimationFrame(step);
  updateAnnotationModeDisabled();
}

function stopImagePlaybackLoop(updateButtons = false) {
  if (imagePlaybackRafId !== null) {
    cancelAnimationFrame(imagePlaybackRafId);
  }
  imagePlaybackRafId = null;
  imagePlaybackLastTime = null;
  if (updateButtons) setPlayButtonLabels(false);
  updateAnnotationModeDisabled();
}

function stopAllPlaybackLoops() {
  stopVideoFramePlaybackLoop(true);
  stopImagePlaybackLoop(true);
}

/** Updates frame/time readouts, progress bar, and accessible progress metadata. */
function updateDisplays() {
  const frame = getCurrentFrame();
  const maxFrame = getMaxFrame();
  frameInput.max = String(maxFrame);
  if (document.activeElement !== frameInput) {
    frameInput.value = String(frame);
  }
  timeDisplay.textContent = `${getCurrentMediaTime().toFixed(3)} s`;

  const progress = maxFrame > 0 ? clamp(frame / maxFrame, 0, 1) : 0;
  const progressPercent = `${(progress * 100).toFixed(3)}%`;
  frameProgressFill.style.width = progressPercent;
  frameProgressMarker.style.left = progressPercent;
  frameProgress.setAttribute("aria-valuemax", String(maxFrame));
  frameProgress.setAttribute("aria-valuenow", String(frame));
  frameProgress.setAttribute("aria-valuetext", `Frame ${frame} of ${maxFrame}`);
  excludeFrameInput.checked = excludedFrames.has(frame);
  excludeFrameInput.disabled = mediaMode === "none" || isPlaybackActive();
}

function setPlayButtonLabels(isPlaying) {
  const label = isPlaying ? "Pause" : "Play";
  deckPlayButton.textContent = label;
  updateAnnotationModeDisabled();
}

function isPlaybackActive() {
  return videoFramePlaybackRafId !== null || imagePlaybackRafId !== null;
}

function updateAnnotationModeDisabled() {
  const disabled = isPlaybackActive();
  modeInputs.forEach((input) => {
    input.disabled = disabled;
  });
  clearFrameButton.disabled = disabled;
  clearAllButton.disabled = disabled;
  excludeFrameInput.disabled = disabled || mediaMode === "none";
  document.getElementById("modeRadios")?.classList.toggle("disabled", disabled);
}

/** Returns true when an intrinsic media point is close enough to edit an annotation. */
function hitTest(ann, point) {
  if (ann.type === "point") {
    return distance(point, ann) <= 12;
  }
  if (ann.type === "shape") {
    return getShapeVertexHandle(ann, point) !== null || pointInPolygon(point, ann.points);
  }
  return getResizeHandle(ann, point) !== null || isInsideBox(ann, point);
}

function getResizeHandle(ann, point) {
  if (ann.type !== "bbox") return null;
  const handle = getBoxHandles(ann).find((candidate) => distance(point, candidate) <= 18);
  return handle ? handle.name : null;
}

function getShapeVertexHandle(ann, point) {
  if (ann.type !== "shape") return null;
  const index = ann.points.findIndex((candidate) => distance(point, candidate) <= 14);
  return index >= 0 ? index : null;
}

/** Standard ray-casting point-in-polygon test for selecting filled shapes. */
function pointInPolygon(point, polygon = []) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getShapeBounds(points = []) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y)
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  });
}

function isInsideBox(box, point) {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function isDeepInsideBox(box, point) {
  if (!isInsideBox(box, point)) return false;
  const inset = Math.min(18, Math.max(4, Math.min(box.width, box.height) * 0.25));
  return (
    point.x >= box.x + inset &&
    point.x <= box.x + box.width - inset &&
    point.y >= box.y + inset &&
    point.y <= box.y + box.height - inset
  );
}

function getBoxHandles(box) {
  return [
    { name: "nw", x: box.x, y: box.y },
    { name: "ne", x: box.x + box.width, y: box.y },
    { name: "sw", x: box.x, y: box.y + box.height },
    { name: "se", x: box.x + box.width, y: box.y + box.height }
  ];
}

function getSelectedAnnotation() {
  return annotations.find((ann) => ann.id === selectedAnnotationId) || null;
}

function setSelectedAnnotation(id, syncFields = true) {
  selectedAnnotationId = id;
  if (syncFields) populateFieldsFromSelectedAnnotation();
}

function populateFieldsFromSelectedAnnotation() {
  const ann = getSelectedAnnotation();
  if (!ann) return;
  classInput.value = ann.class || DEFAULT_CLASS_NAME;
  labelInput.value = ann.label || getDefaultLabelForMode(ann.type);
}

function updateSelectedAnnotationFromFields() {
  const ann = getSelectedAnnotation();
  if (!ann || getMode() !== "select") return;
  const nextClass = getClassName();
  const nextLabel = labelInput.value.trim() || getDefaultLabelForMode(ann.type);
  if (ann.class === nextClass && ann.label === nextLabel) return;

  pushUndoState();
  ann.class = nextClass;
  ann.label = nextLabel;
  classInput.value = nextClass;
  labelInput.value = nextLabel;
  draw();
  renderAnnotationList();
}

function setCurrentFrameExcluded(excluded) {
  if (isPlaybackActive() || mediaMode === "none") return;
  const frame = getCurrentFrame();
  const isExcluded = excludedFrames.has(frame);
  if (isExcluded === excluded) return;

  pushUndoState();
  if (excluded) {
    excludedFrames.add(frame);
  } else {
    excludedFrames.delete(frame);
  }
  updateDisplays();
  draw();
}

function toggleCurrentFrameExcluded() {
  setCurrentFrameExcluded(!excludedFrames.has(getCurrentFrame()));
}

function getMode() {
  return modeInputs.find((input) => input.checked)?.value || "select";
}

function setMode(mode) {
  const input = modeInputs.find((candidate) => candidate.value === mode);
  if (!input) return;
  const previousMode = getMode();
  input.checked = true;
  updateDefaultLabelForMode(mode, previousMode);
  if (mode === "select") populateFieldsFromSelectedAnnotation();
  clearDraftAnnotation();
  draw();
}

function cloneAnnotationForFrame(ann, frame) {
  return {
    ...cloneAnnotation(ann),
    id: nextId(),
    frame,
    time: getCurrentTimeForFrame(frame)
  };
}

function cloneAnnotation(ann) {
  return {
    ...ann,
    points: ann.points ? ann.points.map((point) => ({ ...point })) : undefined
  };
}

function nextId() {
  return `ann_${String(nextAnnotationNumber++).padStart(6, "0")}`;
}

function getClassName() {
  return classInput.value.trim() || DEFAULT_CLASS_NAME;
}

function getLabel() {
  return labelInput.value.trim() || getDefaultLabelForMode(getMode());
}

function resetClassAndLabelFields() {
  classInput.value = DEFAULT_CLASS_NAME;
  labelInput.value = getDefaultLabelForMode(getMode());
}

function getDefaultLabelForMode(mode) {
  if (mode === "bbox") return "myBoundingBox";
  if (mode === "shape") return "myShape";
  return "myPoint";
}

function updateDefaultLabelForMode(mode, previousMode = getMode()) {
  const current = labelInput.value.trim().toLowerCase();
  const defaultLabels = new Set([
    "",
    "point",
    "bbox",
    "shape",
    "mypoint",
    "myboundingbox",
    "myshape",
    getDefaultLabelForMode(previousMode).toLowerCase()
  ]);
  if (defaultLabels.has(current)) {
    labelInput.value = getDefaultLabelForMode(mode);
  }
}

function clearDraftAnnotation() {
  draftBox = null;
  draftPoint = null;
  draftShape = null;
  dragState = null;
}

function describeAnnotation(ann) {
  if (ann.type === "point") {
    return `x ${ann.x}, y ${ann.y}`;
  }
  if (ann.type === "shape") {
    return `${ann.points?.length || 0} vertices`;
  }
  return `x ${ann.x}, y ${ann.y}, w ${ann.width}, h ${ann.height}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function roundCoord(value) {
  return Math.round(value * 100) / 100;
}

function roundNorm(value) {
  return Math.round(value * 1000000) / 1000000;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeBox(ann, preserveSize = false) {
  const mediaWidth = getMediaWidth();
  const mediaHeight = getMediaHeight();
  if (ann.width < 0) {
    ann.x += ann.width;
    ann.width = Math.abs(ann.width);
  }
  if (ann.height < 0) {
    ann.y += ann.height;
    ann.height = Math.abs(ann.height);
  }

  if (preserveSize) {
    ann.width = clamp(ann.width, 1, mediaWidth);
    ann.height = clamp(ann.height, 1, mediaHeight);
    ann.x = clamp(ann.x, 0, mediaWidth - ann.width);
    ann.y = clamp(ann.y, 0, mediaHeight - ann.height);
  } else {
    ann.x = clamp(ann.x, 0, mediaWidth);
    ann.y = clamp(ann.y, 0, mediaHeight);
    ann.width = clamp(ann.width, 1, Math.max(1, mediaWidth - ann.x));
    ann.height = clamp(ann.height, 1, Math.max(1, mediaHeight - ann.y));
  }

  ann.x = roundCoord(ann.x);
  ann.y = roundCoord(ann.y);
  ann.width = roundCoord(ann.width);
  ann.height = roundCoord(ann.height);
}

function resizeBoxFromHandle(ann, handle, point, original) {
  const mediaWidth = getMediaWidth();
  const mediaHeight = getMediaHeight();
  const left = original.x;
  const top = original.y;
  const right = original.x + original.width;
  const bottom = original.y + original.height;

  if (handle.includes("w")) {
    ann.x = clamp(point.x, 0, right - 1);
    ann.width = right - ann.x;
  }
  if (handle.includes("e")) {
    ann.width = clamp(point.x, left + 1, mediaWidth) - left;
  }
  if (handle.includes("n")) {
    ann.y = clamp(point.y, 0, bottom - 1);
    ann.height = bottom - ann.y;
  }
  if (handle.includes("s")) {
    ann.height = clamp(point.y, top + 1, mediaHeight) - top;
  }
}

stage.addEventListener("pointerdown", (event) => {
  if (isPlaybackActive()) return;
  if (mediaMode === "video" && video.seeking) return;
  if (!getMediaWidth()) return;
  stage.setPointerCapture(event.pointerId);
  const point = canvasToVideo(event);
  const mode = getMode();

  if (mode === "point") {
    draftPoint = point;
    dragState = { action: "createPoint" };
    draw();
    return;
  }

  if (mode === "bbox") {
    draftBox = { x: point.x, y: point.y, width: 0, height: 0 };
    dragState = { action: "createBox", start: point };
    draw();
    return;
  }

  if (mode === "shape") {
    handleShapeClick(point);
    return;
  }

  const selected = selectAnnotation(point);
  if (!selected) return;

  const handle = getResizeHandle(selected, point);
  const vertexHandle = getShapeVertexHandle(selected, point);
  let action = null;
  if (handle) {
    action = "resizeBox";
  } else if (vertexHandle !== null) {
    action = "moveShapeVertex";
  } else if (selected.type === "point") {
    action = "movePoint";
  } else if (isDeepInsideBox(selected, point)) {
    action = "moveBox";
  } else if (selected.type === "shape" && pointInPolygon(point, selected.points)) {
    action = "moveShape";
  }

  if (!action) return;

  dragState = {
    action,
    ann: selected,
    handle,
    vertexHandle,
    start: point,
    original: cloneAnnotation(selected)
  };
});

stage.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  const point = canvasToVideo(event);

  if (dragState.action === "createPoint") {
    draftPoint = point;
    draw();
    return;
  }

  if (dragState.action === "createBox") {
    draftBox = {
      x: dragState.start.x,
      y: dragState.start.y,
      width: point.x - dragState.start.x,
      height: point.y - dragState.start.y
    };
    draw();
    return;
  }

  const ann = dragState.ann;
  const dx = point.x - dragState.start.x;
  const dy = point.y - dragState.start.y;

  if (dragState.action === "movePoint") {
    ann.x = dragState.original.x + dx;
    ann.y = dragState.original.y + dy;
  } else if (dragState.action === "moveBox") {
    ann.x = dragState.original.x + dx;
    ann.y = dragState.original.y + dy;
  } else if (dragState.action === "resizeBox") {
    Object.assign(ann, dragState.original);
    resizeBoxFromHandle(ann, dragState.handle, point, dragState.original);
  } else if (dragState.action === "moveShapeVertex") {
    ann.points = dragState.original.points.map((shapePoint, index) =>
      index === dragState.vertexHandle ? { ...shapePoint, x: point.x, y: point.y } : { ...shapePoint }
    );
  } else if (dragState.action === "moveShape") {
    const bounds = getShapeBounds(dragState.original.points);
    const clampedDx = clamp(dx, -bounds.minX, getMediaWidth() - bounds.maxX);
    const clampedDy = clamp(dy, -bounds.minY, getMediaHeight() - bounds.maxY);
    ann.points = dragState.original.points.map((shapePoint) => ({
      ...shapePoint,
      x: shapePoint.x + clampedDx,
      y: shapePoint.y + clampedDy
    }));
  }

  updateAnnotationGeometry(ann);
  draw();
  renderAnnotationList();
});

stage.addEventListener("pointerup", () => {
  if (dragState?.action === "createPoint" && draftPoint) {
    addPoint(draftPoint.x, draftPoint.y);
  }
  if (dragState?.action === "createBox" && draftBox) {
    addBox(draftBox.x, draftBox.y, draftBox.width, draftBox.height);
  }
  draftPoint = null;
  draftBox = null;
  dragState = null;
  draw();
});

stage.addEventListener("pointercancel", () => {
  draftPoint = null;
  draftBox = null;
  draftShape = null;
  dragState = null;
  draw();
});

mediaFolderInput.addEventListener("change", (event) => loadMediaFolder(event.target.files));
video.addEventListener("loadedmetadata", resizeCanvasToVideo);
video.addEventListener("seeked", () => {
  updateDisplays();
  draw();
  renderAnnotationList();
});
video.addEventListener("timeupdate", () => {
  updateDisplays();
  if (mediaMode === "video" && video.seeking) return;
  draw();
  renderAnnotationList();
});
deckPlayButton.addEventListener("click", togglePlayback);

copyNextFrameButton.addEventListener("click", copyCurrentAnnotationsToNextFrame);
deckPrevFrameButton.addEventListener("click", () => seekToFrame(getCurrentFrame() - 1));
deckNextFrameButton.addEventListener("click", nextFrame);
jumpStartButton.addEventListener("click", () => seekToFrame(0));
jumpEndButton.addEventListener("click", () => seekToFrame(getMaxFrame()));

frameInput.addEventListener("change", jumpToFrameFromInput);
frameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    jumpToFrameFromInput();
    frameInput.blur();
  }
});

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateDefaultLabelForMode(input.value);
    if (input.value === "select") populateFieldsFromSelectedAnnotation();
    clearDraftAnnotation();
    draw();
  });
});

classInput.addEventListener("change", updateSelectedAnnotationFromFields);
labelInput.addEventListener("change", updateSelectedAnnotationFromFields);
[classInput, labelInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    updateSelectedAnnotationFromFields();
    input.blur();
  });
});

onionEnabledInput.addEventListener("change", draw);
excludeFrameInput.addEventListener("change", () => {
  setCurrentFrameExcluded(excludeFrameInput.checked);
});
exportButton.addEventListener("click", exportJSON);

clearFrameButton.addEventListener("click", () => {
  if (isPlaybackActive()) return;
  const frame = getCurrentFrame();
  if (!annotations.some((ann) => ann.frame === frame)) return;
  pushUndoState();
  annotations = annotations.filter((ann) => ann.frame !== frame);
  selectedAnnotationId = null;
  draw();
  renderAnnotationList();
});

clearAllButton.addEventListener("click", () => {
  if (isPlaybackActive()) return;
  if (!annotations.length) return;
  const confirmed = window.confirm("Clear annotations from all frames?");
  if (!confirmed) return;
  pushUndoState();
  annotations = [];
  selectedAnnotationId = null;
  draw();
  renderAnnotationList();
});

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "SELECT" || activeTag === "TEXTAREA") return;

  const modeKey = event.key.toLowerCase();
  if (modeKey === "z") {
    event.preventDefault();
    undoLastAction();
  } else if (modeKey === "x") {
    event.preventDefault();
    toggleCurrentFrameExcluded();
  } else if ((modeKey === "p" || modeKey === "b" || modeKey === "s" || modeKey === "e") && !isPlaybackActive()) {
    event.preventDefault();
    setMode({ p: "point", b: "bbox", s: "shape", e: "select" }[modeKey]);
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlayback();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    seekToFrame(getCurrentFrame() - 1);
  } else if (event.key === "ArrowRight" && event.shiftKey) {
    event.preventDefault();
    copyCurrentAnnotationsToNextFrame();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    nextFrame();
  } else if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    deleteAnnotation();
  }
});

window.addEventListener("resize", scheduleDraw);

updateDisplays();
renderAnnotationList();
