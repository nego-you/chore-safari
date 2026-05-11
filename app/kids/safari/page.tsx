// /kids/safari — サファリ（探索）画面。
// Server Component で必要データを取得し、クライアントに渡す。

import { prisma } from "@/lib/prisma";
import { SafariClient } from "./SafariClient";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kid?: string | string[] }>;

export default async function SafariPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const kidParam = Array.isArray(sp.kid) ? sp.kid[0] : sp.kid;

  const [children, inventory, caughtAnimals] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CHILD" },
      orderBy: { birthDate: "asc" },
      select: { id: true, name: true, coinBalance: true },
    }),
    prisma.sharedInventoryItem.findMany({
      orderBy: [{ itemType: "asc" }, { itemName: "asc" }],
      select: {
        id: true,
        itemId: true,
        itemName: true,
        quantity: true,
        itemType: true,
      },
    }),
    prisma.caughtAnimal.findMany({
      orderBy: { caughtAt: "desc" },
      take: 200, // 直近 200 件まで表示
      include: {
        animal: true,
        caughtBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  // クライアントに渡す形に整形（Date は ISO 文字列に）。
  const catches = caughtAnimals.map((c) => ({
    id: c.id,
    animal: {
      id: c.animal.id,
      animalId: c.animal.animalId,
      name: c.animal.name,
      emoji: c.animal.emoji,
      rarity: c.animal.rarity as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
      description: c.animal.description,
      imageUrl: c.animal.imageUrl,
    },
    caughtBy: { id: c.caughtBy.id, name: c.caughtBy.name },
    caughtAt: c.caughtAt.toISOString(),
  }));

  const initialKid =
    kidParam && children.some((c) => c.id === kidParam) ? kidParam : null;

  return (
    <SafariClient
      initialKidId={initialKid}
      kids={children}
      inventory={inventory}
      catches={catches}
    />
  );
}
