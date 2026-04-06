import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import stocksRouter from "./stocks.js";
import portfolioRouter from "./portfolio.js";
import adminRouter from "./admin.js";
import ibRouter from "./ib.js";
import metalRouter from "./metal.js";
import newsRouter from "./news.js";
import featuresRouter from "./features.js";
import transferRouter from "./transfer.js";
import { authMiddleware, adminMiddleware } from "../lib/auth.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

router.use(healthRouter);
router.use(authRouter);
router.use(stocksRouter);
router.use(portfolioRouter);
router.use("/admin", authMiddleware, adminMiddleware, adminRouter);
router.use(ibRouter);
router.use(metalRouter);
router.use(newsRouter);
router.use(featuresRouter);
router.use(transferRouter);

// Generic private file server (identity + receipt) — GCS /objects/ or legacy /tmp/ paths
async function servePrivateFile(objectPath: string, res: any) {
  if (!objectPath) return res.status(400).json({ error: "path param required" });
  try {
    if (objectPath.startsWith("/objects/")) {
      const objectFile = await objectStorage.getObjectEntityFile(objectPath);
      const response = await objectStorage.downloadObject(objectFile);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      const filename = path.basename(objectPath);
      const filePath = path.join("/tmp/uploads", filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not Found" });
      const buf = fs.readFileSync(filePath);
      let contentType = "application/octet-stream";
      if (buf[0] === 0xff && buf[1] === 0xd8) contentType = "image/jpeg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
      else if (buf[0] === 0x52 && buf[1] === 0x49) contentType = "image/webp";
      else if (buf[0] === 0x25 && buf[1] === 0x50) contentType = "application/pdf";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buf);
    }
  } catch (e: any) {
    res.status(404).json({ error: "Not Found", message: e.message });
  }
}

// Public image endpoint — for campaign and expert-picks images (no auth required)
router.get("/image", async (req, res) => {
  const objectPath = req.query.path as string;
  const allowedPrefixes = ["/objects/campaign/", "/objects/expert-picks/"];
  if (!objectPath || !allowedPrefixes.some(p => objectPath.startsWith(p))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await servePrivateFile(objectPath, res);
});

// Serve identity images
router.get("/admin/identity-image", authMiddleware, adminMiddleware, async (req, res) => {
  await servePrivateFile(req.query.path as string, res);
});

// Serve deposit receipts
router.get("/admin/receipt-image", authMiddleware, adminMiddleware, async (req, res) => {
  await servePrivateFile(req.query.path as string, res);
});

export default router;
