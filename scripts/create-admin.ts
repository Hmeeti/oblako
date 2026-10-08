import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@stolio.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMeNow123!";
  const name = process.env.ADMIN_NAME || "Studio Admin";
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      platformRole: "studio_admin",
    },
    update: {
      passwordHash,
      platformRole: "studio_admin",
      name,
    },
  });
  console.log(`studio_admin ready: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
