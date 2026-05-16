// /kids/crane — クレーンゲーム。
// ?kid= で誰がプレイ中か特定。指定が無いときはピッカーを出す。

import { prisma } from "@/lib/prisma";
import { CraneClient } from "./CraneClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function CranePage({
  params,
}: {
  params: Params;
}) {
  const { kidId: kidParam } = await params;

  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  return <CraneClient initialKidId={initialKid} kids={kids} />;
}
