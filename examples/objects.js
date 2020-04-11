const five = require("johnny-five");
const Huskylens = require("../index.js")(five);

const board = new five.Board();

board.on("ready", () => {

  const lens = new Huskylens({
    pins: { rx:11, tx:10 },
    mode: "OBJECT_RECOGNITION"
  });

  lens.on("ready", () => {
    console.log("The Huskylens is connected and ready");
  });

  lens.on("block", block => {
    console.log(block);
  });

});