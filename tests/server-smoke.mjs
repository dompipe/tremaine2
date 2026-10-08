import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 4197;
const baseUrl = `http://127.0.0.1:${port}`;
const onlinePlayersFile = join(tmpdir(), `tremaine-online-${process.pid}.json`);

const server = spawn(
  process.execPath,
  ["server.js"],
  {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), ONLINE_PLAYERS_FILE: onlinePlayersFile },
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const tick = async () => {
      if (Date.now() > deadline) {
        reject(new Error(`server did not start:\n${output}`));
        return;
      }

      try {
        const response = await fetch(`${baseUrl}/`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch { }

      setTimeout(tick, 100);
    };
    tick();
  });
}

try {
  await waitForServer();

  const tPage = await fetch(`${baseUrl}/t/`);
  assert.equal(tPage.status, 200);
  assert.match(await tPage.text(), /Tremaine Dungeon Card Engine/);

  const tModule = await fetch(`${baseUrl}/t/main.js`);
  assert.equal(tModule.status, 200);
  assert.match(tModule.headers.get("content-type") || "", /javascript/);

  const firstPresence = await fetch(`${baseUrl}/online.php?id=smoke-a&t=${Date.now()}`);
  assert.equal(firstPresence.status, 200);
  assert.deepEqual(await firstPresence.json(), { playersOnline: 1 });

  const secondPresence = await fetch(`${baseUrl}/online.php?id=smoke-b&t=${Date.now()}`);
  assert.equal(secondPresence.status, 200);
  assert.deepEqual(await secondPresence.json(), { playersOnline: 2 });

  const clientPresence = await fetch(`${baseUrl}/client/online.php?id=smoke-c&t=${Date.now()}`);
  assert.equal(clientPresence.status, 200);
  assert.deepEqual(await clientPresence.json(), { playersOnline: 3 });

  console.log("server smoke passed");
} finally {
  server.kill();
  await rm(onlinePlayersFile, { force: true });
}
