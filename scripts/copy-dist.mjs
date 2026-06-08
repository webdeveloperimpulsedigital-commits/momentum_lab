import fs from "node:fs";
import path from "node:path";

const src = path.resolve("client/dist");
const destinations = [
  path.resolve("dist"),
  path.resolve("server/dist/dist")
];

try {
  for (const dest of destinations) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.cpSync(src, dest, { recursive: true });
  }
  console.log("Successfully copied client/dist to deployment output folders.");
} catch (err) {
  console.error("Failed to copy client/dist to deployment output folders:", err);
  process.exit(1);
}
