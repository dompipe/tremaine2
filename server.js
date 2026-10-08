import http from "http";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname);
const port = process.env.PORT || 4173;
const onlineFile = path.resolve(process.env.ONLINE_PLAYERS_FILE || path.join(root, "online_players.json"));
const onlineTtlSeconds = 90;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readOnlinePlayers() {
  try {
    const decoded = JSON.parse(fs.readFileSync(onlineFile, "utf8"));
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? decoded
      : {};
  } catch {
    return {};
  }
}

function handleOnlinePresence(req, res, parsedUrl) {
  const id = String(parsedUrl.query?.id || "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 96);

  if (!id) {
    sendJson(res, 200, { playersOnline: 1 });
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  const players = readOnlinePlayers();
  players[id] = now;

  for (const [playerId, lastSeen] of Object.entries(players)) {
    const seenAt = Number(lastSeen);
    if (!Number.isFinite(seenAt) || now - seenAt > onlineTtlSeconds) {
      delete players[playerId];
    }
  }

  try {
    fs.writeFileSync(onlineFile, JSON.stringify(players), "utf8");
  } catch {
    sendJson(res, 500, { playersOnline: Math.max(1, Object.keys(players).length), error: "presence_write_failed" });
    return true;
  }

  sendJson(res, 200, { playersOnline: Math.max(1, Object.keys(players).length) });
  return true;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let reqUrl = decodeURIComponent(parsedUrl.pathname || "/");
  let filePath;

  if (reqUrl === "/online.php" || reqUrl === "/client/online.php") {
    handleOnlinePresence(req, res, parsedUrl);
    return;
  }

  if (reqUrl === "/t") {
    reqUrl = "/";
  } else if (reqUrl.startsWith("/t/")) {
    reqUrl = reqUrl.slice(2) || "/";
  }

  if (reqUrl === "/") {
    filePath = path.join(root, "index.html");
  } else {
    filePath = path.resolve(root, `.${reqUrl}`);
  }

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        res.end("Server error");
        return;
      }

      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Open the browser to play.");
});
