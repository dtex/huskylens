var five = require("johnny-five");
var Huskylens = require("../index.js")(five);

const board = new five.Board();

board.on("ready", function() {

  const lens = new Huskylens({
    pins: { rx:11, tx:10 },
    mode: "LINE_TRACKING"
  });

  lens.on("ready", () => {
    console.log("The Huskylens is connected and ready");
  });

  lens.on("okay", () => {
    console.log("The Huskylens received a Command");
    console.log("The current mode is " + lens.mode());
  });

  lens.on("block", block => {
    console.log(block);
  });

  lens.on("arrow", block => {
    console.log(block);
  });

});