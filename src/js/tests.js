/*******************************************************************************
 *
 *    GENERAL CONFIGURATION PARAMETERS
 *
 ******************************************************************************/

// Reference number of points to add on a typical test.
const numTestPoints = 10;

/*******************************************************************************
 *
 *    HELPER FUNCTIONS
 *
 ******************************************************************************/

/**
 * Generates a random integer in a given value range.
 *
 * @param {Number} min Minimum value in the allowed range.
 * @param {Number} max Maximum value in the allowed range.
 * @return {Number} Integer value sampled randomly from [min, max].
 */
function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random floating-point value in a given value range.
 *
 * @param {Number} min Minimum value in the allowed range.
 * @param {Number} max Maximum value in the allowed range.
 * @return {Number} Floating-point value sampled randomly from [min, max).
 */
function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generates random coordinates (for testing).
 *
 * @return {L.LatLng} Coordinate pair sampled randomly from a fixed map region.
 */
function randomCoordinates() {
  return L.latLng(randomFloat(52.45, 52.6), randomFloat(13.3, 13.5));
}

/**
 * Randomly picks a point from the drawn path.
 *
 * @return {L.CircleMarker} Point sampled randomly from the drawn path.
 */
function getRandomPointOnPath() {
  failIfConditionIsFalse(pointArray.length > 0);
  return pointArray[randomInteger(0, pointArray.length - 1)];
}

/**
 * Compares two pairs of coordinates.
 *
 * @param {L.LatLng} coordinates1 First pair of coordinates.
 * @param {L.LatLng} coordinates2 Second pair of coordinates.
 * @return {Boolean} True if the coordinates are equal, false otherwise.
 */
function areCoordinatesEqual(coordinates1, coordinates2) {
  return (
    coordinates1.lat === coordinates2.lat &&
    coordinates1.lng === coordinates2.lng
  );
}

/**
 * Throws an exception if a condition is false, otherwise do nothing.
 *
 * @param {Boolean} condition Evaluation of a condition.
 */
function failIfConditionIsFalse(condition) {
  if (!condition) {
    throw new Error("condition failed");
  }
}

/**
 * Checks if a point is selected.
 *
 * @param {L.CircleMarker} point A point.
 * @return {Boolean} True if the point is selected, false otherwise.
 */
function isPointSelected(point) {
  if (point === null) {
    return (
      selectedPoint === null &&
      selectedPointIndex === null &&
      selectedPointOriginalCoordinates === null
    );
  }
  return (
    selectedPoint === point && selectedPointIndex === pointArray.indexOf(point)
  );
}

/**
 * Compares the currently stored numbers of "undo" and "redo" actions against
 * expected values for those quantities.
 *
 * @param {Number} numUndoActions Expected number of stored "undo" actions.
 * @param {Number} numRedoActions Expected number of stored "redo" actions.
 */
function checkNumUndoRedoActions(numUndoActions, numRedoActions) {
  const canUndo = !$("#undo").is("[disabled]");
  const canRedo = !$("#redo").is("[disabled]");
  failIfConditionIsFalse(canUndo === numUndoActions > 0);
  failIfConditionIsFalse(canRedo === numRedoActions > 0);
  failIfConditionIsFalse(undoHistoryArray.length === numUndoActions);
  failIfConditionIsFalse(redoHistoryArray.length === numRedoActions);
}

/**
 * Compares the current number of preview points and preview segments against
 * expected values for those quantities.
 *
 * @param {Number} numPreviewPoints Expected number of preview points.
 * @param {Number} numPreviewSegments Expected number of preview segments.
 */
function checkPreviewPointsAndSegments(numPreviewPoints, numPreviewSegments) {
  failIfConditionIsFalse(previewPointArray.length === numPreviewPoints);
  failIfConditionIsFalse(previewSegmentArray.length === numPreviewSegments);
  failIfConditionIsFalse(
    previewSegmentArrowArray.length === numPreviewSegments
  );
}

/**
 * Performs a post-test teardown and checks if it succeeded.
 */
