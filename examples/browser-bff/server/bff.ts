// Copyright © 2026 Mcont.

import { createServer } from "node:http";

/**
 * Application BFF process.
 *
 * The vendor credential is read from the server environment when a browser
 * request arrives. It is not written into the response, and this module is not
 * a Vite input.
 */
const server = createServer((request, response) => {
  const vendorCredential = process.env["VENDOR_API_KEY"];
  if (vendorCredential === undefined || vendorCredential.length === 0) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("The BFF is missing its server credential.");
    return;
  }

  if (request.url !== "/bff/chat/completions") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end('{"ok":true}');
});

server.listen(8787, "127.0.0.1");
