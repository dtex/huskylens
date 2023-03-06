const eventEmitter = require("events");

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
    COMMAND_REQUEST_LEARN: 0x2f,
    COMMAND_REQUEST_FORGET: 0x30,
    COMMAND_REQUEST_SENSOR: 0x31
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
  }
};

module.exports = function(five) {
  return (function() {

    class Huskylens extends eventEmitter {

      #state = {
        mode: HL.ALGORITHM.FACE_RECOGNITION,
        isRunning: false,
        interval: null,
        blocks: 0,
        learned: 0,
        frame: 0
      };
    
      constructor(opts) {

        // Allow users to pass in a 2 or 3 element array for rx and tx pins
        if (Array.isArray(opts)) {
          opts = { pins: { rx: opts[0], tx: opts[1] } };
        }
  
        if (typeof opts.pins === "undefined") {
          opts.pins = {};
        }
  
        super();
        five.Board.Component.call( this, opts = five.Board.Options(opts) );
        this.initialize(opts);
      }

      /*
       * Initialize the Huskylens
       */
      initialize(opts) {

        this.#state.portId = opts.serialPort || opts.portId || opts.port || opts.bus;
        
        // firmata.js has a SERIAL_PORT_IDs.DEFAULT that is not 
        // necessary in other IO plugins so it won't always exist. 
        if (typeof this.#state.portId === "undefined" && this.io.SERIAL_PORT_IDs) {
          this.#state.portId = this.io.SERIAL_PORT_IDs.DEFAULT;
        }

        // Set the pin modes
        ["rx", "tx"].forEach(pin => {
          if (this.pins[pin]) {
            this.io.pinMode(this.pins[pin], this.io.MODES.SERIAL);
          }
        });

        this.io.serialConfig({
          portId: this.#state.portId,
          baud: opts.baud || 9600,
          rxPin: this.pins.rx,
          txPin: this.pins.tx
        });

        this.#state.freq = opts.freq || 1;
        
        this.listen();

        if (opts.mode) {
          this.#state.mode = typeof opts.mode === "string" ? HL.ALGORITHM[opts.mode] : opts.mode;
        }

        this.on("error", (err) => {
          console.error(err.message);
        });
        
        this.once("ready", () => {
          this.mode(this.#state.mode);
          this.start();       
        });
        
        this.sendCommand(HL.COMMANDS.KNOCK);

      }

      listen() {

        let command = [];
      
        // Start the read loop
        this.io.serialRead(this.#state.portId, data => {
          
          command = command.concat(data);
  
          let offset = command.indexOf(HL.HEADER);
          
          if (offset === -1) {
            command = [];
            return;
          }

          if (offset) command = command.slice(offset);

            // See if we have enough data to check
          if (command.length < 5) return;
          
          // if the command doesn't start with the correct three bytes, start over
          if (command[1] !== HL.HEADER2 || command[2] !== HL.ADDRESS) {
            offset = command.indexOf(HL.HEADER, 1);
            if (offset === -1) {
              command = [];
              return;
            }
            command = command.slice(offset);
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
      }

      mode(mode) {
        
        if (!mode) {
          return HL.ALGORITHM.LOOKUP[this.#state.mode[0]]
        }
        if (typeof mode === "string" && HL.ALGORITHM[mode]) {
          this.#state.mode = HL.ALGORITHM[mode];
        }
        if (Array.isArray(mode) && mode.length === 2) {
          this.#state.mode = mode;
        }
        this.sendCommand(HL.COMMANDS.REQUEST_ALGORORITHM, this.#state.mode);
      }

      freq(freq) {
        
        if (!freq) return this.#state.freq;
  
        if (typeof freq === "number") {
          this.#state.freq = freq;
        }
        if (this.#state.isRunning) {
          this.stop();
          this.start();
        }
      }

      stop() {
        
        this.#state.isRunning = false;
        if (this.#state.interval) {
          clearInterval(this.#state.interval);
        }
      }

      start() {
        
        this.#state.isRunning = true;
        this.#state.interval = setInterval(() => {
          this.sendCommand(HL.COMMANDS.REQUEST);
        }, 1000/this.#state.freq);
      }

      parseCommand(data) {
      
        const command = data[4];
        
        switch (command) {
          
          case HL.COMMANDS.RETURN_OK:
            if (!this.#state.isReady) {
              this.emit("ready");
              this.#state.isReady = true;
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
            if (id > 0) {
              this.emit(`block-${id}`, { x, y, width, height, id });
            }
            break;
  
          case HL.COMMANDS.RETURN_ARROW:
            let xOrigin = data[5] | (data[6] << 8);
            let yOrigin = data[7] | (data[8] << 8);
            let xTarget = data[9] | (data[10] << 8);
            let yTarget = data[11] | (data[12] << 8);
            let arrowID = data[13] | (data[14] << 8);
            this.emit("arrow", { xOrigin, yOrigin, xTarget, yTarget, id: arrowID });
            if (arrowID > 0) {
              this.emit("arrow-${arrowID}", { xOrigin, yOrigin, xTarget, yTarget, id: arrowID });
            }
            break;
  
          default:
            this.emit("error", new Error("Unrecognized command: 0x" + command.toString(16)));
        }
  
      }

      sendCommand(command, data) {

        if (!Array.isArray(data)) data = [];
        
        command = [HL.HEADER, HL.HEADER2, HL.ADDRESS, data.length || 0x00, command].concat(data)
        if (data) command.concat(data);
        
        let checksum = command.reduce((sum, byte) => sum + byte) & 0xff;
        command.push(checksum);
        
        this.io.serialWrite(this.#state.portId, command);
  
      }

    }

    return Huskylens;
  }());

};