/*******************************************************************************
 *
 *    GENERAL CONFIGURATION PARAMETERS
 *
 ******************************************************************************/

// Number of digits on the fractional part of displayed latitudes/longitudes.
const coordinatesFractionalDigits = 8;

// Maximum number of points that can be added at a time by the "multi-point
// line" tool (to prevent severe performance issues on the browser).
const maxMultiPointLinePoints = 1000;

// Radius of points drawn on the map.
const pointRadius = 7;

// Style for drawing normal (unselected/non-preview) points on the map.
const normalPointStyle = {
  color: "blue",
  fillColor: "lightsteelblue",
  fillOpacity: 1.0,
  weight: 2
};

// Style for drawing preview points on the map.
const previewPointStyle = {
  color: "gray",
  fillColor: "lightgray",
  fillOpacity: 1.0,
  weight: 2
};

// Styles for drawing normal (unselected/non-preview) segments on the map.
const normalSegmentStyle = { color: "blue", weight: 2 };
const normalSegmentArrowStyle = {
  offset: "50%",
  repeat: 0,
  symbol: L.Symbol.arrowHead({
    pathOptions: { color: "blue", weight: 2, stroke: true },
    pixelSize: 10,
    polygon: false
  })
};

// Styles for drawing preview segments on the map.
const previewSegmentStyle = { color: "darkgray", weight: 2 };
const previewSegmentArrowStyle = {
  offset: "50%",
  repeat: 0,
  symbol: L.Symbol.arrowHead({
    pathOptions: { color: "darkgray", weight: 2, stroke: true },
    pixelSize: 10,
    polygon: false
  })
};

// Enum for identifying the drawing tools.
const ToolsEnum = {
  ADDPOINT: "#add-point",
  DELETEPOINT: "#delete-point",
  MOVEPOINT: "#move-point",
  EDITPOINT: "#edit-point",
  POINTINFO: "#point-info",
  MULTIPOINTLINE: "#multi-point-line",
  GLOBALSETTINGS: "#global-settings"
};

// Number of satellites (for generating NMEA logs). Do not change!
const numSatellites = 12;

/*******************************************************************************
 *
 *    MAP CONFIGURATION PARAMETERS
 *
 ******************************************************************************/

// Minimum/maximum zoom levels on the map.
const minZoomLevel = 2;
const maxZoomLevel = 19;

// Map tile provider.
const tileOpenStreetMapStreets = L.tileLayer(
  "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png?lang=en",
  {
    attribution:
      "&copy; <a href='https://wikimediafoundation.org/wiki/Maps_Terms_of_Use'>Wikimedia</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
    minZoom: minZoomLevel,
    maxZoom: maxZoomLevel
  }
);

// Satellite image tile provider.
const tileEsriWorldImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "&copy; <a href='https://www.esri.com/'>Esri</a>",
    minZoom: minZoomLevel,
    maxZoom: maxZoomLevel
  }
);

// Human-readable names for the available map layers.
const mapLayers = {
  Map: tileOpenStreetMapStreets,
  Satellite: tileEsriWorldImagery
};

/*******************************************************************************
 *
 *    AUXILIARY GLOBAL VARIABLES
 *
 ******************************************************************************/

// Frequency at which GPS positions are captured (defines the time between two
// consecutive points in the drawn path).
let gpsFrequency = null;

// Distance between consecutive points for the "multi-point line" tool.
let multiPointLineStepSize = null;

// Time/date at which the first GPS position was obtained.
let startDate = null;

// Arrays which hold the added/preview points on the map.
const pointArray = [];
const previewPointArray = [];

// Arrays which hold the segments connecting added/preview points.
const segmentArray = [];
const segmentArrowArray = [];
const previewSegmentArray = [];
const previewSegmentArrowArray = [];

// Reference to and index of selected point and its original coordinates (used
// for things such as restoring its position if a moving operation is aborted).
let selectedPoint = null;
let selectedPointIndex = null;
let selectedPointOriginalCoordinates = null;

// Last mouse cursor coordinates on the map.
let lastMouseCoordinates = null;

// Array with the path creation history for "undo" operations.
const undoHistoryArray = [];

// Array with the path "undo" history for "redo" operations.
const redoHistoryArray = [];

// Map handle.
let map = null;

// Map layer control handle.
let mapLayerControl = null;

/*******************************************************************************
 *
 *    DEBUGGING FUNCTIONS
 *
 ******************************************************************************/

/**
 * Writes a message to the console if the given condition is not true.
 */
function expect(condition, message) {
  if (!condition) {
    console.warn(message);
  }
}

/*******************************************************************************
 *
 *    POINT FUNCTIONS
 *
 ******************************************************************************/

/**
 * Returns a reference to the last point added.
 *
 * @return {L.CircleMarker | null} Last added point (if applicable) or null.
 */
function getLastAddedPoint() {
  return pointArray.length > 0 ? pointArray[pointArray.length - 1] : null;
}

/**
 * Adds a point to the map.
 *
 * @param {L.LatLng} coordinates Point coordinates.
 */
function addPoint(coordinates) {
  const point = L.circleMarker(coordinates)
    .setStyle(normalPointStyle)
    .setRadius(pointRadius)
    .on("click", onPointClick)
    .addTo(map);
  pointArray.push(point);
}

/**
 * Removes a point from the map.
 *
 * @param {L.CircleMarker} point Point to be removed.
 */
function removePoint(point) {
  map.removeLayer(point);
  pointArray.splice(pointArray.indexOf(point), 1);
  redrawOrientedSegments();
}

/**
 * Removes all points from the map.
 */
function removeAllPoints() {
  for (const point of pointArray) {
    map.removeLayer(point);
  }
  pointArray.length = 0;
}

/**
 * Adds a preview point to the map.
 *
 * @param {L.LatLng} coordinates Point coordinates.
 */
function addPreviewPoint(coordinates) {
  const point = L.circleMarker(coordinates)
    .setStyle(previewPointStyle)
    .setRadius(pointRadius)
    .addTo(map);
  previewPointArray.push(point);
}

/**
 * Removes all preview points from the map.
 */
function removeAllPreviewPoints() {
  for (const point of previewPointArray) {
    map.removeLayer(point);
  }
  previewPointArray.length = 0;
}

/**
 * Returns the time associated with a given point.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Date} Time associated with the point.
 */
function getTimeForPoint(pointIndex) {
  const pointDate = new Date(startDate);
  const pointDtMilliseconds = (1000 * pointIndex) / gpsFrequency;
  pointDate.setMilliseconds(startDate.getMilliseconds() + pointDtMilliseconds);
  return pointDate;
}

/**
 * Returns the distance between a point and the next one on the drawn path.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Number | null} Distance to next point (if applicable) or null.
 */
function getDistanceToNextPoint(pointIndex) {
  // If there is no next point (pointIndex is the last one).
  if (pointIndex + 1 === pointArray.length) {
    return null;
  }
  const thisCoordinates = pointArray[pointIndex].getLatLng();
  const nextCoordinates = pointArray[pointIndex + 1].getLatLng();
  return thisCoordinates.distanceTo(nextCoordinates);
}

/**
 * Returns the distance between a point and the previous one on the drawn path.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Number | null} Distance to previous point (if applicable) or null.
 */
function getDistanceToPreviousPoint(pointIndex) {
  // If there is no previous point (pointIndex is the first one).
  if (pointIndex === 0) {
    return null;
  }
  const thisCoordinates = pointArray[pointIndex].getLatLng();
  const prevCoordinates = pointArray[pointIndex - 1].getLatLng();
  return thisCoordinates.distanceTo(prevCoordinates);
}

/**
 * Returns the object speed at a certain location in m/s.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Number | null} Object speed (if applicable) or null.
 */
function getSpeedAtPointMps(pointIndex) {
  if (pointArray.length < 2) {
    return null;
  }
  const distance =
    getDistanceToNextPoint(pointIndex) ||
    getDistanceToPreviousPoint(pointIndex);
  expect(distance !== null, "getSpeedAtPointMps(): distance === null");
  return distance * gpsFrequency;
}

/**
 * Returns the object speed at a point in knots.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Number | null} Object speed (if applicable) or null.
 */
function getSpeedAtPointKnots(pointIndex) {
  if (pointArray.length < 2) {
    return null;
  }
  return getSpeedAtPointMps(pointIndex) * 1.943844;
}

/**
 * Returns the bearing angle at a given point in degrees.
 *
 * @param {Number} pointIndex Point index (position on pointArray).
 * @return {Number} Bearing angle (if applicable) or null.
 * @note The bearing angle is 0° if the object is moving towards the true North
 *       and increases clockwise up to 360°.
 */
