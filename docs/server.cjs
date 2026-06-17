var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var DATA_DIR = import_path.default.join(process.cwd(), "data");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.post("/api/dataset", (req, res) => {
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const filePath = import_path.default.join(DATA_DIR, `${id}.json`);
      import_fs.default.writeFileSync(filePath, JSON.stringify(req.body));
      res.json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save dataset" });
    }
  });
  app.get("/api/dataset/:id", (req, res) => {
    try {
      const { id } = req.params;
      const filePath = import_path.default.join(DATA_DIR, `${id}.json`);
      if (import_fs.default.existsSync(filePath)) {
        const data = import_fs.default.readFileSync(filePath, "utf-8");
        res.json(JSON.parse(data));
      } else {
        res.status(404).json({ error: "Dataset not found" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to read dataset" });
    }
  });
  const isProd = process.env.NODE_ENV === "production" || import_fs.default.existsSync(import_path.default.join(process.cwd(), "docs", "index.html"));
  console.log(`Server starting in ${isProd ? "production" : "development"} mode`);
  if (!isProd) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
      // Back to spa for simpler dev mode if it works
    });
    app.use(vite.middlewares);
  } else {
    const docsPath = import_path.default.join(process.cwd(), "docs");
    app.use(import_express.default.static(docsPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(docsPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
