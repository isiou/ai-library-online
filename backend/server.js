const path = require("path");
const express = require("express");
const app = require("./src/app");

const publicDir = path.join(__dirname, "public");
const staticApp = express();
staticApp.use(express.static(publicDir));

staticApp.use(app);

const PORT = process.env.PORT || 3000;

staticApp.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
