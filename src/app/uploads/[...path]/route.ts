import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.env.UPLOAD_ROOT || path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (rel.includes("..")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  const file = path.join(ROOT, rel);
  try {
    const buf = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const type =
      ext === ".webp"
        ? "image/webp"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
            ? "image/png"
            : "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
