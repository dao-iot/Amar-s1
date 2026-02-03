const express = require("express");
const router = express.Router();
const handleTelemetry = require("../services/telemetry.service");
const { getIO } = require("../services/websocket.service");

router.post("/", async (req, res) => {
  try {
    await handleTelemetry(req.body, getIO());
    res.json({ status: "telemetry stored" });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

module.exports = router;
