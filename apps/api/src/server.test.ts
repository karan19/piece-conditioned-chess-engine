import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./server.js";

let baseUrl = "";
const server = createServer(app);

describe("server routes", () => {
  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP address.");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("serves health checks with and without the deployment API prefix", async () => {
    const direct = await fetch(`${baseUrl}/health`);
    const prefixed = await fetch(`${baseUrl}/api/health`);

    await expect(direct.json()).resolves.toMatchObject({ status: "ok" });
    await expect(prefixed.json()).resolves.toMatchObject({ status: "ok" });
  });
});
