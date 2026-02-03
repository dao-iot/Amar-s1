const socketio = require("socket.io");
let io;

function setup(server) {
  io = socketio(server, { cors: { origin: "*" } });

  io.on("connection", socket => {
    console.log("🔌 Client connected:", socket.id);
  });
}

function getIO() {
  return io;
}

module.exports = setup;
module.exports.getIO = getIO;
