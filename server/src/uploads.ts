import path from "node:path";
import multer from "multer";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const allowedExtensions = new Set([
  ".txt",
  ".md",
  ".pdf",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp"
]);

const allowedMimeTypes = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp"
]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

export function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const ext = parsed.ext.toLowerCase();
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${base || "source-file"}${ext}`;
}

export function validateUploadFile(file?: Express.Multer.File) {
  if (!file) return "File is required";

  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    return "File type is not allowed";
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return "MIME type is not allowed";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "File exceeds 25 MB limit";
  }

  return null;
}
