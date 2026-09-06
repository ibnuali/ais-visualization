import { expect, test } from "bun:test";
import { createApiClient } from "./index.ts";

test("normalizes the origin and builds API URLs", () => {
  const client = createApiClient({
    origin: " https://api.example.test///",
    fetchImpl: async () => new Response(JSON.stringify({})),
  });

  expect(client.getApiUrl("/api/worker")).toBe(
    "https://api.example.test/api/worker",
  );
});

test("sends request options and returns JSON payloads", async () => {
  const requests: Array<{ options?: RequestInit; url: RequestInfo | URL }> = [];
  const client = createApiClient({
    origin: "https://api.example.test",
    fetchImpl: async (url, options) => {
      requests.push({ options, url });
      return new Response(JSON.stringify({ is_enabled: true }));
    },
  });

  const payload = await client.requestJson("/api/worker", {
    headers: { "X-Worker-Control-Token": "token" },
    method: "POST",
  });

  expect(payload).toEqual({ is_enabled: true });
  expect(requests).toEqual([
    {
      options: {
        credentials: "include",
        headers: { "X-Worker-Control-Token": "token" },
        method: "POST",
      },
      url: "https://api.example.test/api/worker",
    },
  ]);
});

test("uses API error payloads when requests fail", () => {
  const client = createApiClient({
    origin: "https://api.example.test",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ error: "Worker control is unauthorized" }),
        {
          status: 401,
        },
      ),
  });

  return expect(client.requestJson("/api/worker/start")).rejects.toThrow(
    "Worker control is unauthorized",
  );
});
