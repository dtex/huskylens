/*
 * 
 */
const five = require("johnny-five");
const HuskyLens = require("../index.js")(five);

const board = new five.Board();

board.on("ready", () => {

  const lens = new HuskyLens({
    pins: { rx:11, tx:10 },
    mode: "LINE_TRACKING"
  });

  lens.on("ready", () => {
    console.log("The HuskyLens is connected and ready");
  });

  lens.on("arrow", arrow => {
    
    let vector = [arrow.xTarget - arrow.xOrigin, arrow.yTarget - arrow.yOrigin];
    let magnitude = Math.sqrt(vector[0]**2 + vector[1]**2);
    let angle = Math.atan(vector[1]/vector[0]) / Math.PI * 180;
    angle = vector[0]< 1 ? -90 + angle : angle + 90;
    
    console.log(`Vector: ${vector}, Magnitude: ${magnitude}, Angle: ${angle}°`);

  });

});