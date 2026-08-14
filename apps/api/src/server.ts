import { createServer } from "node:http";

import { handleRequest } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, host, () => {
  console.info(`Event Edge API listening on http://${host}:${port}`);
});
