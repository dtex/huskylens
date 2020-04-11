const events = require("events");
const util = require("util");

const HL = {
  HEADER: 0x55,
  HEADER2: 0xaa,
  ADDRESS: 0x11,
  COMMANDS: {
    REQUEST: 0x20,
    REQUEST_BLOCKS: 0x21,
    REQUEST_ARROWS: 0x22,
    REQUEST_LEARNED: 0x23,
    REQUEST_BLOCKS_LEARNED: 0x24,
    REQUEST_ARROWS_LEARNED: 0x25,
    REQUEST_BY_ID: 0x26,
    REQUEST_BLOCKS_BY_ID: 0x27,
    REQUEST_ARROWS_BY_ID: 0x28,
    RETURN_INFO: 0x29,
    RETURN_BLOCK: 0x2a,
    RETURN_ARROW: 0x2b,
    KNOCK: 0x2c,
    REQUEST_ALGORORITHM: 0x2d,
    RETURN_OK: 0x2e,
  },
  ALGORITHM: {
    FACE_RECOGNITION: [0x00, 0x00],
    OBJECT_TRACKING: [0x01, 0x00],
    OBJECT_RECOGNITION: [0x02, 0x00],
    LINE_TRACKING: [0x03, 0x00],
    COLOR_RECOGNITION: [0x04, 0x00],
    TAG_RECOGNITION: [0x05, 0x00],
    OBJECT_CLASSIFICATION: [0x06, 0x00],
    LOOKUP: [
      "FACE_RECOGNITION",
      "OBJECT_TRACKING",
      "OBJECT_RECOGNITION",
      "LINE_TRACKING",
      "COLOR_RECOGNITION",
      "TAG_RECOGNITION",
      "OBJECT_CLASSIFICATION"
    ]
  },

};

const priv = new Map();

