import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { getLead, updateLead } from "@/server/repositories/leads";
import { createProject } from "@/server/repositories/projects";
import { slugify } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  assertCan(user, "lead:convert");
  const { id } = await ctx.params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (lead.convertedProjectId) {
    return NextResponse.json({ projectId: lead.convertedProjectId });
  }

  const base = slugify(lead.venueName || lead.name) || "venue";
  let slug = base;
  let n = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const project = await createProject({
    name: lead.venueName || `${lead.name} — меню`,
    slug,
    ownerId: user!.id,
    status: "draft",
  });

  await prisma.qrCode.create({
    data: {
      code: nanoid(8),
      projectId: project.id,
      label: "Общий QR",
    },
  });

  await updateLead(id, {
    status: "won",
    convertedProjectId: project.id,
  });

  await prisma.auditLog.create({
    data: {
      projectId: project.id,
      userId: user!.id,
      action: "lead.convert",
      meta: { leadId: id },
    },
  });

  return NextResponse.json({ projectId: project.id, slug: project.slug });
}
