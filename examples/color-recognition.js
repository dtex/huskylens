/*
 * THe HuskeyLens has been trianed to recognize Cows, 
 * Cats and Dogs with ID's set to 1, 2, and 3 respectively
 */
const five = require("johnny-five");
const HuskyLens = require("../index.js")(five);

const board = new five.Board();

const SPEAK = [
  "Unlearned object", // Unknown object
  "Meow!",  // id: 1
  "Moo!",  // id: 2
  "Woof!"  // id: 3
];

board.on("ready", () => {

  const lens = new HuskyLens({
    pins: { rx:11, tx:10 },
    mode: "OBJECT_RECOGNITION"
  });

  lens.on("ready", block => {
    console.log("The Huskylens is connected and ready");
  });

  lens.on("block", block => {
    console.log(`${SPEAK[block.id]}`, block);
  });

});