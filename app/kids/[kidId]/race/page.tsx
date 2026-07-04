// /kids/[kidId]/race — 30秒カオスレース画面。
// 捕まえた動物を選択してレースさせる。

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RacePlayer } from "./RacePlayer";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

// 原則1（現実が主役）に基づくバックドア封鎖フラグ（2026-06-13）:
//   カオスレースは「お手伝い経由でなくコインを稼げる自己完結ループ」のため、
//   ワールドマップ（HIDDEN_PIN_IDS で race を非表示）から導線を外している。
//   URL 直叩きアクセスも一律でワールドマップへ強制送還し、SSoT な現実経済だけを流通させる。
//   将来のリニューアルで復活させるときは false にする（以下の既存ロジックを温存）。
//   型注釈 `: boolean` は「常に true」と静的確定させないため（後続コードを到達可能に保つ）。
const REDIRECT_TO_WORLDMAP: boolean = true;

export default async function RacePage({ params }: { params: Params }) {
  const { kidId } = await params;

  if (REDIRECT_TO_WORLDMAP) {
    redirect(`/kids/${kidId}`);
  }

  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { coinBalance: true },
  });

  // 家族で捕まえたことのある動物を、種別ごとに最新の捕獲時付きで集める。
  const catches = await prisma.caughtAnimal.findMany({
    where: { caughtBy: { isTestAccount: false } },
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

  return (
    <RacePlayer
      kidId={kidId}
      animals={uniqueAnimals}
      coinBalance={kid?.coinBalance ?? 0}
    />
  );
}