function tearDown() {
  rebuildPath([]);
  clearUndoRedoActions();
  lastMouseCoordinates = null;
  initializeGlobalSettings();

  failIfConditionIsFalse(pointArray.length === 0);
  failIfConditionIsFalse(previewPointArray.length === 0);
  failIfConditionIsFalse(segmentArray.length === 0);
  failIfConditionIsFalse(segmentArrowArray.length === 0);
  failIfConditionIsFalse(previewSegmentArray.length === 0);
  failIfConditionIsFalse(previewSegmentArrowArray.length === 0);
  failIfConditionIsFalse(selectedPoint === null);
  failIfConditionIsFalse(selectedPointIndex === null);
  failIfConditionIsFalse(selectedPointOriginalCoordinates === null);
  checkNumUndoRedoActions(0, 0);
}

/*******************************************************************************
 *
 *    USER ACTION SIMULATORS
 *
 ******************************************************************************/

/**
 * Simulates the motion of the mouse cursor into the menu area.
 */
function userMoveMouseCursorToMenu() {
  $("#menu").mouseenter();
}

/**
 * Simulates the motion of the mouse cursor over the map area.
 *
 * @param {L.LatLng} coordinates Coordinates where the mouse move event occurs.
 */
function userMoveMouseCursorOverMap(coordinates) {
  map.fire("mousemove", { latlng: coordinates });
}

/**
 * Simulates the selection of a tool.
 *
 * @param {String} toolId ID of the tool to select.
 */
function userSelectTool(toolId) {
  userMoveMouseCursorToMenu();
  $(toolId).click();
  failIfConditionIsFalse(getSelectedTool() === toolId);
}

/**
 * Simulates a click on a point.
 *
 * @param {L.LatLng} point Point to be clicked on.
 */
function userClickPoint(point) {
  userMoveMouseCursorOverMap(point.getLatLng());
  point.fire("click");
}

/**
 * Simulates a click on the map.
 *
 * @param {L.LatLng} coordinates Coordinates where the click event occurs.
 */
function userClickOnMap(coordinates) {
  userMoveMouseCursorOverMap(coordinates);
  map.fire("click", { latlng: coordinates, originalEvent: {} });
}

/**
 * Simulates a click on the "undo" button.
 */
function userClickUndo() {
  userMoveMouseCursorToMenu();
  $("#undo").click();
}

/**
 * Simulates a click on the "redo" button.
 */
function userClickRedo() {
  userMoveMouseCursorToMenu();
  $("#redo").click();
}

/**
 * Simulates the addition of points to the map.
 *
 * @param {Number} numPoints Number of points to add.
 */
function userAddRandomPoints(numPoints) {
  userSelectTool(ToolsEnum.ADDPOINT);
  for (let i = 0; i < numPoints; ++i) {
    const pointArrayLength = pointArray.length;
    userClickOnMap(randomCoordinates());
    failIfConditionIsFalse(pointArray.length === pointArrayLength + 1);
    failIfConditionIsFalse(segmentArray.length === pointArrayLength);
    failIfConditionIsFalse(segmentArrowArray.length === segmentArray.length);
  }
}

/**
 * Simulates the deletion of points from the map.
 *
 * @param {Number} numPoints Number of points to delete.
 */
function userDeleteRandomPoints(numPoints) {
  userSelectTool(ToolsEnum.DELETEPOINT);
  for (let i = 0; i < numPoints; ++i) {
    const pointArrayLength = pointArray.length;
    const point = getRandomPointOnPath();
    userClickPoint(point);
    failIfConditionIsFalse(pointArray.indexOf(point) === -1);
    failIfConditionIsFalse(pointArray.length === pointArrayLength - 1);
    failIfConditionIsFalse(
      segmentArray.length === Math.max(pointArrayLength - 2, 0)
    );
    failIfConditionIsFalse(segmentArrowArray.length === segmentArray.length);
  }
}

/**
 * Simulates the moving of points on the map.
 *
 * @param {Number} numMoves Number of moves to apply.
 */
