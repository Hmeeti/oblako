import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { menuThemes, type MenuThemeId } from "@/lib/themes";
import { PublicMenu } from "@/components/menu/PublicMenu";
import { brand } from "@/config/brand";

const getMenu = (slug: string) =>
  unstable_cache(
    async () => {
      const project = await prisma.project.findUnique({ where: { slug } });
      if (!project) return null;
      const version = await prisma.menuVersion.findFirst({
        where: { projectId: project.id },
        orderBy: { createdAt: "desc" },
      });
      return { project, version };
    },
    [`menu-slug-${slug}`],
    { tags: [`menu-slug-${slug}`], revalidate: 60 },
  )();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMenu(slug);
  if (!data) return { title: "Не найдено" };
  const noindex = (data.project.features as { indexable?: boolean })?.indexable !== true;
  return {
    title: data.project.name,
    description: `Меню ${data.project.name}`,
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string; embed?: string; theme?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getMenu(slug);

  if (!data) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--cream)] px-6 text-center">
        <div>
          <h1 className="font-display text-3xl">Заведение не найдено</h1>
          <p className="mt-2 text-[var(--stone)]">Проверьте ссылку или QR-код.</p>
        </div>
      </div>
    );
  }

  if (data.project.status === "paused") {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--cream)] px-6 text-center">
        <div>
          <h1 className="font-display text-3xl">Меню временно недоступно</h1>
          <p className="mt-2 text-[var(--stone)]">
            Свяжитесь с заведением.
          </p>
        </div>
      </div>
    );
  }

  if (!data.version) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--cream)] px-6 text-center">
        <div>
          <h1 className="font-display text-3xl">{data.project.name}</h1>
          <p className="mt-2 text-[var(--stone)]">Меню ещё не опубликовано.</p>
          <p className="mt-6 text-xs opacity-60">{brand.madeWith.ru}</p>
        </div>
      </div>
    );
  }

  const snap = data.version.snapshot as {
    categories: PublicMenuProps["categories"];
    items: PublicMenuProps["items"];
  };

  const themeId = (sp.theme || data.project.themeId) as MenuThemeId;
  const theme = menuThemes[themeId] ?? menuThemes["classic-green"];

  return (
    <PublicMenu
      data={{
        project: {
          name: data.project.name,
          slug: data.project.slug,
          serviceChargePercent: data.project.serviceChargePercent,
          features: (data.project.features as Record<string, unknown>) || {},
          contacts: (data.project.contacts as Record<string, unknown>) || {},
          allergyNote: data.project.allergyNote as
            | { ru?: string; kk?: string; en?: string }
            | null,
          logo: data.project.logo,
        },
        categories: snap.categories ?? [],
        items: snap.items ?? [],
        theme,
        tableNumber: sp.t ? Number(sp.t) : null,
        embed: sp.embed === "1",
      }}
    />
  );
}

type PublicMenuProps = React.ComponentProps<typeof PublicMenu>["data"];
