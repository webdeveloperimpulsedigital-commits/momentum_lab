import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ExtractionResult {
  status: "processed" | "unsupported" | "failed";
  text: string;
  method: string;
  detectedType: string;
  safeError: string | null;
}

export function cleanText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

export function wordCount(text: string) {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function chunkText(text: string, size = 2000, overlap = 150) {
  const clean = cleanText(text);
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end).trim());
    if (end === clean.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks.filter(Boolean);
}

export async function extractSourceText(input: {
  sourceType: string;
  contentText?: string | null;
  fileBuffer?: Buffer;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<ExtractionResult> {
  try {
    if (input.contentText?.trim()) {
      return {
        status: "processed",
        text: cleanText(input.contentText),
        method: "pasted_text",
        detectedType: input.sourceType,
        safeError: null
      };
    }

    if (input.sourceType === "url") {
      return unsupported("URL scraping is not implemented yet", "url_metadata");
    }

    if (["image", "png", "jpg", "jpeg", "webp"].includes(input.sourceType)) {
      return unsupported("Image OCR is not implemented", "image_metadata");
    }

    if (!input.fileBuffer) {
      return unsupported("No file or pasted text is available for extraction", input.sourceType);
    }

    if (input.sourceType === "text" || input.mimeType === "text/plain") {
      return processed(input.fileBuffer.toString("utf8"), "plain_text", "text");
    }

    if (input.sourceType === "markdown" || input.mimeType === "text/markdown") {
      return processed(input.fileBuffer.toString("utf8"), "markdown_text", "markdown");
    }

    if (
      input.sourceType === "docx" ||
      input.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer: input.fileBuffer });
      return processed(result.value, "mammoth_docx", "docx");
    }

    if (input.sourceType === "pdf" || input.mimeType === "application/pdf") {
      const parser = new PDFParse({ data: input.fileBuffer });
      const result = await parser.getText();
      await parser.destroy();
      return processed(result.text, "pdf_parse", "pdf");
    }

    return unsupported("This source type is not supported for text extraction", input.sourceType);
  } catch {
    return {
      status: "failed",
      text: "",
      method: "unknown",
      detectedType: input.sourceType,
      safeError: "Text extraction failed for this source"
    };
  }
}

function processed(text: string, method: string, detectedType: string): ExtractionResult {
  return {
    status: "processed",
    text: cleanText(text),
    method,
    detectedType,
    safeError: null
  };
}

function unsupported(reason: string, detectedType: string): ExtractionResult {
  return {
    status: "unsupported",
    text: "",
    method: "unsupported",
    detectedType,
    safeError: reason
  };
}
