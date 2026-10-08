import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demos = await prisma.project.findMany({ where: { demo: true } });
  for (const p of demos) {
    await prisma.project.delete({ where: { id: p.id } });
    console.log("deleted demo project", p.slug);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
