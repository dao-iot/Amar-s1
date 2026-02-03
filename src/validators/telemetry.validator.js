module.exports = function validateTelemetry(data) {
  const errors = [];

  if (data.speed < 0 || data.speed > 120) errors.push("Invalid speed");
  if (data.soc < 0 || data.soc > 100) errors.push("Invalid SOC");
  if (data.battery_voltage < 40 || data.battery_voltage > 85)
    errors.push("Invalid voltage");

  return errors;
};
