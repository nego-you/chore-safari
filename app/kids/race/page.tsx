// /kids/race — 熱血レース実況画面。
// 図鑑（CaughtAnimal）から ユニークな捕獲済みどうぶつの一覧を集めてクライアントに渡す。

import { prisma } from "@/lib/prisma";
import { RaceClient } from "./RaceClient";

export const dynamic = "force-dynamic";

export default async function RacePage() {
  // 家族で捕まえたことのある動物を、種別ごとに最新の捕獲時刻つきで集める。
  const catches = await prisma.caughtAnimal.findMany({
    orderBy: { caughtAt: "desc" },
    include: { animal: true },
  });

  const seen = new Set<string>();
  const uniqueAnimals: Array<{
    animalId: string;
    name: string;
    emoji: string;
    rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
    description: string;
    count: number;
  }> = [];
  const counts = new Map<string, number>();
  for (const c of catches) {
    counts.set(c.animal.animalId, (counts.get(c.animal.animalId) ?? 0) + 1);
  }
  for (const c of catches) {
    if (seen.has(c.animal.animalId)) continue;
    seen.add(c.animal.animalId);
    uniqueAnimals.push({
      animalId: c.animal.animalId,
      name: c.animal.name,
      emoji: c.animal.emoji,
      rarity: c.animal.rarity as "COMMON" | "RARE" | "EPIC" | "LEGENDARY",
      description: c.animal.description,
      count: counts.get(c.animal.animalId) ?? 1,
    });
  }

  return <RaceClient animals={uniqueAnimals} />;
}
