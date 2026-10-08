import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const attempts = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, limit = 10, windowMs = 15 * 60_000) {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.reset < now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}`)) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  await createSession(user.id, {
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
    },
  });
}
