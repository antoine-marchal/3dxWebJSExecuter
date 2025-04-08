const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.json(global.whoamiData || { error: "Data not fetched yet" });
});

module.exports = router;