function getPointBearing(pointIndex) {
  if (pointArray.length < 2) {
    return null;
  }

  let srcPointIndex = pointIndex;
  let dstPointIndex = pointIndex + 1;
  if (dstPointIndex === pointArray.length) {
    srcPointIndex = pointIndex - 1;
    dstPointIndex = pointIndex;
  }

  const srcCoordinates = pointArray[srcPointIndex].getLatLng();
  const dstCoordinates = pointArray[dstPointIndex].getLatLng();
  if (srcCoordinates === dstCoordinates) {
    return 0.0;
  }

  const srcLat = degreesToRadians(srcCoordinates.lat);
  const srcLng = degreesToRadians(srcCoordinates.lng);
  const dstLat = degreesToRadians(dstCoordinates.lat);
  const dstLng = degreesToRadians(dstCoordinates.lng);

  const y = Math.sin(dstLng - srcLng) * Math.cos(dstLat);
  const x =
    Math.cos(srcLat) * Math.sin(dstLat) -
    Math.sin(srcLat) * Math.cos(dstLat) * Math.cos(dstLng - srcLng);

  // This angle goes from -180 to 180, with 0 being true North.
  const angleDegrees = (Math.atan2(y, x) / Math.PI) * 180;
  return (angleDegrees + 360) % 360;
}

/**
 * Sets the selected point and updates the relevant segments accordingly.
 *
 * @param {L.CircleMarker} newSelectedPoint Point to be selected.
 */
function setSelectedPoint(newSelectedPoint = null) {
  // If a point is currently selected...
  if (selectedPoint !== null) {
    // Indicate visually that it is no longer selected.
    selectedPoint.setStyle(normalPointStyle);
    removeAllPreviewOrientedSegments();
    redrawOrientedSegments();

    // If we are displaying a popup with the details of the selected point and
    // we select a different point (or none), hide the popup.
    if (newSelectedPoint !== selectedPoint) {
      hideSelectedPointInfoPopup();
    }
  }

  selectedPoint = newSelectedPoint;
  selectedPointOriginalCoordinates =
    selectedPoint !== null ? selectedPoint.getLatLng() : null;

  if (newSelectedPoint !== null) {
    selectedPointIndex = pointArray.indexOf(selectedPoint);
    selectedPoint.setStyle(previewPointStyle);

    expect(
      selectedPointIndex >= 0,
      "setSelectedPoint(): selectedPointIndex < 0"
    );
    expect(
      selectedPointIndex < pointArray.length,
      "setSelectedPoint(): selectedPointIndex >= pointArray.length;"
    );

    // "Replace" the oriented segments inciding on the selected point with
    // preview oriented segments.
    if (selectedPointIndex > 0) {
      hideOrientedSegment(selectedPointIndex - 1);
      const prevPoint = pointArray[selectedPointIndex - 1];
      addPreviewOrientedSegment(
        prevPoint.getLatLng(),
        selectedPoint.getLatLng()
      );
    }
    if (selectedPointIndex < segmentArray.length) {
      hideOrientedSegment(selectedPointIndex);
      const nextPoint = pointArray[selectedPointIndex + 1];
      addPreviewOrientedSegment(
        selectedPoint.getLatLng(),
        nextPoint.getLatLng()
      );
    }

    if (getSelectedTool() === ToolsEnum.POINTINFO) {
      showSelectedPointInfoPopup();
    }
  } else {
    selectedPointIndex = null;
  }
}

/**
 * Sets the coordinates of the selected point.
 *
 * @param {L.LatLng} coordinates New point coordinates.
 */
function setSelectedPointCoordinates(coordinates) {
  expect(
    selectedPoint !== null,
    "setSelectedPointCoordinates(): selectedPoint === null"
  );

  selectedPoint.setLatLng(coordinates);
  removeAllPreviewOrientedSegments();

  // Update the preview segments which incide on the selected point.
  if (selectedPointIndex > 0) {
    const prevPoint = pointArray[selectedPointIndex - 1];
    addPreviewOrientedSegment(prevPoint.getLatLng(), selectedPoint.getLatLng());
  }
  if (selectedPointIndex < segmentArray.length) {
    const nextPoint = pointArray[selectedPointIndex + 1];
    addPreviewOrientedSegment(selectedPoint.getLatLng(), nextPoint.getLatLng());
  }
}

/*******************************************************************************
 *
 *    SEGMENT FUNCTIONS
 *
 ******************************************************************************/

/**
 * Adds an oriented segment to the map.
 *
 * @param {L.LatLng} coordinates1 FROM vertex of the oriented segment.
 * @param {L.LatLng} coordinates2 TO vertex of the oriented segment.
 */
function addOrientedSegment(coordinates1, coordinates2) {
  // Draw the segment.
  const segment = L.polyline([coordinates1, coordinates2], normalSegmentStyle);
  segment.addTo(map);
  segment.bringToBack();
  segmentArray.push(segment);

  // Draw the arrow which defines the segment's orientation.
  const segmentArrow = L.polylineDecorator(segment);
  segmentArrow.setPatterns([normalSegmentArrowStyle]);
  segmentArrow.addTo(map);
  segmentArrow.bringToBack();
  segmentArrowArray.push(segmentArrow);
}

/**
 * Hides an oriented segment from the map.
 *
 * @param {Number} segmentIndex Segment index (position on segmentArray).
 */
function hideOrientedSegment(segmentIndex) {
  map.removeLayer(segmentArray[segmentIndex]);
  map.removeLayer(segmentArrowArray[segmentIndex]);
}

/**
 * Redraws all non-preview oriented segments on the map.
 */
function redrawOrientedSegments() {
  // Hide all oriented segments.
  for (let i = 0; i < segmentArray.length; ++i) {
    hideOrientedSegment(i);
  }

  // Remove all oriented segments.
  segmentArray.length = 0;
  segmentArrowArray.length = 0;

  // Redraw the oriented segments which have been added by the user.
  for (let i = 1; i < pointArray.length; ++i) {
    const p0 = pointArray[i - 1];
    const p1 = pointArray[i];
    addOrientedSegment(p0.getLatLng(), p1.getLatLng());
  }
}

/**
 * Removes all oriented segments from the map.
 */
function removeAllOrientedSegments() {
  for (let i = 0; i < segmentArray.length; ++i) {
    hideOrientedSegment(i);
  }
  segmentArray.length = 0;
  segmentArrowArray.length = 0;
}

/**
 * Adds a preview oriented segment to the map.
 *
 * @param {L.LatLng} coordinates1 the FROM vertex of the oriented segment.
 * @param {L.LatLng} coordinates2 the TO vertex of the oriented segment.
 */
function addPreviewOrientedSegment(coordinates1, coordinates2) {
  const segment = L.polyline([coordinates1, coordinates2], previewSegmentStyle);
  const segmentArrow = L.polylineDecorator(segment);
  segmentArrow.setPatterns([previewSegmentArrowStyle]);
  segment.addTo(map);
  segment.bringToBack();
  segmentArrow.addTo(map);
  segmentArrow.bringToBack();
  previewSegmentArray.push(segment);
  previewSegmentArrowArray.push(segmentArrow);
}

/**
 * Hides an oriented preview segment from the map.
 *
 * @param {Number} segmentIndex Segment index (position on previewSegmentArray).
 */
function hidePreviewOrientedSegment(segmentIndex) {
  map.removeLayer(previewSegmentArray[segmentIndex]);
  map.removeLayer(previewSegmentArrowArray[segmentIndex]);
}

/**
 * Removes all preview oriented segments.
 */
function removeAllPreviewOrientedSegments() {
  for (let i = 0; i < previewSegmentArray.length; ++i) {
    hidePreviewOrientedSegment(i);
  }
  previewSegmentArray.length = 0;
  previewSegmentArrowArray.length = 0;
}

/*******************************************************************************
 *
 *    CONVERTER FUNCTIONS
 *
 ******************************************************************************/

/**
 * Generates the UTC date as a string for a given time value.
 *
 * @param {Date} time Time value.
 * @return {String} UTC date for the given time in format "YYYY-MM-DD".
 */
function stringUTCDate(time) {
  return time.toISOString().match(/\d{4}-\d{2}-\d{2}/)[0];
}

/**
 * Generates the UTC time-of-day as a string for a given time value.
 *
 * @param {Date} time Time value.
 * @return {String} UTC date for the given time in format "HH:MM:SS.SSS".
 */
function stringUTCTime(time) {
  return time.toISOString().match(/\d{2}:\d{2}:\d{2}\.\d{3}/)[0];
}

/**
 * Converts an angle from degrees to radians.
 *
 * @param {Number} degrees Angle in degrees.
 * @return {Number} Input angle in radians.
 */
function degreesToRadians(degrees) {
  return degrees / 180.0 / Math.PI;
}

/*******************************************************************************
 *
 *    SEARCH FUNCTIONS
 *
 ******************************************************************************/

/**
 * Processes the search results from the reverse geolocation server.
 *
 * @param {Object} searchResults Search results.
 * @return {Object} Processed search results.
 */
