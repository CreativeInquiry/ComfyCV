(function (global) {
  "use strict";

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
   * Adds export controls to an existing controls section.
   *
   * This is the only integration point used by sketch.js. To remove all export
   * features, remove easytrackExporter.js from index.html; the sketch will skip
   * this optional module automatically.
   *
   * @param {HTMLElement|object} parent Parent DOM element or p5.Element.
   * @param {Function} getSequence Returns the latest normalized sequence.
   * @param {Function} getFilters Returns current layer checkbox states.
   */
  function createControls(parent, getSequence, getFilters) {
    const parentElement = parent && parent.elt ? parent.elt : parent;
    if (!parentElement || typeof getSequence !== "function") {
      return;
    }

    const exportTitle = document.createElement("div");
    exportTitle.className = "layer-controls__title";
    exportTitle.textContent = "Export";
    parentElement.appendChild(exportTitle);

    addExportButton(parentElement, "Save as AfterEffects JSX", () => saveAfterEffectsJsx(getSequence(), currentFilters(getFilters)));
    addExportButton(parentElement, "Save as Blender Python", () => saveBlenderPython(getSequence(), currentFilters(getFilters)));
    addExportButton(parentElement, "Save as Maya Python", () => saveMayaPython(getSequence(), currentFilters(getFilters)));
    addExportButton(parentElement, "Save Layered SVG", () => saveLayeredSvg(getSequence(), currentFilters(getFilters)));
    addExportButton(parentElement, "Save as CSV", () => saveCsv(getSequence(), currentFilters(getFilters)));
  }

  /**
   * Creates one exporter button.
   *
   * @param {HTMLElement} parentElement Parent DOM element.
   * @param {string} label Button text.
   * @param {Function} handler Click handler.
   */
  function addExportButton(parentElement, label, handler) {
    const button = document.createElement("button");
    button.className = "export-button";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    parentElement.appendChild(button);
  }

  /**
   * Exports the normalized tracking data as an After Effects JSX script.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   */
  function saveAfterEffectsJsx(sequence, filters) {
    if (!hasExportableFrames(sequence)) {
      return;
    }

    downloadTextFile(exportFilename(sequence, "aftereffects", "jsx"), buildAfterEffectsJsx(buildExportData(sequence, filters)));
  }

  /**
   * Exports the normalized tracking data as a Blender Python script.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   */
  function saveBlenderPython(sequence, filters) {
    if (!hasExportableFrames(sequence)) {
      return;
    }

    downloadTextFile(exportFilename(sequence, "blender", "py"), buildBlenderPython(buildExportData(sequence, filters)));
  }

  /**
   * Exports the normalized tracking data as a Maya Python script.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   */
  function saveMayaPython(sequence, filters) {
    if (!hasExportableFrames(sequence)) {
      return;
    }

    downloadTextFile(exportFilename(sequence, "maya", "py"), buildMayaPython(buildExportData(sequence, filters)));
  }

  /**
   * Exports one SVG file with one Inkscape layer per JSON frame.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   */
  function saveLayeredSvg(sequence, filters) {
    if (!hasExportableFrames(sequence)) {
      return;
    }

    downloadTextFile(exportFilename(sequence, "layered_svg", "svg"), buildLayeredSvg(buildExportData(sequence, filters)));
  }

  /**
   * Exports one tabular row per visible detection per frame.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   */
  function saveCsv(sequence, filters) {
    if (!hasExportableFrames(sequence)) {
      return;
    }

    downloadTextFile(exportFilename(sequence, "csv", "csv"), buildCsv(sequence, filters));
  }

  /**
   * Checks whether a sequence has frames available for export.
   *
   * @param {?object} sequence Normalized tracking sequence.
   * @returns {boolean}
   */
  function hasExportableFrames(sequence) {
    return Boolean(sequence && Array.isArray(sequence.frames) && sequence.frames.length);
  }

  /**
   * Safely reads current layer filters from the viewer.
   *
   * @param {?Function} getFilters Optional viewer callback.
   * @returns {object}
   */
  function currentFilters(getFilters) {
    if (typeof getFilters !== "function") {
      return normalizeExportFilters();
    }
    try {
      return normalizeExportFilters(getFilters());
    } catch (error) {
      console.error(error);
      return normalizeExportFilters();
    }
  }

  /**
   * Maps viewer checkbox keys to exporter-supported layer keys.
   *
   * RLE masks/contours are represented in CSV, and RLE contours are represented
   * in layered SVG. Track points are displayed in p5 but are not currently
   * represented by exporters.
   *
   * @param {?object} filters Raw viewer filter map.
   * @returns {{masks:boolean, boxes:boolean, labels:boolean, points:boolean, contours:boolean, rleContours:boolean, frameCounter:boolean, legend:boolean}}
   */
  function normalizeExportFilters(filters) {
    return {
      masks: !filters || filters.masks !== false,
      boxes: !filters || filters.boxes !== false,
      labels: !filters || filters.labels !== false,
      points: !filters || filters.points !== false,
      contours: !filters || filters.contours !== false,
      rleContours: !filters || filters.rleContours !== false,
      frameCounter: !filters || filters.frameCounter !== false,
      legend: !filters || filters.legend !== false,
    };
  }

  /**
   * Packages frame detections into per-object tracks for every exporter.
   *
   * Export scripts can keyframe compact coordinate arrays more easily than the
   * richer normalized detection objects used by the p5 renderer.
   *
   * @param {object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   * @returns {{name:string, width:number, height:number, fps:number, frameCount:number, tracks:Array<object>}}
   */
  function buildExportData(sequence, filters) {
    const include = normalizeExportFilters(filters);
    const tracks = new Map();

    for (let frameIndex = 0; frameIndex < sequence.frames.length; frameIndex += 1) {
      for (const detection of sequence.frames[frameIndex]) {
        const key = String(detection.id);
        if (!tracks.has(key)) {
          tracks.set(key, {
            id: detection.id,
            label: detection.label,
            color: colorForId(detection.id),
            frames: [],
            maxContours: 0,
          });
        }

        const track = tracks.get(key);
        const contours = include.contours
          ? detection.contours
              .filter((contour) => contour.length > 1)
              .map((contour) => contour.map((point) => [roundForExport(point[0]), roundForExport(point[1])]))
          : [];
        track.maxContours = Math.max(track.maxContours, contours.length);
        track.frames.push({
          frame: frameIndex,
          bbox: include.boxes && detection.bbox
            ? [
                roundForExport(detection.bbox.x),
                roundForExport(detection.bbox.y),
                roundForExport(detection.bbox.w),
                roundForExport(detection.bbox.h),
              ]
            : null,
          point: include.points && detection.point ? [roundForExport(detection.point[0]), roundForExport(detection.point[1])] : null,
          contours,
          rleSegments: include.rleContours ? rleSegmentsForDetection(detection) : [],
          score: Number.isFinite(detection.score) ? roundForExport(detection.score) : null,
          area: Number.isFinite(detection.area) ? roundForExport(detection.area) : null,
          visible: detection.visible !== false,
        });
      }
    }

    return {
      name: "EasyTrack SAM3 Tracking",
      sourceFileName: sequence.sourceFileName || "bouncing.json",
      sourceBaseName: exportBaseName(sequence),
      include,
      width: sequence.width,
      height: sequence.height,
      fps: sequence.fps,
      frameCount: sequence.frames.length,
      tracks: Array.from(tracks.values()),
    };
  }

  /**
   * Builds a CSV table with one row per visible detection per frame.
   *
   * RLE fields are deliberately the final columns so the tabular metadata stays
   * easy to scan while the long contour strings sit at the far right.
   *
   * @param {object} sequence Normalized tracking sequence.
   * @param {object} filters Current layer filter state.
   * @returns {string}
   */
  function buildCsv(sequence, filters) {
    const include = normalizeExportFilters(filters);
    const rows = [[
      "frame",
      "id",
      "label",
      "visible",
      "score",
      "area",
      "centroid_x",
      "centroid_y",
      "bbox_x",
      "bbox_y",
      "bbox_w",
      "bbox_h",
      "simplified_contours_json",
      "rle_height",
      "rle_width",
      "rle_counts",
    ]];

    for (let frameIndex = 0; frameIndex < sequence.frames.length; frameIndex += 1) {
      for (const detection of sequence.frames[frameIndex]) {
        if (detection.visible === false) {
          continue;
        }
        const point = include.points && detection.point ? detection.point : null;
        const bbox = include.boxes && detection.bbox ? detection.bbox : null;
        const simplifiedContours = include.contours
          ? detection.contours
              .filter((contour) => contour.length > 1)
              .map((contour) => contour.map((point) => [roundForExport(point[0]), roundForExport(point[1])]))
          : [];
        const rle = include.masks || include.rleContours ? detection.rle : null;

        rows.push([
          frameIndex,
          detection.id,
          include.labels ? detection.label : "",
          detection.visible !== false,
          Number.isFinite(detection.score) ? roundForExport(detection.score) : "",
          Number.isFinite(detection.area) ? roundForExport(detection.area) : "",
          point ? roundForExport(point[0]) : "",
          point ? roundForExport(point[1]) : "",
          bbox ? roundForExport(bbox.x) : "",
          bbox ? roundForExport(bbox.y) : "",
          bbox ? roundForExport(bbox.w) : "",
          bbox ? roundForExport(bbox.h) : "",
          simplifiedContours.length ? JSON.stringify(simplifiedContours) : "",
          rle ? rle.height : "",
          rle ? rle.width : "",
          rle ? rleCountsString(rle.counts) : "",
        ]);
      }
    }

    return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  }

  /**
   * Builds an Inkscape-friendly SVG with one layer per frame.
   *
   * The legend is document-level metadata/annotation and is emitted once, not
   * inside every frame layer.
   *
   * @param {object} data Export payload from buildExportData().
   * @returns {string}
   */
  function buildLayeredSvg(data) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${numberAttr(data.width)}" height="${numberAttr(data.height)}" viewBox="0 0 ${numberAttr(data.width)} ${numberAttr(data.height)}">`,
      "  <title>EasyTrack layered SVG</title>",
      `  <desc>Source: ${escapeXml(data.sourceFileName || data.sourceBaseName || "unknown")} | Frames: ${data.frameCount} | FPS: ${numberAttr(data.fps)}</desc>`,
    ];

    if (data.include && data.include.legend) {
      lines.push(...svgLegendLines(data));
    }

    const frameLookup = buildFrameLookup(data);
    for (let frameIndex = 0; frameIndex < data.frameCount; frameIndex += 1) {
      lines.push(`  <g id="frame_${padFrame(frameIndex + 1, data.frameCount)}" inkscape:groupmode="layer" inkscape:label="frame_${padFrame(frameIndex + 1, data.frameCount)}">`);
      if (data.include.frameCounter) {
        lines.push(svgFrameCounterLine(data, frameIndex, (frameLookup[frameIndex] || []).length));
      }
      for (const item of frameLookup[frameIndex] || []) {
        lines.push(...svgDetectionGroupLines(data, item.track, item.frame, frameIndex));
      }
      lines.push("  </g>");
    }

    lines.push("</svg>", "");
    return lines.join("\n");
  }

  /**
   * Builds a per-frame lookup from per-track export data.
   *
   * @param {object} data Export payload.
   * @returns {Array<Array<object>>}
   */
  function buildFrameLookup(data) {
    const frames = Array.from({ length: data.frameCount }, () => []);
    for (const track of data.tracks) {
      for (const frame of track.frames) {
        if (frame.visible && frame.frame >= 0 && frame.frame < frames.length) {
          frames[frame.frame].push({ track, frame });
        }
      }
    }
    return frames;
  }

  /**
   * Gets RLE contour boundary segments from a normalized detection.
   *
   * The viewer owns RLE decoding; this exporter reuses getBoundarySegments()
   * when it is available, then serializes the result into SVG path data.
   *
   * @param {object} detection Normalized detection.
   * @returns {Array<number[]>}
   */
  function rleSegmentsForDetection(detection) {
    const segments = typeof global.getBoundarySegments === "function"
      ? global.getBoundarySegments(detection)
      : detection.boundarySegments;
    if (!Array.isArray(segments)) {
      return [];
    }
    return segments.map((segment) => segment.map(roundForExport));
  }

  /**
   * Builds SVG lines for one object group inside one frame layer.
   *
   * @param {object} data Export payload.
   * @param {object} track Track export data.
   * @param {object} frame Frame export data.
   * @param {number} frameIndex Zero-based frame index.
   * @returns {string[]}
   */
  function svgDetectionGroupLines(data, track, frame, frameIndex) {
    const color = rgbCss(track.color);
    const groupId = `frame_${padFrame(frameIndex + 1, data.frameCount)}_track_${safeSvgId(track.id)}`;
    const lines = [
      `    <g id="${groupId}" data-track-id="${escapeXml(String(track.id))}" data-label="${escapeXml(String(track.label))}">`,
    ];

    if (data.include.contours) {
      for (let i = 0; i < frame.contours.length; i += 1) {
        const path = contourPathData(frame.contours[i]);
        if (path) {
          lines.push(`      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" data-kind="simplified_contour" data-contour-index="${i}"/>`);
        }
      }
    }

    if (data.include.rleContours && frame.rleSegments && frame.rleSegments.length) {
      const path = segmentPathData(frame.rleSegments);
      if (path) {
        lines.push(`      <path d="${path}" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="1" stroke-linecap="square" data-kind="rle_contour"/>`);
      }
    }

    if (data.include.boxes && frame.bbox) {
      lines.push(`      <rect x="${numberAttr(frame.bbox[0])}" y="${numberAttr(frame.bbox[1])}" width="${numberAttr(frame.bbox[2])}" height="${numberAttr(frame.bbox[3])}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="7 5" data-kind="bbox"/>`);
    }

    if (data.include.points && frame.point) {
      lines.push(`      <circle cx="${numberAttr(frame.point[0])}" cy="${numberAttr(frame.point[1])}" r="4" fill="${color}" fill-opacity="0.9" data-kind="centroid"/>`);
    }

    if (data.include.labels) {
      const anchor = labelAnchor(frame);
      if (anchor) {
        const label = `${track.label} #${track.id}${formatScore(frame.score)}`;
        lines.push(`      <text x="${numberAttr(anchor[0] + 3)}" y="${numberAttr(anchor[1])}" fill="${color}" font-family="monospace" font-size="14" data-kind="label">${escapeXml(label)}</text>`);
      }
    }

    lines.push("    </g>");
    return lines;
  }

  /**
   * Builds document-level legend lines for source metadata.
   *
   * @param {object} data Export payload.
   * @returns {string[]}
   */
  function svgLegendLines(data) {
    const x = data.width - 20;
    return [
      '  <g id="legend" data-kind="legend">',
      `    <text x="${numberAttr(x)}" y="29" text-anchor="end" fill="#737373" font-family="monospace" font-size="14">${escapeXml(data.sourceFileName || "")}</text>`,
      `    <text x="${numberAttr(x)}" y="45" text-anchor="end" fill="#737373" font-family="monospace" font-size="14">${numberAttr(data.width)} x ${numberAttr(data.height)}</text>`,
      "  </g>",
    ];
  }

  /**
   * Builds one per-layer frame counter line.
   *
   * @param {object} data Export payload.
   * @param {number} frameIndex Zero-based frame index.
   * @param {number} detectionCount Number of visible detections in the frame.
   * @returns {string}
   */
  function svgFrameCounterLine(data, frameIndex, detectionCount) {
    const label = `frame ${frameIndex + 1}/${data.frameCount}  objects ${detectionCount}`;
    return `    <text x="20" y="29" fill="#d8d8d8" font-family="monospace" font-size="14" data-kind="frame_counter">${escapeXml(label)}</text>`;
  }

  /**
   * Converts a contour point array to SVG path data.
   *
   * @param {Array<number[]>} contour Contour points.
   * @returns {string}
   */
  function contourPathData(contour) {
    if (!Array.isArray(contour) || contour.length < 2) {
      return "";
    }
    const commands = [`M ${numberAttr(contour[0][0])} ${numberAttr(contour[0][1])}`];
    for (let i = 1; i < contour.length; i += 1) {
      commands.push(`L ${numberAttr(contour[i][0])} ${numberAttr(contour[i][1])}`);
    }
    commands.push("Z");
    return commands.join(" ");
  }

  /**
   * Converts boundary line segments to one SVG path.
   *
   * @param {Array<number[]>} segments Boundary segments as [x1, y1, x2, y2].
   * @returns {string}
   */
  function segmentPathData(segments) {
    return segments
      .map((segment) => `M ${numberAttr(segment[0])} ${numberAttr(segment[1])} L ${numberAttr(segment[2])} ${numberAttr(segment[3])}`)
      .join(" ");
  }

  /**
   * Finds a reasonable label anchor for SVG text.
   *
   * @param {object} frame Frame export data.
   * @returns {?number[]}
   */
  function labelAnchor(frame) {
    if (frame.bbox) {
      return [frame.bbox[0], Math.max(16, frame.bbox[1] - 7)];
    }
    if (frame.point) {
      return [frame.point[0] + 10, frame.point[1] - 10];
    }
    const firstContour = frame.contours && frame.contours[0];
    return firstContour && firstContour[0] ? firstContour[0] : null;
  }

  /**
   * Formats a score suffix for labels.
   *
   * @param {?number} score Detection score.
   * @returns {string}
   */
  function formatScore(score) {
    return Number.isFinite(score) ? ` ${roundForExport(score)}` : "";
  }

  /**
   * Builds a complete ExtendScript/JSX file for After Effects.
   *
   * @param {object} data Export payload from buildExportData().
   * @returns {string}
   */
  function buildAfterEffectsJsx(data) {
    return [
      "// Generated by p5_ComfyUI_EasyTrack.",
      "// Run in After Effects with File > Scripts > Run Script File...",
      "app.beginUndoGroup(\"Import EasyTrack tracking data\");",
      `var data = ${JSON.stringify(data, null, 2)};`,
      aeHelperSource(),
      "var comp = app.project.items.addComp(data.name, data.width, data.height, 1, data.frameCount / data.fps, data.fps);",
      "comp.bgColor = [0, 0, 0];",
      "for (var i = 0; i < data.tracks.length; i += 1) {",
      "  importTrack(comp, data, data.tracks[i]);",
      "}",
      "app.endUndoGroup();",
      "",
    ].join("\n");
  }

  /**
   * Returns helper functions embedded into the generated After Effects JSX.
   *
   * The helper body intentionally stays old-fashioned JavaScript because AE's
   * ExtendScript engine behaves closer to ES3 than modern browser JavaScript.
   *
   * @returns {string}
   */
  function aeHelperSource() {
    return `
function color01(color) {
  return [color[0] / 255, color[1] / 255, color[2] / 255];
}

function cleanName(value) {
  var text = String(value);
  var forbidden = [92, 47, 58, 42, 63, 34, 60, 62, 124];
  for (var i = 0; i < forbidden.length; i += 1) {
    text = text.split(String.fromCharCode(forbidden[i])).join("_");
  }
  return text;
}

function makeShape(points, closed) {
  var shape = new Shape();
  var inTangents = [];
  var outTangents = [];
  for (var i = 0; i < points.length; i += 1) {
    inTangents.push([0, 0]);
    outTangents.push([0, 0]);
  }
  shape.vertices = points;
  shape.inTangents = inTangents;
  shape.outTangents = outTangents;
  shape.closed = closed;
  return shape;
}

function setLayerOrigin(layer) {
  var transform = layer.property("ADBE Transform Group");
  transform.property("ADBE Anchor Point").setValue([0, 0]);
  transform.property("ADBE Position").setValue([0, 0]);
}

function addStroke(vectors, color, width, opacity) {
  var stroke = vectors.addProperty("ADBE Vector Graphic - Stroke");
  stroke.property("ADBE Vector Stroke Color").setValue(color01(color));
  stroke.property("ADBE Vector Stroke Width").setValue(width);
  stroke.property("ADBE Vector Stroke Opacity").setValue(opacity);
  return stroke;
}

function addFill(vectors, color, opacity) {
  var fill = vectors.addProperty("ADBE Vector Graphic - Fill");
  fill.property("ADBE Vector Fill Color").setValue(color01(color));
  fill.property("ADBE Vector Fill Opacity").setValue(opacity);
  return fill;
}

function addShapePathLayer(comp, name, color, strokeWidth, fillOpacity) {
  var layer = comp.layers.addShape();
  layer.name = cleanName(name);
  setLayerOrigin(layer);
  var contents = layer.property("ADBE Root Vectors Group");
  var group = contents.addProperty("ADBE Vector Group");
  var vectors = group.property("ADBE Vectors Group");
  var shapeGroup = vectors.addProperty("ADBE Vector Shape - Group");
  shapeGroup.name = "EasyTrack Path";
  if (fillOpacity > 0) {
    addFill(vectors, color, fillOpacity);
  }
  addStroke(vectors, color, strokeWidth, 100);
  shapeGroup = vectors.property("EasyTrack Path");
  return {
    layer: layer,
    path: shapeGroup.property("ADBE Vector Shape"),
    opacity: layer.property("ADBE Transform Group").property("ADBE Opacity")
  };
}

function addCentroidLayer(comp, track) {
  var layer = comp.layers.addShape();
  layer.name = cleanName(track.label + " #" + track.id + " centroid point");
  var contents = layer.property("ADBE Root Vectors Group");
  var group = contents.addProperty("ADBE Vector Group");
  var vectors = group.property("ADBE Vectors Group");
  var ellipse = vectors.addProperty("ADBE Vector Shape - Ellipse");
  ellipse.property("ADBE Vector Ellipse Size").setValue([8, 8]);
  addFill(vectors, track.color, 100);
  return {
    layer: layer,
    position: layer.property("ADBE Transform Group").property("ADBE Position"),
    opacity: layer.property("ADBE Transform Group").property("ADBE Opacity")
  };
}

function addCentroidNull(comp, track, duration) {
  var layer = comp.layers.addNull(duration);
  layer.name = cleanName(track.label + " #" + track.id + " centroid null");
  return layer.property("ADBE Transform Group").property("ADBE Position");
}

function addTextLayer(comp, track) {
  var layer = comp.layers.addText("");
  layer.name = cleanName(track.label + " #" + track.id + " label");
  var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
  var doc = textProp.value;
  doc.fontSize = 18;
  doc.fillColor = color01(track.color);
  textProp.setValue(doc);
  return {
    layer: layer,
    sourceText: textProp,
    position: layer.property("ADBE Transform Group").property("ADBE Position"),
    opacity: layer.property("ADBE Transform Group").property("ADBE Opacity")
  };
}

function frameAt(track, frameIndex) {
  for (var i = 0; i < track.frames.length; i += 1) {
    if (track.frames[i].frame === frameIndex) {
      return track.frames[i];
    }
  }
  return null;
}

function formatScore(score) {
  if (score === null || score === undefined) {
    return "";
  }
  return " " + Math.round(score * 1000) / 1000;
}

function importTrack(comp, data, track) {
  var duration = data.frameCount / data.fps;
  var include = data.include || {};
  var bboxLayer = include.boxes ? addShapePathLayer(comp, track.label + " #" + track.id + " bbox", track.color, 2, 0) : null;
  var pointLayer = include.points ? addCentroidLayer(comp, track) : null;
  var pointNullPosition = include.points ? addCentroidNull(comp, track, duration) : null;
  var textLayer = include.labels ? addTextLayer(comp, track) : null;
  var contourLayers = [];

  for (var contourIndex = 0; include.contours && contourIndex < track.maxContours; contourIndex += 1) {
    contourLayers.push(addShapePathLayer(comp, track.label + " #" + track.id + " simplified contour " + (contourIndex + 1), track.color, 2, 0));
  }

  for (var frameIndex = 0; frameIndex < data.frameCount; frameIndex += 1) {
    var frame = frameAt(track, frameIndex);
    var time = frameIndex / data.fps;
    var visible = frame && frame.visible;

    if (bboxLayer) {
      bboxLayer.opacity.setValueAtTime(time, visible && frame.bbox ? 100 : 0);
    }
    if (pointLayer) {
      pointLayer.opacity.setValueAtTime(time, visible && frame.point ? 100 : 0);
    }
    if (textLayer) {
      textLayer.opacity.setValueAtTime(time, visible ? 100 : 0);
    }

    if (bboxLayer && visible && frame.bbox) {
      var b = frame.bbox;
      bboxLayer.path.setValueAtTime(time, makeShape([[b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], [b[0], b[1] + b[3]]], true));
    }

    if (pointLayer && visible && frame.point) {
      pointLayer.position.setValueAtTime(time, frame.point);
      pointNullPosition.setValueAtTime(time, frame.point);
    }

    if (textLayer && visible) {
      var doc = textLayer.sourceText.value;
      doc.text = track.label + " #" + track.id + formatScore(frame.score);
      doc.fontSize = 18;
      doc.fillColor = color01(track.color);
      textLayer.sourceText.setValueAtTime(time, doc);
      var textPosition = frame.point ? [frame.point[0] + 10, frame.point[1] - 10] : [20, 20];
      textLayer.position.setValueAtTime(time, textPosition);
    }

    for (var contourIndex = 0; contourIndex < contourLayers.length; contourIndex += 1) {
      var contourLayer = contourLayers[contourIndex];
      var contour = visible && frame.contours.length > contourIndex ? frame.contours[contourIndex] : null;
      contourLayer.opacity.setValueAtTime(time, contour ? 100 : 0);
      if (contour) {
        contourLayer.path.setValueAtTime(time, makeShape(contour, true));
      }
    }
  }
}
`;
  }

  /**
   * Builds a complete Python import script for Blender.
   *
   * @param {object} data Export payload from buildExportData().
   * @returns {string}
   */
  function buildBlenderPython(data) {
    return [
      "# Generated by p5_ComfyUI_EasyTrack.",
      "# In Blender: Scripting workspace > open this file > Run Script.",
      "import json",
      "import bpy",
      "",
      `DATA = json.loads(${JSON.stringify(JSON.stringify(data))})`,
      blenderHelperSource(),
      "import_easytrack(DATA)",
      "",
    ].join("\n");
  }

  /**
   * Returns helper functions embedded into the generated Blender Python script.
   *
   * Coordinates are mapped with image center at world origin, x to the right,
   * and z upward, using SCALE to keep pixel-space tracking data usable in 3D.
   *
   * @returns {string}
   */
  function blenderHelperSource() {
    return `
SCALE = 0.01

def safe_name(value):
    text = str(value)
    for ch in '\\\\/:*?"<>|':
        text = text.replace(ch, '_')
    return text

def map_point(point, data):
    return (
        (float(point[0]) - float(data['width']) * 0.5) * SCALE,
        0.0,
        (float(data['height']) * 0.5 - float(point[1])) * SCALE,
    )

def material_for(track):
    name = 'EasyTrack_Material_' + safe_name(track['id'])
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    color = track.get('color', [255, 255, 255])
    material.diffuse_color = (
        float(color[0]) / 255.0,
        float(color[1]) / 255.0,
        float(color[2]) / 255.0,
        1.0,
    )
    return material

def make_curve_object(name, points, material, collection):
    if len(points) < 2:
        return None
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = 0.004
    curve.bevel_resolution = 0
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1.0)
    obj = bpy.data.objects.new(name, curve)
    obj.data.materials.append(material)
    collection.objects.link(obj)
    return obj

def key_visibility(obj, frame, visible):
    obj.hide_viewport = not visible
    obj.hide_render = not visible
    obj.keyframe_insert(data_path='hide_viewport', frame=frame)
    obj.keyframe_insert(data_path='hide_render', frame=frame)

def key_single_frame_visibility(obj, frame, frame_count):
    if frame > 1:
        key_visibility(obj, frame - 1, False)
    key_visibility(obj, frame, True)
    if frame < frame_count:
        key_visibility(obj, frame + 1, False)

def set_interpolation(obj, mode='CONSTANT'):
    if not obj.animation_data or not obj.animation_data.action:
        return
    for fcurve in obj.animation_data.action.fcurves:
        for keyframe in fcurve.keyframe_points:
            keyframe.interpolation = mode

def make_bbox_points(bbox, data):
    x, y, w, h = bbox
    return [
        map_point([x, y], data),
        map_point([x + w, y], data),
        map_point([x + w, y + h], data),
        map_point([x, y + h], data),
        map_point([x, y], data),
    ]

def make_text_label(track, parent, material, collection):
    bpy.ops.object.text_add(location=(0.08, 0.0, 0.08), rotation=(1.57079632679, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = safe_name(str(track['label']) + ' #' + str(track['id']) + ' label')
    obj.data.body = str(track['label']) + ' #' + str(track['id'])
    obj.data.align_x = 'LEFT'
    obj.data.size = 0.12
    if parent:
        obj.parent = parent
    if obj.name not in collection.objects:
        try:
            collection.objects.link(obj)
        except RuntimeError:
            pass
    obj.data.materials.append(material)
    return obj

def import_track(data, track, parent_collection):
    include = data.get('include', {})
    material = material_for(track)
    label = str(track.get('label', 'obj')) + ' #' + str(track.get('id', ''))
    track_name = safe_name(label)
    track_collection = bpy.data.collections.new('Track_' + track_name)
    parent_collection.children.link(track_collection)

    empty = None
    if include.get('points'):
        empty = bpy.data.objects.new('Centroid_' + track_name, None)
        empty.empty_display_type = 'PLAIN_AXES'
        empty.empty_display_size = 0.12
        empty['easytrack_id'] = str(track.get('id', ''))
        empty['easytrack_label'] = str(track.get('label', ''))
        track_collection.objects.link(empty)
    if include.get('labels'):
        make_text_label(track, empty, material, track_collection)

    frame_lookup = {}
    for frame in track.get('frames', []):
        frame_lookup[int(frame['frame'])] = frame

    if empty:
        for source_frame in range(int(data['frameCount'])):
            blender_frame = source_frame + 1
            frame = frame_lookup.get(source_frame)
            visible = bool(frame and frame.get('visible') and frame.get('point'))
            key_visibility(empty, blender_frame, visible)
            if visible:
                empty.location = map_point(frame['point'], data)
                empty['easytrack_score'] = -1.0 if frame.get('score') is None else float(frame.get('score'))
                empty['easytrack_area'] = -1.0 if frame.get('area') is None else float(frame.get('area'))
                empty['easytrack_source_frame'] = source_frame
                empty.keyframe_insert(data_path='location', frame=blender_frame)
                empty.keyframe_insert(data_path='["easytrack_score"]', frame=blender_frame)
                empty.keyframe_insert(data_path='["easytrack_area"]', frame=blender_frame)

        set_interpolation(empty, 'CONSTANT')

    for frame in track.get('frames', []):
        if not frame.get('visible'):
            continue
        blender_frame = int(frame['frame']) + 1
        if include.get('boxes') and frame.get('bbox'):
            bbox_obj = make_curve_object(
                'BBox_' + track_name + '_f' + str(frame['frame']),
                make_bbox_points(frame['bbox'], data),
                material,
                track_collection,
            )
            if bbox_obj:
                bbox_obj['easytrack_kind'] = 'bbox'
                bbox_obj['easytrack_source_frame'] = int(frame['frame'])
                key_single_frame_visibility(bbox_obj, blender_frame, int(data['frameCount']))
                set_interpolation(bbox_obj, 'CONSTANT')

        if include.get('contours'):
            for contour_index, contour in enumerate(frame.get('contours', [])):
                if len(contour) < 2:
                    continue
                points = [map_point(point, data) for point in contour]
                points.append(points[0])
                contour_obj = make_curve_object(
                    'Contour_' + track_name + '_f' + str(frame['frame']) + '_' + str(contour_index + 1),
                    points,
                    material,
                    track_collection,
                )
                if contour_obj:
                    contour_obj['easytrack_kind'] = 'simplified_contour'
                    contour_obj['easytrack_source_frame'] = int(frame['frame'])
                    contour_obj['easytrack_score'] = -1.0 if frame.get('score') is None else float(frame.get('score'))
                    contour_obj['easytrack_area'] = -1.0 if frame.get('area') is None else float(frame.get('area'))
                    key_single_frame_visibility(contour_obj, blender_frame, int(data['frameCount']))
                    set_interpolation(contour_obj, 'CONSTANT')

def import_easytrack(data):
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = int(data['frameCount'])
    scene.render.fps = int(round(float(data['fps'])))

    root = bpy.data.collections.new('EasyTrack_Import')
    scene.collection.children.link(root)
    root['source_width'] = int(data['width'])
    root['source_height'] = int(data['height'])
    root['source_fps'] = float(data['fps'])

    for track in data.get('tracks', []):
        import_track(data, track, root)

    scene.frame_set(1)
    print('EasyTrack import complete: %d tracks, %d frames' % (len(data.get('tracks', [])), int(data['frameCount'])))
`;
  }

  /**
   * Builds a complete Python import script for Maya.
   *
   * @param {object} data Export payload from buildExportData().
   * @returns {string}
   */
  function buildMayaPython(data) {
    return [
      "# Generated by p5_ComfyUI_EasyTrack.",
      "# In Maya: Script Editor > Python tab > open or paste this file > Run.",
      "import json",
      "import maya.cmds as cmds",
      "",
      `DATA = json.loads(${JSON.stringify(JSON.stringify(data))})`,
      mayaHelperSource(),
      "import_easytrack(DATA)",
      "",
    ].join("\n");
  }

  /**
   * Returns helper functions embedded into the generated Maya Python script.
   *
   * The Maya exporter uses the same world-space convention as Blender so
   * students can compare files between the two apps without flipping axes.
   *
   * @returns {string}
   */
  function mayaHelperSource() {
    return `
SCALE = 0.01

def safe_name(value):
    text = str(value)
    for ch in '\\\\/:*?"<>| #':
        text = text.replace(ch, '_')
    return text

def map_point(point, data):
    return (
        (float(point[0]) - float(data['width']) * 0.5) * SCALE,
        0.0,
        (float(data['height']) * 0.5 - float(point[1])) * SCALE,
    )

def set_time_unit(fps):
    fps = float(fps)
    if abs(fps - 24.0) < 0.01:
        cmds.currentUnit(time='film')
    elif abs(fps - 25.0) < 0.01:
        cmds.currentUnit(time='pal')
    elif abs(fps - 30.0) < 0.01:
        cmds.currentUnit(time='ntsc')
    elif abs(fps - 48.0) < 0.01:
        cmds.currentUnit(time='show')
    elif abs(fps - 60.0) < 0.01:
        cmds.currentUnit(time='ntscf')

def make_material(track):
    name = 'EasyTrack_Material_' + safe_name(track.get('id', ''))
    if cmds.objExists(name):
        return name
    shader = cmds.shadingNode('lambert', asShader=True, name=name)
    color = track.get('color', [255, 255, 255])
    cmds.setAttr(shader + '.color', float(color[0]) / 255.0, float(color[1]) / 255.0, float(color[2]) / 255.0, type='double3')
    return shader

def apply_curve_color(curve, track):
    color = track.get('color', [255, 255, 255])
    cmds.setAttr(curve + '.overrideEnabled', 1)
    cmds.setAttr(curve + '.overrideRGBColors', 1)
    cmds.setAttr(curve + '.overrideColorRGB', float(color[0]) / 255.0, float(color[1]) / 255.0, float(color[2]) / 255.0)

def add_attr_once(node, name, attr_type='double'):
    if not cmds.attributeQuery(name, node=node, exists=True):
        cmds.addAttr(node, longName=name, attributeType=attr_type, keyable=True)

def key_visibility(node, frame, visible):
    cmds.setAttr(node + '.visibility', bool(visible))
    cmds.setKeyframe(node, attribute='visibility', time=frame)

def key_single_frame_visibility(node, frame, frame_count):
    if frame > 1:
        key_visibility(node, frame - 1, False)
    key_visibility(node, frame, True)
    if frame < frame_count:
        key_visibility(node, frame + 1, False)

def set_linear_or_constant(node):
    try:
        cmds.keyTangent(node, interpolation='linear')
    except Exception:
        pass

def make_bbox_points(bbox, data):
    x, y, w, h = bbox
    return [
        map_point([x, y], data),
        map_point([x + w, y], data),
        map_point([x + w, y + h], data),
        map_point([x, y + h], data),
        map_point([x, y], data),
    ]

def make_curve(name, points, track, parent):
    if len(points) < 2:
        return None
    curve = cmds.curve(degree=1, point=points, name=safe_name(name))
    apply_curve_color(curve, track)
    cmds.parent(curve, parent)
    return curve

def import_track(data, track, parent):
    include = data.get('include', {})
    track_name = safe_name(str(track.get('label', 'obj')) + '_' + str(track.get('id', '')))
    group = cmds.group(empty=True, name='Track_' + track_name, parent=parent)
    material = make_material(track)

    locator = None
    if include.get('points'):
        locator = cmds.spaceLocator(name='Centroid_' + track_name)[0]
        cmds.parent(locator, group)
        cmds.setAttr(locator + '.localScaleX', 0.12)
        cmds.setAttr(locator + '.localScaleY', 0.12)
        cmds.setAttr(locator + '.localScaleZ', 0.12)
        add_attr_once(locator, 'easytrackScore')
        add_attr_once(locator, 'easytrackArea')
        add_attr_once(locator, 'easytrackSourceFrame')

    frame_lookup = {}
    for frame in track.get('frames', []):
        frame_lookup[int(frame['frame'])] = frame

    if locator:
        for source_frame in range(int(data['frameCount'])):
            maya_frame = source_frame + 1
            frame = frame_lookup.get(source_frame)
            visible = bool(frame and frame.get('visible') and frame.get('point'))
            key_visibility(locator, maya_frame, visible)
            if visible:
                x, y, z = map_point(frame['point'], data)
                cmds.setAttr(locator + '.translate', x, y, z, type='double3')
                cmds.setKeyframe(locator, attribute='translateX', time=maya_frame)
                cmds.setKeyframe(locator, attribute='translateY', time=maya_frame)
                cmds.setKeyframe(locator, attribute='translateZ', time=maya_frame)
                cmds.setAttr(locator + '.easytrackScore', -1.0 if frame.get('score') is None else float(frame.get('score')))
                cmds.setAttr(locator + '.easytrackArea', -1.0 if frame.get('area') is None else float(frame.get('area')))
                cmds.setAttr(locator + '.easytrackSourceFrame', source_frame)
                cmds.setKeyframe(locator, attribute='easytrackScore', time=maya_frame)
                cmds.setKeyframe(locator, attribute='easytrackArea', time=maya_frame)
                cmds.setKeyframe(locator, attribute='easytrackSourceFrame', time=maya_frame)

        set_linear_or_constant(locator)

    for frame in track.get('frames', []):
        if not frame.get('visible'):
            continue
        maya_frame = int(frame['frame']) + 1
        if include.get('boxes') and frame.get('bbox'):
            bbox = make_curve('BBox_' + track_name + '_f' + str(frame['frame']), make_bbox_points(frame['bbox'], data), track, group)
            if bbox:
                key_single_frame_visibility(bbox, maya_frame, int(data['frameCount']))

        if include.get('contours'):
            for contour_index, contour in enumerate(frame.get('contours', [])):
                if len(contour) < 2:
                    continue
                points = [map_point(point, data) for point in contour]
                points.append(points[0])
                curve = make_curve('Contour_' + track_name + '_f' + str(frame['frame']) + '_' + str(contour_index + 1), points, track, group)
                if curve:
                    add_attr_once(curve, 'easytrackScore')
                    add_attr_once(curve, 'easytrackArea')
                    add_attr_once(curve, 'easytrackSourceFrame')
                    cmds.setAttr(curve + '.easytrackScore', -1.0 if frame.get('score') is None else float(frame.get('score')))
                    cmds.setAttr(curve + '.easytrackArea', -1.0 if frame.get('area') is None else float(frame.get('area')))
                    cmds.setAttr(curve + '.easytrackSourceFrame', int(frame['frame']))
                    key_single_frame_visibility(curve, maya_frame, int(data['frameCount']))

def import_easytrack(data):
    set_time_unit(data.get('fps', 24))
    cmds.playbackOptions(minTime=1, maxTime=int(data['frameCount']), animationStartTime=1, animationEndTime=int(data['frameCount']))
    root = cmds.group(empty=True, name='EasyTrack_Import')
    if not cmds.attributeQuery('sourceWidth', node=root, exists=True):
        cmds.addAttr(root, longName='sourceWidth', attributeType='double')
        cmds.addAttr(root, longName='sourceHeight', attributeType='double')
        cmds.addAttr(root, longName='sourceFps', attributeType='double')
    cmds.setAttr(root + '.sourceWidth', float(data['width']))
    cmds.setAttr(root + '.sourceHeight', float(data['height']))
    cmds.setAttr(root + '.sourceFps', float(data['fps']))

    for track in data.get('tracks', []):
        import_track(data, track, root)

    cmds.currentTime(1)
    print('EasyTrack import complete: %d tracks, %d frames' % (len(data.get('tracks', [])), int(data['frameCount'])))
`;
  }

  /**
   * Starts a browser download for generated text content.
   *
   * @param {string} filename Suggested download filename.
   * @param {string} text File contents.
   */
  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Builds an export filename with the source base name and a local timestamp.
   *
   * @param {object} sequence Normalized tracking sequence.
   * @param {string} target Export target label.
   * @param {string} extension File extension without dot.
   * @returns {string}
   */
  function exportFilename(sequence, target, extension) {
    return `${exportBaseName(sequence)}_${target}_${timestampForFilename(new Date())}.${extension}`;
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
   * Returns a filesystem-friendly base name for generated export files.
   *
   * @param {object} sequence Normalized tracking sequence.
   * @returns {string}
   */
  function exportBaseName(sequence) {
    const source = sequence && (sequence.sourceBaseName || sequence.sourceFileName);
    return sanitizeFilenameBase(removeExtension(source || "bouncing")) || "bouncing";
  }

  /**
   * Removes the last filename extension.
   *
   * @param {string} filename Filename or path.
   * @returns {string}
   */
  function removeExtension(filename) {
    return String(filename).replace(/\.[^/.\\]+$/, "");
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
      .replace(/^_+|_+$/g, "");
  }

  /**
   * Escapes one CSV cell.
   *
   * @param {*} value Cell value.
   * @returns {string}
   */
  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  /**
   * Converts RLE counts into a CSV-friendly string.
   *
   * Compressed RLE strings are preserved. Uncompressed numeric counts are joined
   * into a space-delimited string so the CSV still has a single RLE cell.
   *
   * @param {string|number[]} counts RLE counts.
   * @returns {string}
   */
  function rleCountsString(counts) {
    if (Array.isArray(counts)) {
      return counts.join(" ");
    }
    return counts == null ? "" : String(counts);
  }

  /**
   * Escapes text for XML attributes and text nodes.
   *
   * @param {string} value Raw text.
   * @returns {string}
   */
  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Converts an RGB triplet to a CSS rgb() color.
   *
   * @param {number[]} color RGB color triplet.
   * @returns {string}
   */
  function rgbCss(color) {
    return `rgb(${color[0]},${color[1]},${color[2]})`;
  }

  /**
   * Formats an SVG numeric attribute compactly.
   *
   * @param {number} value Raw value.
   * @returns {string}
   */
  function numberAttr(value) {
    return String(roundForExport(Number(value) || 0));
  }

  /**
   * Pads a 1-based frame number based on total frame count.
   *
   * @param {number} frameNumber One-based frame number.
   * @param {number} frameCount Total frame count.
   * @returns {string}
   */
  function padFrame(frameNumber, frameCount) {
    return String(frameNumber).padStart(String(frameCount).length, "0");
  }

  /**
   * Converts arbitrary track IDs into SVG-id-safe suffixes.
   *
   * @param {number|string} value Raw ID.
   * @returns {string}
   */
  function safeSvgId(value) {
    const text = sanitizeFilenameBase(value);
    return text || `id_${Math.abs(hashString(String(value)))}`;
  }

  /**
   * Rounds exported numeric values to keep generated scripts reasonably small.
   *
   * @param {number} value Raw numeric value.
   * @returns {number}
   */
  function roundForExport(value) {
    return Math.round(value * 1000) / 1000;
  }

  /**
   * Chooses a stable color for a numeric or string object ID.
   *
   * This mirrors sketch.js so exported files stay visually consistent with the
   * p5 view, including projects with more tracked objects than base colors.
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
      Math.round(255 * hueToRgb(p, q, h + 1 / 3)),
      Math.round(255 * hueToRgb(p, q, h)),
      Math.round(255 * hueToRgb(p, q, h - 1 / 3)),
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

  global.EasyTrackExporter = {
    createControls,
    buildExportData,
    buildCsv,
    buildLayeredSvg,
    buildAfterEffectsJsx,
    buildBlenderPython,
    buildMayaPython,
  };
})(window);
