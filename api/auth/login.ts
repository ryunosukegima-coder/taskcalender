import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_lib/prisma.js";
import { sendError, methodNotAllowed, readJsonBody, ApiError } from "../_lib/http.js";
import { createSession, verifyPassword, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      methodNotAllowed(res, ["POST"]);
      return;
    }

    const body = readJsonBody<{ email?: unknown; password?: unknown }>(req);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "メールアドレスまたはパスワードが正しくありません",
      );
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(200).json({ id: user.id, email: user.email });
  } catch (err) {
    sendError(res, err);
  }
}
