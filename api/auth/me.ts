import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendError, methodNotAllowed } from "../_lib/http.js";
import { getSessionUser } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(res, ["GET"]);
      return;
    }
    const user = await getSessionUser(req);
    res.status(200).json(user);
  } catch (err) {
    sendError(res, err);
  }
}
