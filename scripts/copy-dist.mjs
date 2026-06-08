import fs from "node:fs";
import path from "node:path";

const src = path.resolve("client/dist");
const dest = path.resolve("dist");

try {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log("Successfully copied client/dist to root dist for Hostinger deployment.");
} catch (err) {
  console.error("Failed to copy client/dist to root dist:", err);
  process.exit(1);
}
