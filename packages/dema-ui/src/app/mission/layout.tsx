import { redirect } from "next/navigation";
import { readLocalSession } from "@/lib/auth/session-boundary";

export const dynamic = "force-dynamic";

export default async function MissionLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await readLocalSession();
  if (!session.ok) redirect(`/login?next=${encodeURIComponent("/mission")}`);
  return children;
}
