/*
 * Here I've trained my Huskylens to recognize my family
 */
const five = require("johnny-five");
const Huskylens = require("../index.js")(five);

const board = new five.Board();

const FACES = [
  "Stranger", // Unknown face
  "Harrison",  // id: 1
  "Donovan",  // id: 2
  "Eleanor"  // id: 3
];

board.on("ready", () => {

  const lens = new Huskylens({
    pins: { rx:11, tx:10 },
    mode: "FACE_RECOGNITION"
  });

  lens.on("ready", () => {
    console.log("The Huskylens is connected and ready");
  });

  lens.on("block", block => {
    console.log(`Hello ${FACES[block.id]}!`, block);
  });

});