function userMoveRandomPoints(numMoves) {
  userSelectTool(ToolsEnum.MOVEPOINT);
  const pointArrayLength = pointArray.length;
  for (let i = 0; i < numMoves; ++i) {
    const point = getRandomPointOnPath();
    const newCoordinates = randomCoordinates();
    userClickPoint(point);
    failIfConditionIsFalse(isPointSelected(point));
    userMoveMouseCursorOverMap(newCoordinates);
    userClickPoint(point);
    failIfConditionIsFalse(
      areCoordinatesEqual(point.getLatLng(), newCoordinates)
    );
    failIfConditionIsFalse(isPointSelected(null));
    failIfConditionIsFalse(pointArray.length === pointArrayLength);
  }
}

/**
 * Simulates the editing of point coordinates on the map.
 *
 * @param {Number} numEdits Number of edits to make.
 */
function userEditRandomPoints(numEdits) {
  const pointArrayLength = pointArray.length;
  userSelectTool(ToolsEnum.EDITPOINT);
  for (let i = 0; i < numEdits; ++i) {
    const point = getRandomPointOnPath();
    const newCoordinates = randomCoordinates();
    userClickPoint(point);
    failIfConditionIsFalse(isPointSelected(point));
    $("#selected-point-latitude").focusin();
    $("#selected-point-latitude").val(newCoordinates.lat);
    $("#selected-point-latitude").focusout();
    $("#selected-point-longitude").focusin();
    $("#selected-point-longitude").val(newCoordinates.lng);
    $("#selected-point-longitude").focusout();
    failIfConditionIsFalse(
      areCoordinatesEqual(point.getLatLng(), newCoordinates)
    );
    failIfConditionIsFalse(isPointSelected(point));
    failIfConditionIsFalse(pointArray.length === pointArrayLength);
  }
  userClickOnMap(randomCoordinates());
  failIfConditionIsFalse(isPointSelected(null));
}

/**
 * Simulates the addition of points through the multi-point line tool.
 *
 * @param {Number} minNumPoints Minimum number of points to be added.
 */
function userAddMultiPointLine(minNumPoints) {
  const pointArrayLength = pointArray.length;
  userSelectTool(ToolsEnum.MULTIPOINTLINE);
  while (pointArray.length < pointArrayLength + minNumPoints) {
    userClickOnMap(randomCoordinates());
    failIfConditionIsFalse(pointArray.length >= pointArrayLength);
  }
}

/**
 * Simulates a click on the "×" icon to close a point information popup.
 */
function userClosePointInfoPopup() {
  $("#close-point-info-popup").click();
}

/**
 * Simulates the loading of an NMEA file.
 *
 * @param {String} nmeaData NMEA file contents.
 */
function userLoadNmeaFile(nmeaData) {
  onNmeaFileDataLoaded(nmeaData, "input.nmea");
}

/**
 * Simulates the loading of a CSV file.
 *
 * @param {String} csvData CSV file contents.
 */
function userLoadCsvFile(csvData) {
  onCsvFileDataLoaded(csvData, "input.csv");
}

/*******************************************************************************
 *
 *    TEST DEFINITIONS
 *
 ******************************************************************************/

function testConfiguration() {
  failIfConditionIsFalse(coordinatesFractionalDigits >= 0);
  failIfConditionIsFalse(maxMultiPointLinePoints > 0);
  failIfConditionIsFalse(maxMultiPointLinePoints <= 10000);
  failIfConditionIsFalse(pointRadius > 0);
  failIfConditionIsFalse(gpsFrequency > 0);
  failIfConditionIsFalse(multiPointLineStepSize > 0);
  failIfConditionIsFalse(numSatellites >= 0);
  failIfConditionIsFalse(numSatellites < 13);
  failIfConditionIsFalse(minZoomLevel > 0);
  failIfConditionIsFalse(maxZoomLevel <= 20);
}

function testSelectTool() {
  $.each(ToolsEnum, function(_dummy, toolId) {
    userSelectTool(toolId);
  });
}

function testAddPoints() {
  userAddRandomPoints(numTestPoints);
}

