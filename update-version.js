const fs = require("fs");
const { execSync } = require("child_process");

const gitDate = execSync('git log -1 --format=%cd --date=iso').toString().trim();
const date = new Date(gitDate);
const pad = (n) => n.toString().padStart(2, "0");
const version = "v." +
  date.getFullYear() +
  pad(date.getMonth() + 1) +
  pad(date.getDate()) +"."+
  pad(date.getHours()) +
  pad(date.getMinutes());

const newJson = JSON.stringify({ version }, null, 2);

// Leer versión actual
let currentJson = "";
if (fs.existsSync("version.json")) {
  currentJson = fs.readFileSync("version.json", "utf8");
}

// Escribir solo si cambia
if (currentJson !== newJson) {
  fs.writeFileSync("version.json", newJson);
  console.log("version.json actualizado:", version);
} else {
  console.log("version.json ya actualizado:", version);
}