module.exports = function(five) {
  return (function() {

    function Huskylens(opts) {
      if (!(this instanceof Huskylens)) {
        return new Huskylens(opts);
      }

      // Allow users to pass in a 2 or 3 element array for rx and tx pins
      if (Array.isArray(opts)) {
        opts = {
          pins: {
            rx: opts[0],
            tx: opts[1]
          }
        };
      }

      if (typeof opts.pins === "undefined") {
        opts.pins = {};
      }

      five.Board.Component.call(
        this, opts = five.Board.Options(opts)
      );

      state = {
        mode: HL.ALGORITHM.FACE_RECOGNITION,
        isRunning: false,
        interval: null,
        blocks: 0,
        learned: 0,
        frame: 0
      };
    
      priv.set(this, state);

      util.inherits(Huskylens, events.EventEmitter);
      
      this.initialize(opts);

    }

    /*
    * Initialize the Huskylens
    */
    Huskylens.prototype.initialize = function(opts) {

      const state = priv.get(this);
      state.portId = opts.serialPort || opts.portId || opts.port || opts.bus;
      
      // firmata.js has a SERIAL_PORT_IDs.DEFAULT that is not 
      // necessary in other IO plugins so it won't always exist. 
      if (typeof state.portId === "undefined" && this.io.SERIAL_PORT_IDs) {
        state.portId = this.io.SERIAL_PORT_IDs.DEFAULT;
      }

      // Set the pin modes
      ["rx", "tx"].forEach(function(pin) {
        if (this.pins[pin]) {
          this.io.pinMode(this.pins[pin], this.io.MODES.SERIAL);
        }
      }, this);

      this.io.serialConfig({
        portId: state.portId,
        baud: opts.baud || 9600,
        rxPin: this.pins.rx,
        txPin: this.pins.tx
      });

      this.on("error", (err) => {
        console.error(err.message);
      });

      state.freq = opts.freq || 1;
      
      this.listen();

      if (opts.mode) {
        state.mode = typeof opts.mode === "string" ? HL.ALGORITHM[opts.mode] : opts.mode;
      }

      this.once("ready", () => {
        this.mode(state.mode);
        this.start();       
      });
      
      this.sendCommand(HL.COMMANDS.KNOCK);

    };

    Huskylens.prototype.listen = function() {

      const state = priv.get(this);
      let command = [];
    
      // Start the read loop
      this.io.serialRead(state.portId, data => {
        
        command = command.concat(data);

        if (command[0] !== HL.HEADER) {
          command = [];
          return;
        }
          // See if we have enough data to check
        if (command.length < 5) return;
        
        // if the command doesn't start with the correct three bytes, start over
        if (command[1] !== HL.HEADER2 || command[2] !== HL.ADDRESS) {
          command = [];
          return;
        }

        // If we have not yet reached the expected length
        if (command.length < command[3] + 5) return;
        
        // If we have enough bytes, split and parse
        if (command.length >= command[3] + 5) {
          
          this.parseCommand(command.slice(0, command[3] + 5));
          command = command.slice(command[3] + 6);
          return;
        }

        command = {raw: [] };
      });
    };

    Huskylens.prototype.mode = function(mode) {
      let state = priv.get(this);
      
      if (!mode) {
        return HL.ALGORITHM.LOOKUP[state.mode[0]]
      }
      if (typeof mode === "string" && HL.ALGORITHM[mode]) {
        state.mode = HL.ALGORITHM[mode];
      }
      if (Array.isArray(mode) && mode.length === 2) {
        state.mode = mode;
      }
      this.sendCommand(HL.COMMANDS.REQUEST_ALGORORITHM, state.mode);
    };

    Huskylens.prototype.freq = function(freq) {
      let state = priv.get(this);
      
      if (!freq) {
        return state.freq;
      }

      if (typeof freq === "number") {
        state.freq = freq;
      }
      if (state.isRunning) {
        this.stop();
        this.start();
      }
    };

    Huskylens.prototype.stop = function() {
      let state = priv.get(this);
      state.isRunning = false;
      if (state.interval) {
        clearInterval(state.interval);
      }
    };

    Huskylens.prototype.start = function() {
      let state = priv.get(this);
      state.isRunning = true;
      state.interval = setInterval(() => {
        this.sendCommand(HL.COMMANDS.REQUEST);
      }, 1000/state.freq);
    };

    Huskylens.prototype.parseCommand = function(data) {
      
      let state = priv.get(this);
      
      const command = data[4];
      
      switch (command) {
        
        case HL.COMMANDS.RETURN_OK:
          if (!state.isReady) {
            this.emit("ready");
            state.isReady = true;
          } else {
            this.emit("okay");
          }
          break;

        case HL.COMMANDS.RETURN_INFO:
          let blocks = data[5] | (data[6] << 8);
          let learned = data[7] | (data[8] << 8);
          let frame = data[9] | (data[10] << 8);
          this.emit("info", { blocks, learned, frame });
          break;

        case HL.COMMANDS.RETURN_BLOCK:
          let x = data[5] | (data[6] << 8);
          let y = data[7] | (data[8] << 8);
          let width = data[9] | (data[10] << 8);
          let height = data[11] | (data[12] << 8);
          let id = data[13] | (data[14] << 8);
          this.emit("block", { x, y, width, height, id });
          break;

        case HL.COMMANDS.RETURN_ARROW:
          let xOrigin = data[5] | (data[6] << 8);
          let yOrigin = data[7] | (data[8] << 8);
          let xTarget = data[9] | (data[10] << 8);
          let yTarget = data[11] | (data[12] << 8);
          let arrowID = data[13] | (data[14] << 8);
          this.emit("arrow", { xOrigin, yOrigin, xTarget, yTarget, id: arrowID });
          break;

        default:
          this.emit("error", new Error("Unrecognized command: 0x" + command.toString(16)));
      }

    };

    Huskylens.prototype.sendCommand = function(command, data) {

      let state = priv.get(this);
      if (!Array.isArray(data)) data = [];
      command = [HL.HEADER, HL.HEADER2, HL.ADDRESS, data.length || 0x00, command].concat(data)
      if (data) command.concat(data);
      let checksum = command.reduce((sum, byte) => sum + byte) & 0xff;

      command.push(checksum);
      this.io.serialWrite(state.portId, command);

    };


    return Huskylens;
  }());
};