function testAddPointsDeletePoints() {
  userAddRandomPoints(numTestPoints);
  userDeleteRandomPoints(numTestPoints);
}

function testAddPointsMovePoints() {
  userAddRandomPoints(numTestPoints);
  userSelectTool(ToolsEnum.MOVEPOINT);
  userMoveRandomPoints(numTestPoints);
}

function testAddPointsEditPoints() {
  userAddRandomPoints(numTestPoints);
  userSelectTool(ToolsEnum.EDITPOINT);
  userEditRandomPoints(numTestPoints);
}

function testAddPointsPointInfo() {
  userAddRandomPoints(numTestPoints);
  userSelectTool(ToolsEnum.POINTINFO);

  // Select a point, then close the info popup by clicking on the "×" icon.
  for (const point of pointArray) {
    userClickPoint(point);
    failIfConditionIsFalse(isPointSelected(point));
    userClosePointInfoPopup();
    failIfConditionIsFalse(isPointSelected(null));
  }

  // Select a point and check its associated information.
  for (let i = 0; i < pointArray.length; ++i) {
    const point = pointArray[i];
    userClickPoint(point);
    failIfConditionIsFalse(isPointSelected(point));
    if (i === 0) {
      failIfConditionIsFalse(getDistanceToPreviousPoint(i) === null);
    } else {
      failIfConditionIsFalse(getDistanceToPreviousPoint(i) !== null);
    }
    if (i === pointArray.length - 1) {
      failIfConditionIsFalse(getDistanceToNextPoint(i) === null);
    } else {
      failIfConditionIsFalse(getDistanceToNextPoint(i) !== null);
    }
    failIfConditionIsFalse(getPointBearing(i) !== null);
    failIfConditionIsFalse(getSpeedAtPointMps(i) !== null);
    failIfConditionIsFalse(getSpeedAtPointKnots(i) !== null);
  }
  userClickOnMap(randomCoordinates());
  failIfConditionIsFalse(isPointSelected(null));
}

function testAddMultiPointLine() {
  userSelectTool(ToolsEnum.MULTIPOINTLINE);
  // The first click on the map adds a single point.
  userClickOnMap(randomCoordinates());
  failIfConditionIsFalse(pointArray.length === 1);
  userAddMultiPointLine(500);
  failIfConditionIsFalse(pointArray.length > 500);
}

function testAddPointsUndoAll() {
  checkNumUndoRedoActions(0, 0);

  // Add numTestPoints points.
  for (let i = 0; i < numTestPoints; ++i) {
    checkNumUndoRedoActions(i, 0);
    userAddRandomPoints(1);
    checkNumUndoRedoActions(i + 1, 0);
  }

  // Undo as much as possible */
  for (let i = numTestPoints; i > 0; --i) {
    checkNumUndoRedoActions(i, numTestPoints - i);
    failIfConditionIsFalse(pointArray.length === i);
    userClickUndo();
    checkNumUndoRedoActions(i - 1, numTestPoints - (i - 1));
    failIfConditionIsFalse(pointArray.length === i - 1);
  }
}

function testAddPointsUndoAllRedoAll() {
  testAddPointsUndoAll();
  // Redo as much as possible */
  for (let i = 0; i < numTestPoints; ++i) {
    checkNumUndoRedoActions(i, numTestPoints - i);
    failIfConditionIsFalse(pointArray.length === i);
    userClickRedo();
    checkNumUndoRedoActions(i + 1, numTestPoints - (i + 1));
    failIfConditionIsFalse(pointArray.length === i + 1);
  }
}

function testAddPointsUndoAllAddPoint() {
  testAddPointsUndoAll();
  checkNumUndoRedoActions(0, numTestPoints);
  userAddRandomPoints(1);
  // After adding a point, we have a single "undo" action and no "redo" action.
  checkNumUndoRedoActions(1, 0);
}

