require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const riotRoutes = require("./routes/riot");
const databaseRoutes = require("./routes/database");
const { testConnection } = require("./utils/database");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;
    console.log(
      `[Proxy] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`,
    );

    if (req.url.startsWith("/api/db") && req.method === "GET") {
      const responseStr =
        typeof data === "string" ? data : JSON.stringify(data);
      const truncated =
        responseStr.length > 300
          ? responseStr.slice(0, 300) + "..."
          : responseStr;
      console.log(`[Proxy] Response: ${truncated}`);
    }

    return originalSend.call(this, data);
  };

  next();
});

app.use("/api", riotRoutes);
app.use("/api/db", databaseRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("Error:", err);

  const statusCode = err.statusCode || err.response?.status || 500;
  const message = err.message || "Internal server error";
  const data = err.response?.data || null;

  res.status(statusCode).json({
    error: message,
    statusCode,
    ...(data && { details: data }),
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    statusCode: 404,
    path: req.path,
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Diana Proxy Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log(`✅ Database connection successful`);
  } else {
    console.log(
      `⚠️  Database connection failed - database endpoints will not work`,
    );
  }
});

module.exports = app;
