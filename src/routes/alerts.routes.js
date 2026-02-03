const express = require("express");
const router = express.Router();
const db = require("../db/index");


router.get("/", async (_, res) => {
  const result = await db.query("SELECT * FROM alerts");
  res.json(result.rows);
});

router.post("/:id/acknowledge", async (req, res) => {
  await db.query(
    "UPDATE alerts SET acknowledged_at=NOW() WHERE alert_id=$1",
    [req.params.id]
  );
  res.json({ status: "acknowledged" });
});

module.exports = router;