function testMoveMouseCursor() {
  // Test the preview points/segments before any point is added.
  $.each(ToolsEnum, function(_dummy, toolId) {
    userSelectTool(toolId);
    // Mouse cursor motion: map -> menu -> map -> menu.
    for (let j = 0; j < 2; ++j) {
      const mouseCoordinates = randomCoordinates();
      userMoveMouseCursorOverMap(mouseCoordinates);
      failIfConditionIsFalse(lastMouseCoordinates !== null);
      // Both "add point" and "multi-point line" tools behave the same way if
      // no points have been added to the map yet.
      if (
        toolId === ToolsEnum.ADDPOINT ||
        toolId === ToolsEnum.MULTIPOINTLINE
      ) {
        checkPreviewPointsAndSegments(1, 0);
        failIfConditionIsFalse(
          areCoordinatesEqual(
            previewPointArray[0].getLatLng(),
            mouseCoordinates
          )
        );
      } else {
        checkPreviewPointsAndSegments(0, 0);
      }
      userMoveMouseCursorToMenu();
      failIfConditionIsFalse(lastMouseCoordinates === null);
      checkPreviewPointsAndSegments(0, 0);
    }
  });

  // Test the preview points/segments after points are added.
  for (let i = 0; i < numTestPoints; ++i) {
    userAddRandomPoints(1);
    $.each(ToolsEnum, function(_dummy, toolId) {
      userSelectTool(toolId);
      // Mouse cursor motion: map -> menu -> map -> menu.
      for (let j = 0; j < 2; ++j) {
        userMoveMouseCursorOverMap(randomCoordinates());
        failIfConditionIsFalse(lastMouseCoordinates !== null);
        if (toolId === ToolsEnum.ADDPOINT) {
          checkPreviewPointsAndSegments(1, 1);
        } else if (toolId !== ToolsEnum.MULTIPOINTLINE) {
          checkPreviewPointsAndSegments(0, 0);
        }
        userMoveMouseCursorToMenu();
        failIfConditionIsFalse(lastMouseCoordinates === null);
        checkPreviewPointsAndSegments(0, 0);
      }
    });
  }

  // Test the preview points/segments when points are selected.
  $.each(ToolsEnum, function(_dummy, toolId) {
    // Consider only the tools which can select points.
    if (
      [ToolsEnum.MOVEPOINT, ToolsEnum.EDITPOINT, ToolsEnum.POINTINFO].indexOf(
        toolId
      ) === -1
    ) {
      return;
    }
    userSelectTool(toolId);
    for (let i = 0; i < pointArray.length; ++i) {
      const point = pointArray[i];
      userClickPoint(point);
      failIfConditionIsFalse(isPointSelected(point));
      // Mouse cursor motion: map -> menu -> map -> menu.
      for (let j = 0; j < 2; ++j) {
        const mouseCoordinates = randomCoordinates();
        userMoveMouseCursorOverMap(mouseCoordinates);
        failIfConditionIsFalse(lastMouseCoordinates !== null);
        const numSegments = i === 0 || i === pointArray.length - 1 ? 1 : 2;
        // A selected point is not a preview point, but its inciding segments
        // are preview segments.
        checkPreviewPointsAndSegments(0, numSegments);
        // Move point tool: the selected point must move with the mouse cursor.
        if (toolId === ToolsEnum.MOVEPOINT) {
          failIfConditionIsFalse(
            areCoordinatesEqual(point.getLatLng(), mouseCoordinates)
          );
        }
        userMoveMouseCursorToMenu();
        failIfConditionIsFalse(lastMouseCoordinates === null);
        // A selected point is not a preview point, but its inciding segments
        // are preview segments.
        checkPreviewPointsAndSegments(0, numSegments);
        // Move point tool: the selected point must now be at its original
        // position (mouse cursor on menu).
        if (toolId === ToolsEnum.MOVEPOINT) {
          failIfConditionIsFalse(
            areCoordinatesEqual(
              point.getLatLng(),
              selectedPointOriginalCoordinates
            )
          );
        }
      }
      // Deselect the currently selected point.
      userClickOnMap(randomCoordinates());
      failIfConditionIsFalse(isPointSelected(null));
    }
  });
}

