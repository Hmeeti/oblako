import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const COOKIE = "stolio_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, meta?: {
  ipHash?: string;
  userAgent?: string;
}) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_SEC * 1000);
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt,
      ipHash: meta?.ipHash,
      userAgent: meta?.userAgent?.slice(0, 300),
    },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  }
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }
  return session.user;
}

export { COOKIE as SESSION_COOKIE };
