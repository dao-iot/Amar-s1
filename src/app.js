const express = require("express");
const cors = require("cors");

const vehicleRoutes = require("./routes/vehicles.routes");
const telemetryRoutes = require("./routes/telemetry.routes");
const alertRoutes = require("./routes/alerts.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/vehicles", vehicleRoutes);
app.use("/api/v1/telemetry", telemetryRoutes);
app.use("/api/v1/alerts", alertRoutes);

module.exports = app;