function testMultipleActionsUndoAll() {
  checkNumUndoRedoActions(0, 0);
  userAddRandomPoints(5);
  checkNumUndoRedoActions(5, 0);
  userAddRandomPoints(3);
  checkNumUndoRedoActions(8, 0);
  userDeleteRandomPoints(3);
  checkNumUndoRedoActions(11, 0);
  userMoveRandomPoints(5);
  checkNumUndoRedoActions(16, 0);
  userEditRandomPoints(4);
  checkNumUndoRedoActions(20, 0);
  userAddMultiPointLine(1);
  checkNumUndoRedoActions(21, 0);

  for (let i = 21; i > 0; --i) {
    checkNumUndoRedoActions(i, 21 - i);
    userClickUndo();
    checkNumUndoRedoActions(i - 1, 21 - (i - 1));
  }
}

function testInnocuousActionsOnEmptyMap() {
  $.each(ToolsEnum, function(_dummy, toolId) {
    // Consider only the tools which do not add points.
    if ([ToolsEnum.ADDPOINT, ToolsEnum.MULTIPOINTLINE].indexOf(toolId) !== -1) {
      return;
    }
    userSelectTool(toolId);
    for (let i = 0; i < numTestPoints; ++i) {
      userClickOnMap(randomCoordinates());
      checkNumUndoRedoActions(0, 0);
    }
  });
}

function testLoadNmeaData() {
  const nmeaData =
    "$GPGGA,215909.285,5232.252,N,01321.913,E,1,12,1.0,0.0,M,0.0,M,,*6E\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215909.285,A,5232.252,N,01321.913,E,1314.7,090.0,251216,000.0,W*40\n" +
    "$GPGGA,215910.285,5232.252,N,01322.513,E,1,12,1.0,0.0,M,0.0,M,,*69\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215910.285,A,5232.252,N,01322.513,E,2161.5,000.0,251216,000.0,W*4F\n" +
    "$GPGGA,215911.285,5232.852,N,01322.513,E,1,12,1.0,0.0,M,0.0,M,,*62\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215911.285,A,5232.852,N,01322.513,E,1314.4,270.0,251216,000.0,W*43\n" +
    "$GPGGA,215912.285,5232.852,N,01321.913,E,1,12,1.0,0.0,M,0.0,M,,*6E\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215912.285,A,5232.852,N,01321.913,E,1314.4,270.0,251216,000.0,W*4F\n";
  userLoadNmeaFile(nmeaData);

  const date = new Date(Date.UTC(2016, 11, 25, 21, 59, 9, 285));
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse(gpsFrequency === 1.0);
  failIfConditionIsFalse($("#start-time").val() === "21:59:09.285");
  failIfConditionIsFalse($("#start-date").val() === "2016-12-25");
  checkNumUndoRedoActions(1, 0);
  failIfConditionIsFalse(generateNmeaData() === nmeaData);
}

function testLoadCsvData() {
  const csvData =
    "52.518509,13.399575\n" +
    "52.518481,13.399696\n" +
    "52.518509,13.399814\n" +
    "52.518591,13.399857\n" +
    "52.518652,13.399817\n" +
    "52.518683,13.399721\n" +
    "52.518664,13.399608\n" +
    "52.518709,13.399559\n" +
    "52.518755,13.399516\n";
  userLoadCsvFile(csvData);
  failIfConditionIsFalse(generateCsvData() === csvData);
}

