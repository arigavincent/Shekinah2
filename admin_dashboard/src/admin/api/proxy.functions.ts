import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BACKEND_BASE_URL = "https://shekinah-sons-backend.onrender.com";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const proxyInputSchema = z.object({
  path: z.string().startsWith("/api/"),
  method: z.string().optional(),
  token: z.string().nullable().optional(),
  body: z.unknown().optional(),
});

export const proxyAdminApiRequest = createServerFn({ method: "POST" })
  .validator(proxyInputSchema)
  .handler(async ({ data }) => {
    const method = data.method || "GET";
    const response = await fetch(`${BACKEND_BASE_URL}${data.path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
      },
      body: data.body ? JSON.stringify(data.body) : undefined,
    });

    const text = await response.text();
    const payload: JsonValue = text
      ? (() => {
          try {
            return JSON.parse(text) as JsonValue;
          } catch {
            return { message: text };
          }
        })()
      : null;

    return {
      ok: response.ok,
      status: response.status,
      payload,
    };
  });
