import { prisma } from "@/lib/db";
import type { ContactMethod, LeadStatus, Prisma } from "@prisma/client";

export async function createLead(input: {
  name: string;
  phone: string;
  contactMethod: ContactMethod;
  venueName?: string;
  venueType?: string;
  city?: string;
  message?: string;
  files?: Prisma.InputJsonValue;
  source?: Prisma.InputJsonValue;
  consentAt: Date;
}) {
  return prisma.lead.create({
    data: {
      name: input.name,
      phone: input.phone,
      contactMethod: input.contactMethod,
      venueName: input.venueName,
      venueType: input.venueType,
      city: input.city,
      message: input.message,
      files: input.files ?? [],
      source: input.source ?? {},
      consentAt: input.consentAt,
    },
  });
}

export async function listLeads() {
  return prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
}

export async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: { assignedTo: true, convertedProject: true },
  });
}

export async function updateLead(
  id: string,
  data: {
    status?: LeadStatus;
    notes?: string;
    assignedToId?: string | null;
    convertedProjectId?: string | null;
  },
) {
  return prisma.lead.update({ where: { id }, data });
}
