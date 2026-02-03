const http = require("http");
const app = require("./app");
const setupWebSocket = require("./services/websocket.service");
require("dotenv").config();

const server = http.createServer(app);
setupWebSocket(server);

server.listen(process.env.PORT, () => {
  console.log(`🚀 Backend running on port ${process.env.PORT}`);
});
