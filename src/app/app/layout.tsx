import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/app/AppShell";
import { RegisterSw } from "@/components/app/RegisterSw";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <>
      <RegisterSw />
      <AppShell>{children}</AppShell>
    </>
  );
}
