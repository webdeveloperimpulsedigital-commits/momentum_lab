import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { ZodError } from "zod";
import multer from "multer";
import { apiRouter } from "./routes.js";
import { config, runtimeStatus } from "./config.js";
import { LlmError } from "./llm.js";

const app = express();

app.use(
  cors({
    origin: config.appBaseUrl,
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Momentum Lab",
    ...runtimeStatus
  });
});

app.use("/api", apiRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: error.code === "LIMIT_FILE_SIZE" ? "File exceeds 25 MB limit" : error.message
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  if (error instanceof LlmError) {
    const status = error.message.includes("rate limit")
      ? 429
      : error.message.includes("not configured") ||
          error.message.includes("Unsupported") ||
          error.message.includes("rejected")
        ? 503
        : error.message.includes("timed out")
          ? 504
          : 502;
    res.status(status).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`Momentum Lab API running on http://localhost:${config.port}`);
});
