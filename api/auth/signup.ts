import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_lib/prisma.js";
import { sendError, methodNotAllowed, readJsonBody, ApiError } from "../_lib/http.js";
import { createSession, hashPassword, setSessionCookie } from "../_lib/auth.js";
import { validateEmail, validatePassword } from "../../shared/validation.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      methodNotAllowed(res, ["POST"]);
      return;
    }

    const body = readJsonBody<{ email?: unknown; password?: unknown }>(req);
    const email = validateEmail(typeof body.email === "string" ? body.email : "");
    const password = validatePassword(typeof body.password === "string" ? body.password : "");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, "EMAIL_TAKEN", "このメールアドレスは既に登録されています");
    }

    const passwordHash = hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, passwordHash } });

      // The very first account ever created adopts any pre-auth data (rows
      // created before login existed), so nothing from the shared-URL era
      // is lost when auth is introduced.
      const userCount = await tx.user.count();
      if (userCount === 1) {
        await tx.task.updateMany({ where: { userId: null }, data: { userId: created.id } });
        await tx.operationHistory.updateMany({
          where: { userId: null },
          data: { userId: created.id },
        });
        await tx.appSettings.updateMany({
          where: { userId: null },
          data: { userId: created.id },
        });
      }

      return created;
    });

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    sendError(res, err);
  }
}
