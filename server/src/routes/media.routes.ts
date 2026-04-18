/**
 * Media serving route (mounted at /api/media)
 *   GET /api/media/:filename — stream stored audio/video file
 */
import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";

const router = Router();
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

router.get("/:filename", (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Media file not found" });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();

  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";

  // Support range requests for audio/video scrubbing
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;
