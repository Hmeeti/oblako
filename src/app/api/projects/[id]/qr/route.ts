import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { nanoid } from "nanoid";
import { getSessionUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/can";
import { prisma } from "@/lib/db";
import { brand } from "@/config/brand";

async function auth() {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true, role: true },
  });
  return { ...user, memberships };
}

function qrUrl(code: string) {
  const domain = process.env.NEXT_PUBLIC_APP_URL || `https://${brand.domain}`;
  return `${domain.replace(/\/$/, "")}/q/${code}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "qr:manage", { projectId: id });
  const codes = await prisma.qrCode.findMany({
    where: { projectId: id },
    orderBy: [{ tableNumber: "asc" }, { createdAt: "asc" }],
  });
  const format = new URL(req.url).searchParams.get("format");
  if (!format) return NextResponse.json({ codes });

  if (format === "zip") {
    const zip = new JSZip();
    for (const row of codes) {
      const svg = await QRCode.toString(qrUrl(row.code), {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 2,
      });
      const png = await QRCode.toBuffer(qrUrl(row.code), {
        type: "png",
        errorCorrectionLevel: "H",
        width: 1024,
        margin: 2,
      });
      const label = row.label || `table-${row.tableNumber ?? row.code}`;
      zip.file(`${label}.svg`, svg);
      zip.file(`${label}.png`, png);
    }
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="qr-${id}.zip"`,
      },
    });
  }

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage([595.28, 841.89]); // A4
    const cols = 2;
    const rows = 3;
    const cellW = 250;
    const cellH = 240;
    const marginX = 40;
    const marginY = 40;
    let i = 0;
    for (const row of codes) {
      if (i > 0 && i % (cols * rows) === 0) {
        page = pdf.addPage([595.28, 841.89]);
      }
      const idx = i % (cols * rows);
      const col = idx % cols;
      const r = Math.floor(idx / cols);
      const x = marginX + col * (cellW + 20);
      const y = 841.89 - marginY - (r + 1) * cellH;
      const png = await QRCode.toBuffer(qrUrl(row.code), {
        type: "png",
        errorCorrectionLevel: "H",
        width: 512,
        margin: 1,
      });
      const img = await pdf.embedPng(png);
      page.drawRectangle({
        x,
        y,
        width: cellW,
        height: cellH - 10,
        borderColor: rgb(0.1, 0.1, 0.1),
        borderWidth: 0.5,
      });
      page.drawImage(img, { x: x + 45, y: y + 50, width: 160, height: 160 });
      page.drawText(row.label || `Стол ${row.tableNumber ?? ""}`, {
        x: x + 20,
        y: y + 20,
        size: 12,
        font,
      });
      page.drawText("Сканируй меню", {
        x: x + 20,
        y: y + cellH - 30,
        size: 10,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      i += 1;
    }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qr-${id}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "bad_format" }, { status: 400 });
}

const createSchema = z.object({
  from: z.number().int().min(1).max(200).optional(),
  to: z.number().int().min(1).max(200).optional(),
  label: z.string().max(80).optional(),
  tableNumber: z.number().int().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await auth();
  assertCan(user, "qr:manage", { projectId: id });
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const created = [];
  if (parsed.data.from && parsed.data.to && parsed.data.to >= parsed.data.from) {
    for (let n = parsed.data.from; n <= parsed.data.to; n += 1) {
      const row = await prisma.qrCode.create({
        data: {
          code: nanoid(8),
          projectId: id,
          tableNumber: n,
          label: `Стол ${n}`,
          style: { frame: true, callToAction: "Сканируй меню" },
        },
      });
      created.push(row);
    }
  } else {
    const row = await prisma.qrCode.create({
      data: {
        code: nanoid(8),
        projectId: id,
        tableNumber: parsed.data.tableNumber,
        label: parsed.data.label || "QR",
      },
    });
    created.push(row);
  }
  return NextResponse.json({ codes: created });
}
