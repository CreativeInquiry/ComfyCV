let rawBoxLines;
let frames = [];
let nFrames = 0;
let parseError = "";
let paused = false;
let pausedFrameIndex = 0;
let sourceFileName = "piles_detected_boxes.txt";
let sourceBaseName = "piles_detected_boxes";
let sequence;
const DEFAULT_INPUT_PATH = "input/piles_detected_boxes.txt";

function preload() {
  rawBoxLines = loadStrings(DEFAULT_INPUT_PATH);
}

function setup() {
  createCanvas(1280, 720);
  frameRate(30);
  textFont("monospace");
  createControls();
  applyTextData(rawBoxLines.join("\n"), sourceFileName);
}

function draw() {
  background(0,0,0); 

  if (parseError) {
    drawStatus(parseError);
    return;
  }

  if (nFrames === 0) {
    drawStatus("No frames loaded");
    return;
  }

  const frameIndex = getPlaybackFrameIndex();
  const boxes = frames[frameIndex];

  noFill();
  stroke(80, 255, 80);
  strokeWeight(2);
  rectMode(CENTER);

  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    rect(box.x, box.y, box.w, box.h);
    drawBoxLabel(i, box.x, box.y, box.w, box.h);
  }

  drawFrameReadout(frameIndex, boxes.length);
}

function parseDetectedBoxes(rawText) {
  frames = [];
  parseError = "";

  const tensorPattern = /tensor\(([\s\S]*?)(?=\),\s*tensor|\)\s*\]|\)\s*$)/g;
  let tensorMatch;

  while ((tensorMatch = tensorPattern.exec(rawText)) !== null) {
    const tensorBody = tensorMatch[1];
    const frameBoxes = [];
    const rowPattern = /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(tensorBody)) !== null) {
      frameBoxes.push({
        x: Number(rowMatch[1]),
        y: Number(rowMatch[2]),
        w: Number(rowMatch[3]),
        h: Number(rowMatch[4]),
      });
    }

    frames.push(frameBoxes);
  }

  nFrames = frames.length;

  if (nFrames === 0) {
    parseError = "Could not parse any tensor frames from piles_detected_boxes.txt";
  }
}

function applyTextData(rawText, filename) {
  sourceFileName = filename || "piles_detected_boxes.txt";
  sourceBaseName = baseNameWithoutExtension(sourceFileName);
  parseDetectedBoxes(rawText);
  sequence = buildExportSequence();
  frameCount = 0;
  pausedFrameIndex = 0;

  if (paused) {
    paused = false;
    loop();
  }
}

function buildExportSequence() {
  return {
    name: sourceBaseName,
    sourceFileName,
    sourceBaseName,
    width,
    height,
    fps: 30,
    frames,
  };
}

function createControls() {
  const panel = createDiv();
  panel.class("layer-controls");
  panel.attribute("aria-label", "Import and export");

  const actionSection = createDiv();
  actionSection.class("controls-section controls-section--actions");
  actionSection.parent(panel);

  createImportControls(actionSection);

  if (window.YoloBoxExporter) {
    window.YoloBoxExporter.createControls(actionSection, () => sequence || buildExportSequence());
  }
}

function createImportControls(parent) {
  const button = createButton("Import TXT");
  button.class("import-button");
  button.parent(parent);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "text/plain,.txt";
  input.className = "txt-file-input";
  input.addEventListener("change", handleTextFileSelected);
  parent.elt.appendChild(input);

  button.mousePressed(() => input.click());
}

function handleTextFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    applyTextData(String(reader.result), file.name);
  };
  reader.onerror = () => {
    parseError = `Could not read ${file.name}`;
  };
  reader.readAsText(file);

  event.target.value = "";
}

function drawBoxLabel(index, x, y, w, h) {
  const label = String(index);
  const labelX = constrain(x - w / 2, 0, width - 18);
  const labelY = constrain(y - h / 2 - 4, 12, height - 4);

  noStroke();
  fill(170);
  textSize(12);
  textAlign(LEFT, BOTTOM);
  text(label, labelX, labelY);

  noFill();
  stroke(80, 255, 80);
  strokeWeight(2);
}

function drawFrameReadout(frameIndex, boxCount) {
  noStroke();
  fill(170);
  textSize(14);
  textAlign(LEFT, TOP);
  text(`${sourceFileName}   frame ${frameIndex} / ${nFrames - 1}   boxes ${boxCount}`, 12, 10);
}

function drawStatus(message) {
  noStroke();
  fill(170);
  textSize(18);
  textAlign(CENTER, CENTER);
  text(message, width / 2, height / 2);
}

function keyPressed() {
  if (key === " ") {
    if (paused) {
      paused = false;
      loop();
    } else {
      pausedFrameIndex = getPlaybackFrameIndex();
      paused = true;
      noLoop();
    }

    return false;
  }

  if (paused && keyCode === LEFT_ARROW) {
    stepPausedFrame(-1);
    return false;
  }

  if (paused && keyCode === RIGHT_ARROW) {
    stepPausedFrame(1);
    return false;
  }
}

function baseNameWithoutExtension(filename) {
  return String(filename || "piles_detected_boxes.txt")
    .replace(/^.*[/\\]/, "")
    .replace(/\.[^/.\\]+$/, "");
}

function getPlaybackFrameIndex() {
  if (nFrames === 0) {
    return 0;
  }
  return paused ? pausedFrameIndex % nFrames : frameCount % nFrames;
}

function stepPausedFrame(delta) {
  if (nFrames === 0) {
    return;
  }
  pausedFrameIndex = (pausedFrameIndex + delta + nFrames) % nFrames;
  redraw();
}
