const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

http.createServer((request, response) => {
  const pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": `${mime[path.extname(file)] || "application/octet-stream"}; charset=utf-8` });
  fs.createReadStream(file).pipe(response);
}).listen(8765, "127.0.0.1");