function testLoadNmeaDataCornerCases() {
  let date = new Date();
  let nmeaData = "";

  // Case #1: no RMC or GGA sentences.
  userLoadNmeaFile(nmeaData);
  failIfConditionIsFalse(gpsFrequency === 1.0);
  failIfConditionIsFalse(
    Math.abs(startDate.getTime() - date.getTime()) <= 1000
  );
  failIfConditionIsFalse(
    $("#start-time").val() === timeToUtcTimeOfDay(startDate)
  );
  failIfConditionIsFalse($("#start-date").val() === timeToUtcDate(startDate));

  // Case #2: no RMC sentences, GGA sentences happen at the same day.
  nmeaData =
    "$GPGGA,132305.387,5233.053,N,01322.057,E,1,12,1.0,0.0,M,0.0,M,,*65\n" +
    "$GPGGA,132305.487,5233.053,N,01323.705,E,1,12,1.0,0.0,M,0.0,M,,*63\n";
  userLoadNmeaFile(nmeaData);
  date = new Date();
  date.setUTCHours(13);
  date.setUTCMinutes(23);
  date.setUTCSeconds(5);
  date.setUTCMilliseconds(387);

  failIfConditionIsFalse(gpsFrequency === 10.0);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "13:23:05.387");
  failIfConditionIsFalse($("#start-date").val() === timeToUtcDate(startDate));

  // Case #3: no RMC sentences, GGA sentences happen at different days.
  nmeaData =
    "$GPGGA,235959.800,5233.053,N,01322.057,E,1,12,1.0,0.0,M,0.0,M,,*66\n" +
    "$GPGGA,000000.200,5233.053,N,01323.705,E,1,12,1.0,0.0,M,0.0,M,,*6C\n";
  userLoadNmeaFile(nmeaData);
  date = new Date();
  date.setUTCHours(23);
  date.setUTCMinutes(59);
  date.setUTCSeconds(59);
  date.setUTCMilliseconds(800);

  failIfConditionIsFalse(gpsFrequency === 2.5);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "23:59:59.800");
  failIfConditionIsFalse($("#start-date").val() === timeToUtcDate(startDate));

  // Case #4: no GGA sentences, but RMC sentence present.
  nmeaData = "$GPRMC,140355.726,A,5231.794,N,01323.334,E,,,051216,000.0,W*76\n";
  userLoadNmeaFile(nmeaData);
  date = new Date(Date.UTC(2016, 11, 5, 14, 3, 55, 726));

  failIfConditionIsFalse(gpsFrequency === 1.0);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "14:03:55.726");
  failIfConditionIsFalse($("#start-date").val() === "2016-12-05");

  // Case #5: both GGA and RMC sentences, all in the same day, GGA first.
  nmeaData =
    "$GPGGA,134756.992,5231.186,N,01320.821,E,1,12,1.0,0.0,M,0.0,M,,*6F\n" +
    "$GPRMC,134756.992,A,5231.186,N,01320.821,E,47426.2,090.8,271216,000.0,W*7A\n" +
    "$GPGGA,134757.192,5231.124,N,01325.147,E,1,12,1.0,0.0,M,0.0,M,,*62\n" +
    "$GPRMC,134757.192,A,5231.124,N,01325.147,E,47426.2,090.8,271216,000.0,W*77\n";
  userLoadNmeaFile(nmeaData);
  date = new Date(Date.UTC(2016, 11, 27, 13, 47, 56, 992));

  failIfConditionIsFalse(gpsFrequency === 5.0);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "13:47:56.992");
  failIfConditionIsFalse($("#start-date").val() === "2016-12-27");

  // Case #6: both GGA and RMC sentences, all in the same day, RMC first
  nmeaData =
    "$GPRMC,144441.207,A,5232.139,N,01319.729,E,22395.9,094.5,181116,000.0,W*74\n" +
    "$GPGGA,144441.457,5231.938,N,01322.263,E,1,12,1.0,0.0,M,0.0,M,,*6A\n" +
    "$GPRMC,144441.457,A,5231.938,N,01322.263,E,21634.9,085.9,181116,000.0,W*7F\n" +
    "$GPGGA,144441.707,5232.114,N,01324.714,E,1,12,1.0,0.0,M,0.0,M,,*6A\n";
  userLoadNmeaFile(nmeaData);
  date = new Date(Date.UTC(2016, 10, 18, 14, 44, 41, 207));

  failIfConditionIsFalse(gpsFrequency === 4.0);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "14:44:41.207");
  failIfConditionIsFalse($("#start-date").val() === "2016-11-18");

  // Case #7: both GGA and RMC sentences, but in different days, GGA first.
  nmeaData =
    "$GPGGA,235959.700,5231.161,N,01322.119,E,1,12,1.0,0.0,M,0.0,M,,*60\n" +
    "$GPRMC,000000.200,A,5231.111,N,01325.373,E,14273.7,090.9,101016,000.0,W*7D\n" +
    "$GPGGA,000000.200,5231.111,N,01325.373,E,1,12,1.0,0.0,M,0.0,M,,*6A\n";
  userLoadNmeaFile(nmeaData);
  date = new Date(Date.UTC(2016, 9, 9, 23, 59, 59, 700));

  failIfConditionIsFalse(gpsFrequency === 2.0);
  failIfConditionIsFalse(startDate.getTime() === date.getTime());
  failIfConditionIsFalse($("#start-time").val() === "23:59:59.700");
  failIfConditionIsFalse($("#start-date").val() === "2016-10-09");
}

