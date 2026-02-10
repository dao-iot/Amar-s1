const db = require("../db/index");

const validateTelemetry = require("../validators/telemetry.validator");
const checkAlerts = require("./alert.service");

module.exports = async function handleTelemetry(payload, io) {
  const { vehicle_id, timestamp, data } = payload;

  const errors = validateTelemetry(data);
  if (errors.length) throw errors;

  await db.query(
    "INSERT INTO telemetry(vehicle_id, timestamp, data) VALUES($1,$2,$3)",
    [vehicle_id, timestamp, data]
  );

  io.emit("telemetry_update", { vehicle_id, data, timestamp });

  await checkAlerts(vehicle_id, data, io);
};
