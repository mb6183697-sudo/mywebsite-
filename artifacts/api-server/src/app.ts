import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes/index.js";

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

const SENSITIVE_PATHS = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/change-password"]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const bodyStr = SENSITIVE_PATHS.has(req.path) ? "[REDACTED]" : req.body ? JSON.stringify(req.body).slice(0, 100) : "";
    console.log(`${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms) body=${bodyStr}`);
  });
  next();
});

app.use("/api", router);

export default app;