function processSearchResults(searchResults) {
  const propName = this.options.propertyName;
  const propLoc = this.options.propertyLoc;
  const processedResults = {};
  for (const location of searchResults) {
    const locationName = this._getPath(location, propName);
    processedResults[locationName] = L.latLng(
      location[propLoc[0]],
      location[propLoc[1]]
    );
    processedResults[locationName].__boundingBox__ = [
      [location.boundingbox[0], location.boundingbox[2]].map(parseFloat),
      [location.boundingbox[1], location.boundingbox[3]].map(parseFloat)
    ];
  }
  return processedResults;
}

/*******************************************************************************
 *
 *    AUXILIARY FUNCTIONS FOR EVENT HANDLERS
 *
 ******************************************************************************/

/**
 * Removes all points and segments from the map.
 */
function clearMap() {
  setSelectedPoint();
  removeAllPoints();
  removeAllPreviewPoints();
  removeAllOrientedSegments();
  removeAllPreviewOrientedSegments();
}

/**
 * Discards all stored "undo" and "redo" actions.
 */
function clearUndoRedoActions() {
  undoHistoryArray.length = 0;
  redoHistoryArray.length = 0;
  updateUndoRedoButtons();
}

/**
 * Updates the "undo" and "redo" buttons according to whether such actions
 * are possible or not.
 */
function updateUndoRedoButtons() {
  if (undoHistoryArray.length > 0) {
    $("#undo").removeAttr("disabled");
  } else {
    $("#undo").attr("disabled", "disabled");
  }

  if (redoHistoryArray.length > 0) {
    $("#redo").removeAttr("disabled");
  } else {
    $("#redo").attr("disabled", "disabled");
  }
}

/**
 * Clones the currently drawn path.
 *
 * @return {L.LatLng[]} Copy of currently drawn path.
 */
function cloneCurrentPath() {
  const pathCoordinates = [];
  for (const point of pointArray) {
    const coordinates = point.getLatLng();
    pathCoordinates.push(L.latLng(coordinates.lat, coordinates.lng));
  }
  return pathCoordinates;
}

/**
 * Exchange the currently drawn path with a new path.
 *
 * @param {L.LatLng[]} pathCoordinates New path.
 */
function rebuildPath(pathCoordinates) {
  clearMap();
  for (const coordinates of pathCoordinates) {
    if (getLastAddedPoint() !== null) {
      addOrientedSegment(getLastAddedPoint().getLatLng(), coordinates);
    }
    addPoint(coordinates);
  }
  updatePathStats();
}

/**
 * Compares two paths.
 *
 * @param {L.LatLng[]} pathCoordinates0 First path.
 * @param {L.LatLng[]} pathCoordinates1 Second path.
 * @return {Boolean} True if the paths are equal, false otherwise.
 */
