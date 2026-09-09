import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendError, methodNotAllowed } from "../_lib/http.js";
import { destroySessionForRequest, clearSessionCookie } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      methodNotAllowed(res, ["POST"]);
      return;
    }
    await destroySessionForRequest(req);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
}
