const db = require("../db/index");

const { v4: uuid } = require("uuid");

module.exports = async function checkAlerts(vehicle_id, data, io) {
  const alerts = [];

  if (data.soc < 10)
    alerts.push({ type: "CRITICAL_BATTERY", severity: "CRITICAL", msg: "Battery < 10%" });

  if (data.motor_temp > 100)
    alerts.push({ type: "CRITICAL_TEMP", severity: "CRITICAL", msg: "Motor overheating" });

  for (let a of alerts) {
    await db.query(
      "INSERT INTO alerts(alert_id, vehicle_id, alert_type, severity, message) VALUES($1,$2,$3,$4,$5)",
      [uuid(), vehicle_id, a.type, a.severity, a.msg]
    );

    io.emit("new_alert", { vehicle_id, ...a });
  }
};
