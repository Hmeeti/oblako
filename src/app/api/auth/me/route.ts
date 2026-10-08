import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      memberships,
    },
  });
}