function testGenerateNmeaData() {
  // 2016-12-25T21:59:09.285Z (as ISO string).
  const date = new Date(0);
  date.setUTCMilliseconds(Date.UTC(2016, 11, 25, 21, 59, 9, 285));
  setStartDate(date);
  userSelectTool(ToolsEnum.ADDPOINT);
  userClickOnMap(L.latLng(52.537525, 13.365224));
  userClickOnMap(L.latLng(52.537525, 13.375224));
  userClickOnMap(L.latLng(52.547525, 13.375224));
  userClickOnMap(L.latLng(52.547525, 13.365224));
  const nmeaData =
    "$GPGGA,215909.285,5232.252,N,01321.913,E,1,12,1.0,0.0,M,0.0,M,,*6E\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215909.285,A,5232.252,N,01321.913,E,1314.7,090.0,251216,000.0,W*40\n" +
    "$GPGGA,215910.285,5232.252,N,01322.513,E,1,12,1.0,0.0,M,0.0,M,,*69\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215910.285,A,5232.252,N,01322.513,E,2161.5,000.0,251216,000.0,W*4F\n" +
    "$GPGGA,215911.285,5232.852,N,01322.513,E,1,12,1.0,0.0,M,0.0,M,,*62\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215911.285,A,5232.852,N,01322.513,E,1314.4,270.0,251216,000.0,W*43\n" +
    "$GPGGA,215912.285,5232.852,N,01321.913,E,1,12,1.0,0.0,M,0.0,M,,*6E\n" +
    "$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30\n" +
    "$GPRMC,215912.285,A,5232.852,N,01321.913,E,1314.4,270.0,251216,000.0,W*4F\n";
  failIfConditionIsFalse(generateNmeaData() === nmeaData);
}

function runTests() {
  const tests = {
    "Configuration parameters": testConfiguration,
    "Tool selection": testSelectTool,
    "Add points": testAddPoints,
    "Add points, delete points": testAddPointsDeletePoints,
    "Add points, move points": testAddPointsMovePoints,
    "Add points, edit points": testAddPointsEditPoints,
    "Add points, get point information": testAddPointsPointInfo,
    "Add multi-point line": testAddMultiPointLine,
    "Add points, undo all": testAddPointsUndoAll,
    "Add points, undo all, redo all": testAddPointsUndoAllRedoAll,
    "Add points, undo all, add point": testAddPointsUndoAllAddPoint,
    "Move mouse cursor, check preview points": testMoveMouseCursor,
    "Do multiple things, undo all": testMultipleActionsUndoAll,
    "Innocuous actions on empty map": testInnocuousActionsOnEmptyMap,
    "Load nmea data": testLoadNmeaData,
    "Load CSV data": testLoadCsvData,
    "Load nmea data with corner cases": testLoadNmeaDataCornerCases,
    "Generate nmea data": testGenerateNmeaData
  };

  for (const [testName, testFunction] of Object.entries(tests)) {
    try {
      testFunction();
      tearDown();
      console.log("[PASS] " + testName + ".");
    } catch (error) {
      console.error("[FAIL] " + testName + " (" + error + ").");
      console.error(error.stack);
      break;
    }
  }
}
