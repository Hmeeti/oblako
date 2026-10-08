import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

type SeedItem = {
  id: string;
  cat: string;
  name: string;
  price: number | null;
  desc?: string;
  volume?: string;
  noPhoto?: boolean;
};

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@stolio.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMeNow123!";
  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Studio Admin",
      passwordHash: await hashPassword(password),
      platformRole: "studio_admin",
    },
    update: {},
  });

  const menuPath = path.join(process.cwd(), "seed/parkavenue/menu.json");
  const raw = JSON.parse(await fs.readFile(menuPath, "utf8")) as {
    categories: string[];
    items: SeedItem[];
  };

  const project = await prisma.project.upsert({
    where: { slug: "park-avenue" },
    create: {
      name: "Park Avenue Hotel & Cafe",
      slug: "park-avenue",
      status: "live",
      demo: true,
      themeId: "classic-green",
      serviceChargePercent: 15,
      ownerId: admin.id,
      features: {
        billCalculator: true,
        search: true,
        languages: true,
        gallery: true,
        waiters: false,
        hideBranding: false,
        indexable: false,
      },
      contacts: { note: "TODO: подтвердить контакты с владельцем заведения" },
      allergyNote: {
        ru: "Сообщите аллергии официанту.",
        kk: "Аллергия туралы даяшыға айтыңыз.",
        en: "Please tell staff about allergies.",
      },
    },
    update: {
      status: "live",
      demo: true,
    },
  });

  await prisma.item.deleteMany({ where: { projectId: project.id } });
  await prisma.category.deleteMany({ where: { projectId: project.id } });
  await prisma.qrCode.deleteMany({ where: { projectId: project.id } });

  const catIds = new Map<string, string>();
  let sort = 0;
  for (const name of raw.categories) {
    const cat = await prisma.category.create({
      data: {
        projectId: project.id,
        name: { ru: name, kk: name, en: name },
        sort: sort++,
        group: ["Кофе и чай", "Безалкогольные", "Алкогольные"].includes(name)
          ? "bar"
          : "kitchen",
      },
    });
    catIds.set(name, cat.id);
  }

  let itemSort = 0;
  for (const item of raw.items) {
    const categoryId = catIds.get(item.cat);
    if (!categoryId) continue;
    await prisma.item.create({
      data: {
        projectId: project.id,
        categoryId,
        name: { ru: item.name, kk: item.name, en: item.name },
        description: item.desc
          ? { ru: item.desc, kk: item.desc, en: item.desc }
          : undefined,
        price: item.price ?? 0,
        volume: item.volume,
        available: true,
        sort: itemSort++,
        photos: [],
        tags: [],
      },
    });
  }

  const draft = {
    categories: await prisma.category.findMany({
      where: { projectId: project.id },
      orderBy: { sort: "asc" },
    }),
    items: await prisma.item.findMany({
      where: { projectId: project.id },
      orderBy: { sort: "asc" },
    }),
  };

  await prisma.menuVersion.create({
    data: {
      projectId: project.id,
      snapshot: draft,
      note: "seed park avenue",
      createdById: admin.id,
    },
  });

  await prisma.qrCode.create({
    data: {
      code: nanoid(8),
      projectId: project.id,
      label: "Общий QR",
    },
  });

  console.log("Seed complete: park-avenue demo project + studio_admin");
  console.log(`Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
