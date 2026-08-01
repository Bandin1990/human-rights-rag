const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const ollamaDir = path.join(projectRoot, ".tools", "ollama");
const ollamaExe = path.join(ollamaDir, "ollama.exe");
const ollamaHome = path.join(projectRoot, ".tools", "ollama-home");
const ollamaModels = path.join(projectRoot, ".tools", "ollama-models");

if (!fs.existsSync(ollamaExe)) {
  console.error(`Ollama portable not found at ${ollamaExe}`);
  process.exit(1);
}

fs.mkdirSync(ollamaHome, { recursive: true });
fs.mkdirSync(ollamaModels, { recursive: true });

const env = {
  ...process.env,
  USERPROFILE: ollamaHome,
  HOME: ollamaHome,
  OLLAMA_MODELS: ollamaModels,
  Path: `${path.join(ollamaDir, "lib", "ollama")};${ollamaDir};${process.env.Path || process.env.PATH || ""}`,
};

const serverCmd = path.join(projectRoot, "scripts", "ollama_server.cmd");

const child = spawn("cmd.exe", ["/d", "/s", "/c", serverCmd], {
  cwd: projectRoot,
  detached: true,
  stdio: "ignore",
  env,
  windowsHide: true,
});

child.unref();
console.log("Ollama server starting at http://localhost:11434");
