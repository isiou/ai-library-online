const express = require("express");
const cors = require("cors");
const session = require("express-session");
const config = require("./config");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./openapi.json");
const aiAssistantRoutes = require("./routes/ai-assistant");
const aiAdminRoutes = require("./routes/ai-admin");
const authRoutes = require("./routes/auth");
const borrowsRoutes = require("./routes/borrows");
const accountRoutes = require("./routes/account");
const recommendationsRoutes = require("./routes/recommendations");
const adminRoutes = require("./routes/admin");
const booksRoutes = require("./routes/books");
const dataManagementRoutes = require("./routes/data-management");

const app = express();

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5137"
).split(",");
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(session(config.session));

// 添加 session 调试中间件
app.use((req, res, next) => {
  // 调试占位
  next();
});

// Swagger UI 文档
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

// 原始 OpenAPI JSON
app.get("/docs/openapi.json", (req, res) => {
  res.json(openapiSpec);
});

// Routes
app.get("/", (req, res) => {
  res.send("Welcome Backend API.");
});
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/ai-admin", aiAdminRoutes);
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/borrows", borrowsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/books", booksRoutes);
app.use("/api/data-management", dataManagementRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

module.exports = app;
