/*
 * HuskyLens has been trained to track a single object
 */
const five = require("johnny-five");
const HuskyLens = require("../index.js")(five);

const board = new five.Board();

board.on("ready", () => {

  const lens = new HuskyLens({
    pins: { rx:11, tx:10 },
    mode: "OBJECT_TRACKING"
  });

  lens.on("ready", () => {
    console.log("The HuskyLens is connected and ready");
  });

  lens.on("block", block => {
    
    let hPos = " straight ahead";
    if (block.x < 140) hPos = " to the left";
    if (block.x > 180) hPos = " to the right";

    let vPos = "";
    if (block.y < 100) vPos = " and up";
    if (block.y > 140) vPos = " and down";

    console.log(`The object is${hPos + vPos}.`);

  });

});