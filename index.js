// Momentum Lab Hostinger Node.js Startup File
// This file serves as the entry point in Hostinger hPanel. It imports the compiled server build.

import("./server/dist/index.js").catch((err) => {
  console.error("Failed to start Momentum Lab server:", err);
  process.exit(1);
});
