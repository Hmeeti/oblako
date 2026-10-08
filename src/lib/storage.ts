import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";

export interface StorageProvider {
  saveImage(
    buffer: Buffer,
    opts?: { prefix?: string },
  ): Promise<{ id: string; paths: Record<string, string> }>;
  resolvePublicUrl(rel: string): string;
}

const ROOT = process.env.UPLOAD_ROOT || path.join(process.cwd(), "data", "uploads");

export class LocalStorageProvider implements StorageProvider {
  async saveImage(buffer: Buffer, opts?: { prefix?: string }) {
    const id = randomBytes(16).toString("hex");
    const dir = path.join(ROOT, opts?.prefix ?? "images", id);
    await fs.mkdir(dir, { recursive: true });

    const base = sharp(buffer).rotate().withMetadata({ orientation: undefined });
    const sizes = [480, 960, 1600] as const;
    const paths: Record<string, string> = {};

    for (const w of sizes) {
      const webpRel = path.join(opts?.prefix ?? "images", id, `${w}.webp`);
      const jpgRel = path.join(opts?.prefix ?? "images", id, `${w}.jpg`);
      await base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(ROOT, webpRel));
      await base
        .clone()
        .resize({ width: w, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(ROOT, jpgRel));
      paths[`w${w}_webp`] = webpRel;
      paths[`w${w}_jpg`] = jpgRel;
    }

    return { id, paths };
  }

  resolvePublicUrl(rel: string) {
    return `/uploads/${rel.replace(/\\/g, "/")}`;
  }
}

export const storage: StorageProvider = new LocalStorageProvider();