function comparePaths(pathCoordinates0, pathCoordinates1) {
  if (pathCoordinates0.length !== pathCoordinates1.length) {
    return false;
  }
  for (let i = 0; i < pathCoordinates0.length; ++i) {
    if (
      pathCoordinates0[i].lat !== pathCoordinates1[i].lat ||
      pathCoordinates0[i].lng !== pathCoordinates1[i].lng
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Stores the currently drawn path (for "undo" action) if it has changed since
 * the last time a path was stored, otherwise do nothing.
 */
function storeCurrentPathIfChanged() {
  const pathCoordinates = cloneCurrentPath();

  // If the current path is the same as the last stored one, do nothing */
  if (undoHistoryArray.length > 0) {
    const lastPathCoordinates = undoHistoryArray[undoHistoryArray.length - 1];
    if (comparePaths(pathCoordinates, lastPathCoordinates)) {
      return;
    }
  } else if (pathCoordinates.length === 0) {
    // No previous path and the new path is empty => also no path change.
    return;
  }

  undoHistoryArray.push(pathCoordinates);
  // By introducing a new path, we can no longer have a meaningful "redo"
  // action starting from the current path.
  redoHistoryArray.length = 0;
  updateUndoRedoButtons();
}

/**
 * Returns the total length of the currently drawn path in meters.
 *
 * @return {Number} Length of currently drawn path.
 */
function computeTotalPathLength() {
  let pathLength = 0.0;
  for (let i = 1; i < pointArray.length; ++i) {
    let prevCoordinates = pointArray[i - 1].getLatLng();
    let nextCoordinates = pointArray[i].getLatLng();
    pathLength += prevCoordinates.distanceTo(nextCoordinates);
  }
  return pathLength;
}

/**
 * Sets the step size between consecutive points for the "multi-point line"
 * tool.
 *
 * @param {Number} newMultiPointLineStepSize New step size in meters.
 */
function setMultiPointLineStepSize(newMultiPointLineStepSize) {
  multiPointLineStepSize = newMultiPointLineStepSize;
  $("#multi-point-line-step-size").removeClass("invalid-value");
  if (!$("#multi-point-line-step-size").is(":focus")) {
    $("#multi-point-line-step-size").val(multiPointLineStepSize);
  }
  updateMultiPointLineToolBox();
}

/**
 * Sets the start time at which the first GPS position was obtained.
 *
 * @param {Date} newStartDate New start time.
 */
function setStartDate(newStartDate) {
  startDate = newStartDate;
  $("#start-time").val(stringUTCTime(startDate));
  $("#start-date").val(stringUTCDate(startDate));
}

/**
 * Sets the GPS frequency value.
 *
 * @param {Number} newGpsFrequency New GPS frequency in Hz.
 */
function setGpsFrequency(newGpsFrequency) {
  gpsFrequency = newGpsFrequency;
  if (!$("#gps-frequency").is(":focus")) {
    $("#gps-frequency").val(gpsFrequency);
  }
  $("#gps-frequency").removeClass("invalid-value");
}

/**
 * Updates the position of the mouse cursor on the "current position" box.
 *
 * @param {L.LatLng} mouseCoordinates Mouse cursor coordinates.
 */
function updateCurrentPositionBox(mouseCoordinates) {
  $("#mouse-cursor-latitude").html(
    mouseCoordinates.lat.toFixed(coordinatesFractionalDigits) + "&deg;"
  );
  $("#mouse-cursor-longitude").html(
    mouseCoordinates.lng.toFixed(coordinatesFractionalDigits) + "&deg;"
  );
}

/**
 * Updates the text input fields of the "edit point" tool according to whether a
 * point is selected or not.
 */
function updateEditPointToolBox() {
  if (selectedPoint === null) {
    $("#selected-point-latitude, #selected-point-longitude")
      .attr("disabled", "disabled")
      .val("---");
  } else {
    const latitude = selectedPoint.getLatLng().lat;
    const longitude = selectedPoint.getLatLng().lng;
    $("#selected-point-latitude").val(
      latitude.toFixed(coordinatesFractionalDigits)
    );
    $("#selected-point-longitude").val(
      longitude.toFixed(coordinatesFractionalDigits)
    );
    $("#selected-point-latitude, #selected-point-longitude").removeAttr(
      "disabled"
    );
  }
}

/**
 * Pans/zooms the map to make all points visible.
 */
function makeAllPointsVisible() {
  if (pointArray.length > 0) {
    const group = new L.featureGroup(pointArray);
    map.fitBounds(group.getBounds());
  }
}

/**
 * Fades and disables the menu and the map elements.
 */
function fadeAndDisableMenuAndMap() {
  $("#menu, #menu *, #map, #map *").each(function() {
    const element = $(this);
    element
      .attr("originalUnclickable", element.attr("unclickable"))
      .attr("originalTabindex", element.attr("tabindex"))
      .attr("unclickable", "unclickable")
      .attr("tabindex", -1);
  });
  $("#menu, #map").fadeTo("fast", 0.4);
}

/**
 * Unfades and re-enables the menu and the map elements.
 */
function unfadeAndEnableMenuAndMap() {
  $("#menu, #menu *, #map, #map *").each(function() {
    const element = $(this);
    element
      .removeAttr("unclickable")
      .removeAttr("tabindex")
      .attr("unclickable", element.attr("originalUnclickable"))
      .attr("tabindex", element.attr("originalTabindex"))
      .removeAttr("originalUnclickable")
      .removeAttr("originalTabindex");
  });
  $("#menu, #map").fadeTo("fast", 1);
}

/**
 * Shows the help popup window.
 */
function showHelpPopup() {
  if (!$("#help-popup").is(":visible")) {
    /* Hide any previously expanded help topic. */
    $("#help-popup .help-text").each(function() {
      $(this).hide();
    });
    fadeAndDisableMenuAndMap();
    $("#help-popup").fadeIn("fast");
  }
}

/**
 * Hides the help popup window.
 */
function hideHelpPopup() {
  if ($("#help-popup").is(":visible")) {
    unfadeAndEnableMenuAndMap();
    $("#help-popup").fadeOut("fast");
  }
}

/**
 * Updates the path statistics.
 */
function updatePathStats() {
  $("#num-points-in-path").html(pointArray.length);
  if (computeTotalPathLength() === 0.0) {
    $("#total-path-length").html("0");
  } else {
    $("#total-path-length").html(computeTotalPathLength().toFixed(2));
  }
}

/**
 * Shows a popup containing the details of the currently selected point.
 */
function showSelectedPointInfoPopup() {
  const coordinates = selectedPoint.getLatLng();
  const latitude = coordinates.lat.toFixed(coordinatesFractionalDigits);
  const longitude = coordinates.lng.toFixed(coordinatesFractionalDigits);
  const bearing = getPointBearing(selectedPointIndex);
  const speed = getSpeedAtPointMps(selectedPointIndex);
  const distNextPoint = getDistanceToNextPoint(selectedPointIndex);
  const distPrevPoint = getDistanceToPreviousPoint(selectedPointIndex);
  const pointDate = getTimeForPoint(selectedPointIndex);

  selectedPoint
    .bindPopup(
      "<div id='close-point-info-popup'>&times;</div>" +
        "<table class='point-info-popup'>" +
        "<tr><th>Latitude:</th><td>" +
        latitude +
        "&deg;</td></tr>" +
        "<tr><th>Longitude:</th><td>" +
        longitude +
        "&deg;</td></tr>" +
        "<tr><th>Bearing:</th><td>" +
        (bearing === null ? "---" : bearing.toFixed(2) + "&deg;") +
        "</td></tr>" +
        "<tr><th>Speed:</th><td>" +
        (speed === null ? "---" : speed.toFixed(2) + "m/s") +
        "</td></tr>" +
        "<tr><th>Dist. next point:</th><td>" +
        (distNextPoint === null ? "---" : distNextPoint.toFixed(2) + "m") +
        "</td></tr>" +
        "<tr><th>Dist. previous point:</th><td>" +
        (distPrevPoint === null ? "---" : distPrevPoint.toFixed(2) + "m") +
        "</td></tr>" +
        "<tr><th>UTC time:</th><td>" +
        stringUTCTime(pointDate) +
        "</td></tr>" +
        "<tr><th>UCT date:</th><td>" +
        stringUTCDate(pointDate) +
        "</td></tr>" +
        "</table>",
      { autoPan: true }
    )
    .openPopup();

  $("#close-point-info-popup").on("click", function() {
    setSelectedPoint(null);
  });
}

/**
 * Hides the popup containing the details of the currently selected point.
 */
function hideSelectedPointInfoPopup() {
  expect(
    selectedPoint !== null,
    "hideSelectedPointInfoPopup(): selectedPoint === null"
  );
  selectedPoint.closePopup();
  selectedPoint.unbindPopup();
}

/**
 * Updates the object speed on the "multi-point line" tool box.
 */
function updateMultiPointLineToolBox() {
  $("#multi-point-line-object-speed").val(
    multiPointLineStepSize * gpsFrequency
  );
}

/**
 * Redraws all preview points and preview segments assuming that the
 * "multi-point line" tool is selected.
 */
function redrawMultiPointLinePreviewPointsAndSegments(mouseCoordinates) {
  if (pointArray.length === 0 || mouseCoordinates === null) {
    return;
  }

  removeAllPreviewPoints();
  removeAllPreviewOrientedSegments();

  let prevCoordinates = getLastAddedPoint().getLatLng();

  // Haversine distance (in meters) between the last added point and the current
  // mouse cursor position.
  const distance = prevCoordinates.distanceTo(mouseCoordinates);

  let steps = distance / multiPointLineStepSize;

  /*
   * Latitude and longitude deltas between two consecutive GPS signals if the
   * object is travelling on a straight line from prevCoordinates to
   * mouseCoordinates.
   */
  const deltaLat = (mouseCoordinates.lat - prevCoordinates.lat) / steps;
  const deltaLng = (mouseCoordinates.lng - prevCoordinates.lng) / steps;

  steps = Math.min(maxMultiPointLinePoints, Math.floor(steps));

  // Add the preview points and preview segments.
  for (let i = 1; i <= steps; ++i) {
    const nextLatitude = prevCoordinates.lat + deltaLat;
    const nextLongitude = prevCoordinates.lng + deltaLng;
    const nextCoordinates = L.latLng(nextLatitude, nextLongitude);
    addPreviewPoint(nextCoordinates);
    addPreviewOrientedSegment(prevCoordinates, nextCoordinates);
    prevCoordinates = nextCoordinates;
  }
}

/**
 * Shows the popup window for status messages.
 */
function showStatusPopup() {
  if (!$("#status-popup").is(":visible")) {
    fadeAndDisableMenuAndMap();
    $("#status-popup").fadeIn("fast");
  }
}

/**
 * Hides the popup window for status messages.
 */
function hideStatusPopup() {
  if ($("#status-popup").is(":visible")) {
    unfadeAndEnableMenuAndMap();
    $("#status-popup").fadeOut("fast");
  }
}

/**
 * Generates a file as a data URI and prompts the user for downloading it.
 *
 * @param {String} fileName Name of the file to download.
 * @param {String} fileData File contents.
 */
function downloadFile(fileName, fileData) {
  const mediaType = /^.*\.csv$/.test(fileName) ? "text/csv" : "text/plain";
  const tmpDownloadLink = $("<a id='tmp-download-link'>...</a>")
    .hide()
    .attr(
      "href",
      "data:" + mediaType + ";charset=utf-8," + encodeURIComponent(fileData)
    )
    .attr("download", fileName);
  $("body").append(tmpDownloadLink);
  document.getElementById("tmp-download-link").click();
  tmpDownloadLink.remove();
}

/**
 * Determines the frequency at which GPS positions are obtained from a sequence
 * of timestamps (times since beginning of day).
 *
 * @param {String[]} timestamps Timestamps in the format "HHMMSS.SSS".
 * @note Only the first two timestamps are actually used (the GPS position
 *       sampling frequency is assumed to be constant). The time between two
 *       consecutive GPS position samples must not exceed an entire day. If a
 *       frequency cannot be determined, it is assumed to be 1Hz.
 */
function determineGpsFrequency(timestamps) {
  let gpsFrequencyComputed = false;

  // Assume a default GPS frequency of 1Hz.
  setGpsFrequency(1.0);

  // Determine the GPS frequency from the first two timestamps.
  if (timestamps.length >= 2) {
    const t0 = nmea.timeToMilliseconds(timestamps[0]);
    const t1 = nmea.timeToMilliseconds(timestamps[1]);
    /*
     * If the second timestamp is smaller than the first, then the first point
     * has a time before midnight while the second one has a time after midnight
     * (next day); fix this by using the assumption that the time between two
     * consecutive points does not exceed an entire day.
     */
    const gpsPeriod = t1 + (t1 < t0 ? 86400000 : 0) - t0;

    // If gpsPeriod === 0.0, the data is bad.
    if (gpsPeriod > 0.0) {
      setGpsFrequency(1000.0 / gpsPeriod);
      gpsFrequencyComputed = true;
    }
  }

  if (gpsFrequencyComputed) {
    addStatusPopupMessage("GPS frequency computed: " + gpsFrequency + "Hz");
  } else {
    addStatusPopupMessage(
      "Could not determine the GPS frequency (will use " + gpsFrequency + "Hz)"
    );
  }
}

/**
 * Determines the start time/date of a GPS recording using the timestamps
 * obtained from the GGA and RMC sentences in an NMEA file.
 *
 * @param {String[]} ggaTimes Timestamps in the format "HHMMSS.SSS".
 * @param {String[]} rmcTimes Timestamps in the format "HHMMSS.SSS".
 * @param {String[]} rmcDates Dates in the format "DDMMYY".
 * @param {Boolean} ggaFirst true if the first sentence in the NMEA file is GGA.
 * @note Only the first RMC and/or the first GGA sentence in the NMEA file is
 *       used. The time between two consecutive GPS position samples must not
 *       exceed an entire day.
 */
function determineStartDate(ggaTimes, rmcTimes, rmcDates, ggaFirst) {
  let newStartDate = new Date();

  if (rmcTimes.length === 0) {
    addStatusPopupMessage(
      "Could not determine the start date (will use " +
        stringUTCDate(newStartDate) +
        ")"
    );

    /*
     * If the NMEA file does not have RMC sentences but contains GGA sentences,
     * replace the day time information with whatever is obtained from the first
     * GGA sentence (but preserve the rest).
     */
    if (ggaTimes.length > 0) {
      newStartDate.setUTCHours(0);
      newStartDate.setUTCMinutes(0);
      newStartDate.setUTCSeconds(0);
      newStartDate.setUTCMilliseconds(nmea.timeToMilliseconds(ggaTimes[0]));
      addStatusPopupMessage(
        "Start time obtained: " + stringUTCTime(newStartDate)
      );
    } else {
      addStatusPopupMessage(
        "Could not determine the start time (will use " +
          stringUTCTime(newStartDate) +
          ")"
      );
    }
  } else {
    /*
     * If the NMEA file has RMC sentences, and if an RMC sentence appears before
     * the first GGA sentence, use only the first RMC sentence to determine the
     * start time and date.
     */
    if (!ggaFirst) {
      newStartDate = nmea.parseDateTime(rmcDates[0], rmcTimes[0]);
    } else {
      const firstGgaDayTime = nmea.timeToMilliseconds(ggaTimes[0]);
      const firstRmcDayTime = nmea.timeToMilliseconds(rmcTimes[0]);

      /*
       * If the first GGA sentence has a day time value larger than that of the
       * first RMC sentence, the former must have occurred before midnight and
       * the later after midnight (next day); fix this by using the assumption
       * that the time between these two sentences does not exceed an entire
       * day.
       */
      if (firstRmcDayTime < firstGgaDayTime) {
        newStartDate = nmea.parseDateTime(rmcDates[0], ggaTimes[0]);
        newStartDate.setUTCDate(newStartDate.getUTCDate() - 1);
      } else {
        newStartDate = nmea.parseDateTime(rmcDates[0], ggaTimes[0]);
      }
    }
    addStatusPopupMessage(
      "Start date obtained: " + stringUTCDate(newStartDate)
    );
    addStatusPopupMessage(
      "Start time obtained: " + stringUTCTime(newStartDate)
    );
  }
  setStartDate(newStartDate);
}

/**
 * Sets the status popup title.
 *
 * @param {String} title New title.
 */
function setStatusPopupTitle(title) {
  $("#status-popup .popup-title").text(title);
}

/**
 * Adds a message to the status popup.
 *
 * @param {String} message Message to be added.
 */
function addStatusPopupMessage(message) {
  $("#status-messages").append("<p>" + message + ".</p>");
}

/**
 * Removes all messages from the status popup.
 */
function clearStatusPopupMessages() {
  $("#status-messages").html("");
}

/**
 * Generates an NMEA log from the currently drawn path.
 *
 * @return {String} NMEA log generated.
 */
function generateNmeaData() {
  let text = "";

  for (let i = 0; i < pointArray.length; ++i) {
    let point = pointArray[i];
    let pointDate = getTimeForPoint(i);
    let pointCoordinates = point.getLatLng();

    // Both dgpsUpdate and dgpsReference can be omitted.
    const ggaData = {
      date: pointDate,
      lat: pointCoordinates.lat,
      lon: pointCoordinates.lng,
      fix: 1,
      satellites: numSatellites,
      hdop: 1.0,
      altitude: 0.0,
      aboveGeoid: 0.0
    };
    const rmcData = {
      date: pointDate,
      status: "A",
      lat: pointCoordinates.lat,
      lon: pointCoordinates.lng,
      speed: getSpeedAtPointKnots(i),
      course: getPointBearing(i),
      variation: 0.0
    };
    const gsaData = {
      status: "A",
      fix: 3,
      satellites: numSatellites,
      pdop: 1.0,
      hdop: 1.0,
      vdop: 1.0
    };

    text += nmea.encode("GPGGA", ggaData) + "\n";
    text += nmea.encode("GPGSA", gsaData) + "\n";
    text += nmea.encode("GPRMC", rmcData) + "\n";
  }
  return text;
}

/**
 * Selects a tool.
 *
 * @param {String} newSelectedToolId ID of tool to select (from ToolsEnum).
 */
function setSelectedTool(newSelectedToolId) {
  const selectedToolId = getSelectedTool();

  // If we select a tool which is already selected, do nothing.
  if (selectedToolId === newSelectedToolId) {
    return;
  }

  // If we change the selected tool while moving a point, move the point back to
  // its original position.
  if (selectedToolId === ToolsEnum.MOVEPOINT && selectedPoint !== null) {
    expect(
      selectedPointOriginalCoordinates !== null,
      "setSelectedTool(): selectedPointOriginalCoordinates === null"
    );
    setSelectedPointCoordinates(selectedPointOriginalCoordinates);
  }

  // Shows the tool box for the new selected tool (if applicable).
  const showToolBox = function() {
    if (newSelectedToolId === ToolsEnum.EDITPOINT) {
      $("#edit-point-box")
        .stop()
        .slideDown("fast");
    } else if (newSelectedToolId === ToolsEnum.MULTIPOINTLINE) {
      $("#multi-point-line-box")
        .stop()
        .slideDown("fast");
    } else if (newSelectedToolId === ToolsEnum.GLOBALSETTINGS) {
      $("#global-settings-box")
        .stop()
        .slideDown("fast");
    }
  };

  // Hide the tool box for the currently selected tool (if applicable).
  if (selectedToolId === ToolsEnum.EDITPOINT) {
    $("#edit-point-box")
      .stop()
      .slideUp("fast", showToolBox);
  } else if (selectedToolId === ToolsEnum.MULTIPOINTLINE) {
    $("#multi-point-line-box")
      .stop()
      .slideUp("fast", showToolBox);
  } else if (selectedToolId === ToolsEnum.GLOBALSETTINGS) {
    $("#global-settings-box")
      .stop()
      .slideUp("fast", showToolBox);
  } else {
    showToolBox();
  }

  $.each(ToolsEnum, function(_dummy, toolId) {
    $(toolId).removeClass("selected");
  });
  $(newSelectedToolId).addClass("selected");

  updateMultiPointLineToolBox();
  removeAllPreviewPoints();
  removeAllPreviewOrientedSegments();
  setSelectedPoint();
}

/**
 * Returns the ID of the tool which is currently selected.
 *
 * @return {String} ID of the currently selected tool.
 */
function getSelectedTool() {
  let selectedTool = null;
  $.each(ToolsEnum, function(_dummy, toolId) {
    if ($(toolId).hasClass("selected")) {
      selectedTool = toolId;
    }
  });
  expect(selectedTool !== null, "getSelectedTool(): no tool is selected");
  return selectedTool;
}

/**
 * Updates the "zoom in" and "zoom out" buttons according to whether such
 * actions are possible or not.
 */
function updateZoomButtons() {
  if (map.getZoom() === minZoomLevel) {
    $(".leaflet-control-zoom-out").attr("tabindex", -1);
  } else {
    $(".leaflet-control-zoom-out").removeAttr("tabindex");
  }
  if (map.getZoom() === maxZoomLevel) {
    $(".leaflet-control-zoom-in").attr("tabindex", -1);
  } else {
    $(".leaflet-control-zoom-in").removeAttr("tabindex");
  }
}

/*******************************************************************************
 *
 *    EVENT HANDLERS
 *
 ******************************************************************************/

/**
 * Callback invoked when the "undo" button is clicked.
 */
function onUndoButtonClick() {
  expect(
    undoHistoryArray.length > 0,
    "onUndoLastActionClick(): no 'undo' actions available"
  );

  // Add the current path to the "redo" array.
  redoHistoryArray.push(undoHistoryArray.pop());

  // Restore the previous path, if there is one.
  if (undoHistoryArray.length > 0) {
    rebuildPath(undoHistoryArray[undoHistoryArray.length - 1]);
  } else {
    rebuildPath([]);
  }

  updateEditPointToolBox();
  updateUndoRedoButtons();
}

/**
 * Callback invoked when the "redo" button is clicked.
 */
function onRedoButtonClick() {
  expect(
    redoHistoryArray.length > 0,
    "onRedoLastUndoneActionClick(): no 'redo' actions available"
  );

  // Add the current path to the "undo" array */
  undoHistoryArray.push(redoHistoryArray.pop());

  // Restore the next path.
  rebuildPath(undoHistoryArray[undoHistoryArray.length - 1]);

  updateEditPointToolBox();
  updateUndoRedoButtons();
}

/**
 * Callback invoked when the "zoom-to-fit" button is clicked.
 */
function onZoomToFitClick() {
  makeAllPointsVisible();
}

/**
 * Callback invoked when the "help" button is clicked.
 *
 * @param {Object} event Click event.
 */
function onHelpButtonClick(event) {
  showHelpPopup();
  event.stopPropagation();
}

/**
 * Callback invoked when the value of any text input field from the "global
 * settings" tool is modified.
 */
function onGlobalSettingsTextInputFieldChange() {
  const newGpsFrequency = $("#gps-frequency").val();
  const newStartTime = $("#start-time").val();
  const newStartDate = $("#start-date").val();
  const startTimeTokens = newStartTime.split(":");
  const startDateTokens = newStartDate.split("-");

  const isGpsFrequencyValid =
    newGpsFrequency !== "" &&
    !isNaN(newGpsFrequency) &&
    parseFloat(newGpsFrequency) > 0.0;

  const isStartTimeValid =
    /^\d\d:\d\d:\d\d(\.\d*)?$/.test(newStartTime) &&
    parseInt(startTimeTokens[0]) < 24 &&
    parseInt(startTimeTokens[1]) < 60 &&
    parseInt(startTimeTokens[2]) < 60;

  const isStartDateValid =
    !isNaN(Date.parse(newStartDate)) &&
    startDateTokens.length === 3 &&
    startDateTokens[0].length === 4 &&
    startDateTokens[1].length === 2 &&
    startDateTokens[2].length === 2;

  if (!isGpsFrequencyValid) {
    $("#gps-frequency").addClass("invalid-value");
  } else {
    setGpsFrequency(newGpsFrequency);
  }

  if (!isStartTimeValid) {
    $("#start-time").addClass("invalid-value");
  } else {
    $("#start-time").removeClass("invalid-value");
    startDate.setUTCHours(parseInt(startTimeTokens[0]));
    startDate.setUTCMinutes(parseInt(startTimeTokens[1]));
    startDate.setUTCSeconds(0);
    startDate.setUTCMilliseconds(1000.0 * parseFloat(startTimeTokens[2]));
  }

  if (!isStartDateValid) {
    $("#start-date").addClass("invalid-value");
  } else {
    startDate.setUTCDate(parseInt(startDateTokens[2]));
    startDate.setUTCMonth(parseInt(startDateTokens[1]) - 1);
    startDate.setUTCFullYear(parseInt(startDateTokens[0]));
    $("#start-date").removeClass("invalid-value");
  }
}

/**
 * Callback invoked when any text input field from the "global settings" tool
 * loses focus.
 */
function onGlobalSettingsTextInputFieldFocusOut() {
  $("#gps-frequency").val(gpsFrequency);
  $("#gps-frequency").removeClass("invalid-value");
  setStartDate(startDate);
  $("#start-time").removeClass("invalid-value");
  $("#start-date").removeClass("invalid-value");
}

/**
 * Callback invoked when the value of any text input field from the "edit point"
 * tool is modified.
 */
function onEditPointTextInputFieldChange() {
  const latitude = $("#selected-point-latitude").val();
  const longitude = $("#selected-point-longitude").val();
  const isLatitudeValid =
    latitude !== "" &&
    !isNaN(latitude) &&
    parseFloat(latitude) >= -90.0 &&
    parseFloat(latitude) <= 90.0;
  const isLongitudeValid =
    longitude !== "" &&
    !isNaN(longitude) &&
    parseFloat(longitude) >= -180.0 &&
    parseFloat(longitude) <= 180.0;

  if (!isLatitudeValid) {
    $("#selected-point-latitude").addClass("invalid-value");
  } else {
    $("#selected-point-latitude").removeClass("invalid-value");
  }

  if (!isLongitudeValid) {
    $("#selected-point-longitude").addClass("invalid-value");
  } else {
    $("#selected-point-longitude").removeClass("invalid-value");
  }
}

/**
 * Callback invoked on "keydown" events at any text input field from the "edit
 * point" tool.
 *
 * @param {Object} event Keydown event.
 */
function onEditPointTextInputFieldKeydown(event) {
  // If the user pressed the "Enter" key and the new coordinates are valid,
  // update the selected point coordinates with these new coordinates.
  if (
    event.which === 13 &&
    !$("#selected-point-latitude").hasClass("invalid-value") &&
    !$("#selected-point-longitude").hasClass("invalid-value")
  ) {
    const latitude = $("#selected-point-latitude").val();
    const longitude = $("#selected-point-longitude").val();
    const coordinates = L.latLng(latitude, longitude);
    setSelectedPointCoordinates(coordinates);
  }
}

/**
 * Callback invoked when any text input field from the "edit point" tool loses
 * focus.
 */
function onEditPointTextInputFieldFocusOut() {
  if (
    !$("#selected-point-latitude").hasClass("invalid-value") &&
    !$("#selected-point-longitude").hasClass("invalid-value")
  ) {
    const latitude = $("#selected-point-latitude").val();
    const longitude = $("#selected-point-longitude").val();
    const coordinates = L.latLng(latitude, longitude);
    setSelectedPointCoordinates(coordinates);
  } else {
    updateEditPointToolBox();
    $("#selected-point-latitude, #selected-point-longitude").removeClass(
      "invalid-value"
    );
  }
}

/**
 * Callback invoked when the value of any text input field from the "multi-point
 * line" tool is modified.
 */
function onMultiPointLineTextInputFieldChange() {
  const newStepSize = $("#multi-point-line-step-size").val();
  const isStepSizeValid =
    newStepSize !== "" && !isNaN(newStepSize) && parseFloat(newStepSize) > 0.0;
  if (!isStepSizeValid) {
    $("#multi-point-line-step-size").addClass("invalid-value");
  } else {
    setMultiPointLineStepSize(parseFloat(newStepSize));
    redrawMultiPointLinePreviewPointsAndSegments(lastMouseCoordinates);
  }
}

/**
 * Callback invoked when any text input field from the "multi-point line" tool
 * loses focus.
 */
function onMultiPointLineTextInputFieldFocusOut() {
  $("#multi-point-line-step-size")
    .val(multiPointLineStepSize)
    .removeClass("invalid-value");
}

/**
 * Callback invoked when the "Load NMEA file" button is clicked.
 */
function onLoadNmeaFileButtonClick() {
  $("#load-nmea-file-button").click();
}

/**
 * Callback invoked when the contents of an NMEA file selected by the user are
 * loaded so a path can be extracted from it.
 *
 * @param {String} nmeaData NMEA file contents.
 * @param {String} fileName Name of file uploaded by user.
 */
function onNmeaFileDataLoaded(nmeaData, fileName) {
  clearStatusPopupMessages();
  setStatusPopupTitle("NMEA file details - " + fileName);
  const sentences = nmeaData.split("\n").filter(function(sentence) {
    return sentence !== "";
  });
  const pathCoordinates = [];
  const ggaTimes = [];
  const rmcTimes = [];
  const rmcDates = [];
  let ggaFirst = null;
  let otherSentences = 0;

  for (const sentence of sentences) {
    try {
      const nmeaData = nmea.parse(sentence);
      if (nmeaData.id === "GPGGA") {
        const coordinates = L.latLng(nmeaData.latitude, nmeaData.longitude);
        pathCoordinates.push(coordinates);
        ggaTimes.push(nmeaData.time);
        ggaFirst = ggaFirst === null ? true : ggaFirst;
      } else if (nmeaData.id === "GPRMC") {
        rmcTimes.push(nmeaData.time);
        rmcDates.push(nmeaData.date);
        ggaFirst = ggaFirst === null ? false : ggaFirst;
      }
    } catch (error) {
      // A sentence that could not be parsed may either be of other type (not
      // GGA/RMC) or just invalid.
      ++otherSentences;
    }
  }
  // Handle NMEA files with no valid GGA/RMC sentences.
  ggaFirst = ggaFirst === null ? false : ggaFirst;

  determineGpsFrequency(ggaTimes);
  determineStartDate(ggaTimes, rmcTimes, rmcDates, ggaFirst);
  rebuildPath(pathCoordinates);
  clearUndoRedoActions();

  if (pointArray.length > 0) {
    makeAllPointsVisible();
  }

  addStatusPopupMessage("Valid GGA sentences read: " + ggaTimes.length);
  addStatusPopupMessage("Valid RMC sentences read: " + rmcTimes.length);
  addStatusPopupMessage("Other/invalid sentences read: " + otherSentences);
  addStatusPopupMessage(
    "The NMEA file contains " + pointArray.length + " points"
  );
  setSelectedTool(ToolsEnum.GLOBALSETTINGS);
  storeCurrentPathIfChanged();
  showStatusPopup();
}

/**
 * Callback invoked when the user selects an NMEA file to be loaded.
 */
function onNmeaFileSelected() {
  const reader = new FileReader();
  const fileName = this.files[0].name;
  reader.onload = function() {
    onNmeaFileDataLoaded(reader.result, fileName);
  };
  reader.readAsText(this.files[0]);
  // Force a file load even if the user chooses the same file again.
  this.value = "";
}

/**
 * Callback invoked when the "Generate NMEA file" button is clicked.
 */
function onGenerateNmeaFileButtonClick() {
  downloadFile("output.nmea", generateNmeaData());
}

/**
 * Generates a representation of the currently drawn path in CSV format.
 *
 * @return {String} Path coordinates in CSV format (one point per line).
 */
function generateCsvData() {
  let text = "";
  for (const point of pointArray) {
    const coordinates = point.getLatLng();
    text += coordinates.lat + "," + coordinates.lng + "\n";
  }
  return text;
}

/**
 * Callback invoked when the "Load coordinates" button is clicked.
 */
function onLoadCoordinatesButtonClick() {
  $("#load-coordinates-file-button").click();
}

/**
 * Callback invoked when the contents of a CSV file selected by the user are
 * loaded so a path can be extracted from it.
 *
 * @param {String} csvData CSV file contents.
 * @param {String} fileName Name of file uploaded by user.
 */
function onCsvFileDataLoaded(csvData, fileName) {
  clearStatusPopupMessages();
  setStatusPopupTitle("CSV file details - " + fileName);
  const lines = csvData.split("\n").filter(function(line) {
    return line !== "";
  });
  const pathCoordinates = [];
  let invalidCoordinates = 0;

  for (const line of lines) {
    const coordinates = line
      .trim()
      .split(",")
      .map(function(value) {
        return parseFloat(value);
      });
    if (!isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
      pathCoordinates.push(coordinates);
    } else {
      ++invalidCoordinates;
    }
  }

  rebuildPath(pathCoordinates);
  clearUndoRedoActions();

  if (pointArray.length > 0) {
    makeAllPointsVisible();
  }

  addStatusPopupMessage("Valid coordinates read: " + pathCoordinates.length);
  addStatusPopupMessage("Invalid coordinates read: " + invalidCoordinates);
  setSelectedTool(ToolsEnum.GLOBALSETTINGS);
  storeCurrentPathIfChanged();
  showStatusPopup();
}

/**
 * Callback invoked when the user selects a CSV file to be loaded.
 */
function onCsvFileSelected() {
  const reader = new FileReader();
  const fileName = this.files[0].name;
  reader.onload = function() {
    onCsvFileDataLoaded(reader.result, fileName);
  };
  reader.readAsText(this.files[0]);
  // Force a file load even if the user chooses the same file again.
  this.value = "";
}

/**
 * Callback invoked when the "Download coordinates" button is clicked.
 */
function onDownloadCoordinatesButtonClick() {
  downloadFile("output.csv", generateCsvData());
}

/**
 * Callback invoked when the mouse cursor moves over any map control component
 * (e.g. the search box, the zoom icons etc.).
 *
 * @param {Object} event Mouse move event.
 */
function onMapControlComponentMouseMove(event) {
  if (
    getSelectedTool() === ToolsEnum.ADDPOINT ||
    getSelectedTool() === ToolsEnum.MULTIPOINTLINE
  ) {
    removeAllPreviewPoints();
    removeAllPreviewOrientedSegments();
  }
  if (!$(this).hasClass("leaflet-control-layers")) {
    mapLayerControl.collapse();
  }
  L.DomEvent.stopPropagation(event);
}

/**
 * Callback invoked when the user clicks on a point.
 *
 * @param {Object} event Click event.
 */
function onPointClick(event) {
  const point = event.target;
  if (getSelectedTool() === ToolsEnum.ADDPOINT) {
    const coordinates = point.getLatLng();
    removeAllPreviewPoints();
    if (getLastAddedPoint() !== null) {
      removeAllPreviewOrientedSegments();
      addOrientedSegment(getLastAddedPoint().getLatLng(), coordinates);
    }
    addPoint(coordinates);
  } else if (getSelectedTool() === ToolsEnum.DELETEPOINT) {
    removePoint(point);
  } else if (getSelectedTool() === ToolsEnum.MOVEPOINT) {
    if (selectedPoint !== null) {
      // If we are moving a point, fix it and unselect it.
      setSelectedPoint();
    } else {
      // If we are not moving a point, select the one we clicked.
      setSelectedPoint(point);
    }
  } else if (getSelectedTool() === ToolsEnum.EDITPOINT) {
    setSelectedPoint(point);
  } else if (getSelectedTool() === ToolsEnum.POINTINFO) {
    setSelectedPoint(point);
  } else if (getSelectedTool() === ToolsEnum.MULTIPOINTLINE) {
    // Add all preview points to the map.
    for (const point of previewPointArray) {
      const prevCoordinates = getLastAddedPoint().getLatLng();
      addPoint(point.getLatLng());
      addOrientedSegment(prevCoordinates, point.getLatLng());
    }
    removeAllPreviewPoints();
    removeAllPreviewOrientedSegments();
  } else if (getSelectedTool() === ToolsEnum.GLOBALSETTINGS) {
    setSelectedTool(ToolsEnum.POINTINFO);
    setSelectedPoint(point);
  }

  updateEditPointToolBox();
  updatePathStats();
  storeCurrentPathIfChanged();
  L.DomEvent.stopPropagation(event);
}

/**
 * Callback invoked when the user moves the mouse cursor over the map.
 *
 * @param {Object} event Mouse move event.
 */
function onMapMouseMove(event) {
  const mouseCoordinates = event.latlng;
  lastMouseCoordinates = mouseCoordinates;
  updateCurrentPositionBox(mouseCoordinates);

  if (
    getSelectedTool() === ToolsEnum.ADDPOINT ||
    (getSelectedTool() === ToolsEnum.MULTIPOINTLINE &&
      getLastAddedPoint() === null)
  ) {
    removeAllPreviewPoints();
    if (getLastAddedPoint() !== null) {
      removeAllPreviewOrientedSegments();
      addPreviewOrientedSegment(
        getLastAddedPoint().getLatLng(),
        mouseCoordinates
      );
    }
    addPreviewPoint(mouseCoordinates);
    expect(
      previewPointArray.length === 1,
      "onMapMouseMove(): previewPointArray.length !== 1"
    );
  } else if (getSelectedTool() === ToolsEnum.DELETEPOINT) {
    // Do nothing.
  } else if (getSelectedTool() === ToolsEnum.MOVEPOINT) {
    if (selectedPoint !== null) {
      setSelectedPointCoordinates(mouseCoordinates);
    }
  } else if (getSelectedTool() === ToolsEnum.EDITPOINT) {
    // Do nothing.
  } else if (getSelectedTool() === ToolsEnum.POINTINFO) {
    // Do nothing.
  } else if (getSelectedTool() === ToolsEnum.MULTIPOINTLINE) {
    redrawMultiPointLinePreviewPointsAndSegments(mouseCoordinates);
  }
}

/**
 * Callback invoked when the mouse cursor moves into the menu area.
 */
function onMenuMouseEnter() {
  lastMouseCoordinates = null;

  // If we are moving a point around, restore its original position but keep it
  // selected.
  if (getSelectedTool() === ToolsEnum.MOVEPOINT && selectedPoint !== null) {
    expect(
      selectedPointOriginalCoordinates !== null,
      "onMenuMouseEnter(): selectedPointOriginalCoordinates === null"
    );
    setSelectedPointCoordinates(selectedPointOriginalCoordinates);
    setSelectedPoint(selectedPoint);
  }

  if (
    getSelectedTool() === ToolsEnum.ADDPOINT ||
    getSelectedTool() === ToolsEnum.MULTIPOINTLINE
  ) {
    removeAllPreviewPoints();
    removeAllPreviewOrientedSegments();
  }
  mapLayerControl.collapse();
}

/**
 * Callback invoked when the user clicks on a button from the tool menu.
 */
function onToolButtonClick() {
  setSelectedTool("#" + $(this).prop("id"));
}

/**
 * Callback invoked when the user presses a keyboard key.
 *
 * @param {Object} event Keydown event.
 */
function onDocumentKeyDown(event) {
  // If the user presses the escape key...
  if (event.keyCode === 27) {
    // If a point is selected, deselect it.
    if (selectedPoint !== null) {
      if (getSelectedTool() === ToolsEnum.MOVEPOINT) {
        setSelectedPointCoordinates(selectedPointOriginalCoordinates);
        setSelectedPoint();
      } else if (getSelectedTool() === ToolsEnum.EDITPOINT) {
        if (
          !$("#selected-point-latitude").is(":focus") &&
          !$("#selected-point-longitude").is(":focus")
        ) {
          setSelectedPoint();
          updateEditPointToolBox();
        }
      } else if (getSelectedTool() === ToolsEnum.POINTINFO) {
        setSelectedPoint();
      }
      event.stopPropagation();
    }
    hideHelpPopup();
    hideStatusPopup();
  }
}

/**
 * Callback invoked when a user click event reaches the document root.
 */
function onDocumentClick() {
  hideStatusPopup();
  hideHelpPopup();
}

/**
 * Callback invoked when the user clicks on a popup.
 *
 * @param {Object} event Click event.
 * @note This function is not invoked for clicks on point popups.
 */
function onPopupClick(event) {
  event.stopPropagation();
}

/**
 * Callback invoked when the user clicks on a topic on the help popup.
 */
function onHelpPopupItemClick() {
  const helpTextElement = $(this)
    .parent()
    .next();
  // If we are already showing the associated help text...
  if (helpTextElement.is(":visible")) {
    helpTextElement.slideUp("fast");
    return;
  }
  // Recoil all expanded help topics (accordion style).
  $("#help-popup .help-text").each(function() {
    $(this).slideUp("fast");
  });
  helpTextElement.slideToggle("fast");
}

/**
 * Callback invoked when the user clicks on the map.
 *
 * @param {Object} event Click event.
 */
function onMapClick(event) {
  if (event.originalEvent.key !== undefined) {
    return;
  }
  const coordinates = event.latlng;
  if (
    getSelectedTool() === ToolsEnum.ADDPOINT ||
    (getSelectedTool() === ToolsEnum.MULTIPOINTLINE &&
      getLastAddedPoint() === null)
  ) {
    removeAllPreviewPoints();
    removeAllPreviewOrientedSegments();
    if (getLastAddedPoint() !== null) {
      addOrientedSegment(getLastAddedPoint().getLatLng(), coordinates);
    }
    addPoint(coordinates);
  } else if (getSelectedTool() === ToolsEnum.DELETEPOINT) {
    // Do nothing.
  } else if (getSelectedTool() === ToolsEnum.MOVEPOINT) {
    // If we are moving a point around, fix it and unselect it.
    if (selectedPoint !== null) {
      // This is necessary for touch devices.
      setSelectedPointCoordinates(coordinates);
      setSelectedPoint();
    }
  } else if (getSelectedTool() === ToolsEnum.EDITPOINT) {
    setSelectedPoint();
    updateEditPointToolBox();
  } else if (getSelectedTool() === ToolsEnum.POINTINFO) {
    setSelectedPoint();
  } else if (getSelectedTool() === ToolsEnum.MULTIPOINTLINE) {
    expect(
      getLastAddedPoint() !== null,
      "onMapClick(): getLastAddedPoint() === null"
    );
    // Add all preview points to the map.
    for (const point of previewPointArray) {
      const prevCoordinates = getLastAddedPoint().getLatLng();
      addPoint(point.getLatLng());
      addOrientedSegment(prevCoordinates, point.getLatLng());
    }
    removeAllPreviewPoints();
    removeAllPreviewOrientedSegments();
  } else if (getSelectedTool() === ToolsEnum.GLOBALSETTINGS) {
    // Do nothing.
  }

  updatePathStats();
  storeCurrentPathIfChanged();
  L.DomEvent.stopPropagation(event);
}

/**
 * Callback invoked when the user stops moving the map.
 */
function onMapMoveEnd() {
  sessionStorage.setItem("mapCenterLatitude", map.getCenter().lat);
  sessionStorage.setItem("mapCenterLongitude", map.getCenter().lng);
  sessionStorage.setItem("mapZoom", map.getZoom());
}

/**
 * Callback invoked when the user stops zooming the map.
 */
function onMapZoomEnd() {
  updateZoomButtons();
}

/**
 * Callback invoked when the user clicks on the map layer control toggle.
 */
function onMapLayerControlToggleClick() {
  if ($(".leaflet-control-layers").attr("first-toggle") !== "no") {
    $(".leaflet-control-layers-expanded span").on("click", function() {
      mapLayerControl.collapse();
    });
    $(".leaflet-control-layers").attr("first-toggle", "no");
  }
}

/*******************************************************************************
 *
 *    INITIALIZATION FUNCTIONS
 *
 ******************************************************************************/

/**
 * Initializes and configures the map.
 */
function initializeMap() {
  // Default initial map center position (Berlin) and zoom level.
  let mapCenter = [52.51935462, 13.41225743];
  let mapZoom = 14;

  // If the page was reloaded on the same tab, restore the last map view.
  if (sessionStorage.getItem("mapCenterLatitude") !== null) {
    mapCenter = [
      parseFloat(sessionStorage.getItem("mapCenterLatitude")),
      parseFloat(sessionStorage.getItem("mapCenterLongitude"))
    ];
    mapZoom = parseInt(sessionStorage.getItem("mapZoom"));
  }

  map = L.map("map", {
    zoomControl: false,
    zoom: mapZoom,
    center: mapCenter,
    layers: [tileOpenStreetMapStreets]
  });

  // Place the zoom +/- buttons on the top-right side of the map.
  L.control.zoom({ position: "topright" }).addTo(map);
  updateZoomButtons();

  // Disable zoom on double clicks on the map.
  map.doubleClickZoom.disable();

  // Register all available map layers.
  mapLayerControl = L.control.layers(mapLayers);
  mapLayerControl.addTo(map);

  // Make the entries in the map layer control component behave like buttons.
  $(".leaflet-control-layers-list label").attr("tabindex", 0);
  $(".leaflet-control-layers-list label").on("keydown", function(event) {
    if (event.keyCode === 13) {
      $(this).click();
      mapLayerControl.collapse();
    }
  });

  // Add the search box to the map.
  map.addControl(
    new L.Control.Search({
      autoCollapse: false,
      autoResize: false,
      autoType: false,
      collapsed: false,
      firstTipSubmit: true,
      formatData: processSearchResults,
      jsonpParam: "json_callback",
      marker: null,
      minLength: 2,
      moveToLocation: function(location) {
        map.fitBounds(location.__boundingBox__);
      },
      propertyLoc: ["lat", "lon"],
      propertyName: "display_name",
      textPlaceholder: "Jump to...",
      url: "https://nominatim.openstreetmap.org/search?format=json&q={s}"
    })
  );

  // Map event handlers.
  map
    .on("click", onMapClick)
    .on("mousemove", onMapMouseMove)
    .on("contextmenu", function() {})
    .on("moveend", onMapMoveEnd)
    .on("zoomend", onMapZoomEnd);

  // Map control components event handlers.
  $(".leaflet-control-layers-toggle").on("click", onMapLayerControlToggleClick);
  $(
    [
      ".leaflet-control-search",
      ".leaflet-control-zoom-in",
      ".leaflet-control-zoom-out",
      ".leaflet-control-layers",
      ".leaflet-control-attribution"
    ].join(", ")
  ).on("mousemove mouseenter", onMapControlComponentMouseMove);

  // Disable the mouseenter/leave event handlers from the map layer control
  // component (they are buggy: https://github.com/Leaflet/Leaflet/issues/6579).
  L.DomEvent.off(
    mapLayerControl._container,
    {
      mouseenter: mapLayerControl.expand
    },
    mapLayerControl
  );
}

/**
 * Initializes some global settings.
 */
function initializeGlobalSettings() {
  setStartDate(new Date());
  setGpsFrequency(1.0);
  setMultiPointLineStepSize(20.0);
}

$(document).ready(function() {
  // Global (document) event handlers.
  $(document).on("keydown", onDocumentKeyDown);
  $(document).on("click", onDocumentClick);

  // Do not keep a button focused when it is clicked.
  $("button").on("click", function() {
    $(this).blur();
  });

  // Menu event handlers.
  $("#menu").on("mouseenter", onMenuMouseEnter);

  // Tool selection handlers (click events).
  $.each(ToolsEnum, function(_dummy, toolId) {
    $(toolId).on("click", onToolButtonClick);
  });

  // Extra tools click handlers.
  $("#undo").on("click", onUndoButtonClick);
  $("#redo").on("click", onRedoButtonClick);
  $("#zoom-to-fit").on("click", onZoomToFitClick);
  $("#help").on("click", onHelpButtonClick);

  // Event handlers for the "global settings" tool.
  $("#gps-frequency").on(
    "input propertychange paste",
    onGlobalSettingsTextInputFieldChange
  );
  $("#gps-frequency").on("focusout", onGlobalSettingsTextInputFieldFocusOut);
  $("#start-time").on(
    "input propertychange paste",
    onGlobalSettingsTextInputFieldChange
  );
  $("#start-time").on("focusout", onGlobalSettingsTextInputFieldFocusOut);
  $("#start-date").on(
    "input propertychange paste",
    onGlobalSettingsTextInputFieldChange
  );
  $("#start-date").on("focusout", onGlobalSettingsTextInputFieldFocusOut);

  // Event handlers for the "edit point" tool.
  $("#selected-point-latitude, #selected-point-longitude")
    .on("input propertychange paste", onEditPointTextInputFieldChange)
    .on("focusout", onEditPointTextInputFieldFocusOut)
    .on("keydown", onEditPointTextInputFieldKeydown);

  // Event handlers for the "multi-point line" tool.
  $("#multi-point-line-step-size")
    .on("input propertychange paste", onMultiPointLineTextInputFieldChange)
    .on("focusout", onMultiPointLineTextInputFieldFocusOut);

  // Help/status popup event handlers.
  $("#help-popup, #status-popup").on("click", onPopupClick);
  $("#help-popup .help-topic > a").each(function() {
    $(this).on("click", onHelpPopupItemClick);
  });

  // File loading/generation event handlers.
  $("#load-nmea-file").on("click", onLoadNmeaFileButtonClick);
  $("#load-nmea-file-button").on("change", onNmeaFileSelected);
  $("#generate-nmea-file").on("click", onGenerateNmeaFileButtonClick);
  $("#load-coordinates-file").on("click", onLoadCoordinatesButtonClick);
  $("#load-coordinates-file-button").on("change", onCsvFileSelected);
  $("#generate-coordinates-file").on("click", onDownloadCoordinatesButtonClick);

  initializeMap();
  initializeGlobalSettings();
});
