import { NextResponse } from "next/server";
import { z } from "zod";
import { createLead, listLeads } from "@/server/repositories/leads";
import { notifyStudioTelegram } from "@/server/telegram";
import { publishStudioEvent } from "@/server/events";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";

const leadSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(8).max(32),
  contactMethod: z.enum(["whatsapp", "telegram", "call"]),
  venueName: z.string().max(160).optional(),
  venueType: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
  consent: z.literal(true),
  website: z.string().max(0).optional(), // honeypot
  source: z.record(z.string(), z.string()).optional(),
});

function normalizeKzPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8") && digits.length === 11) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.startsWith("7") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("7") && digits.length === 10) {
    return `+7${digits}`;
  }
  return phone.trim();
}

async function checkRateLimit(key: string, limit: number) {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const row = await prisma.leadRateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count <= limit;
}

export async function GET() {
  const user = await getSessionUser();
  assertCan(user, "lead:read");
  const leads = await listLeads();
  return NextResponse.json({ leads });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }); // silent honeypot
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const phone = normalizeKzPhone(parsed.data.phone);
  const okIp = await checkRateLimit(`ip:${ip}`, 8);
  const okPhone = await checkRateLimit(`phone:${phone}`, 3);
  if (!okIp || !okPhone) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const lead = await createLead({
    name: parsed.data.name.trim(),
    phone,
    contactMethod: parsed.data.contactMethod,
    venueName: parsed.data.venueName?.trim(),
    venueType: parsed.data.venueType?.trim(),
    city: parsed.data.city?.trim(),
    message: parsed.data.message?.trim(),
    source: parsed.data.source,
    consentAt: new Date(),
  });

  publishStudioEvent("lead:new", { id: lead.id, name: lead.name });
  await notifyStudioTelegram(
    `Новая заявка Stolio\n${lead.name} · ${lead.phone}\n${lead.venueName ?? "—"}\n${lead.city ?? ""}`,
  );

  return NextResponse.json({ ok: true, id: lead.id });
}
