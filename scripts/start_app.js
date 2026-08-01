const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const serverCmd = path.join(projectRoot, "scripts", "streamlit_server.cmd");

const child = spawn("cmd.exe", ["/d", "/s", "/c", serverCmd], {
  cwd: projectRoot,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});

child.unref();
console.log("Streamlit starting at http://127.0.0.1:8501");
