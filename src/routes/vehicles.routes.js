const express = require("express");
const router = express.Router();
const db = require("../db/index");


router.post("/", async (req, res) => {
  const { vehicle_id, model, registration_number } = req.body;

  await db.query(
    "INSERT INTO vehicles(vehicle_id, model, registration_number) VALUES($1,$2,$3)",
    [vehicle_id, model, registration_number]
  );

  res.json({ status: "vehicle registered" });
});

router.get("/", async (_, res) => {
  const result = await db.query("SELECT * FROM vehicles");
  res.json(result.rows);
});

router.get("/:id", async (req, res) => {
  const result = await db.query(
    "SELECT * FROM vehicles WHERE vehicle_id=$1",
    [req.params.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;
