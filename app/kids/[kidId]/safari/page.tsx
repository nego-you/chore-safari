// /kids/[kidId]/safari — 罠を仕掛けて、出現→タイミングゲームで捕獲する非同期フロー。
// 即時抽選 (旧 exploreSafari) は廃止。setTrap → 待機 → checkTrap → resolveTrap の流れ。
// 2026-05-18: インベントリを SharedInventoryItem → UserTool（TRAP タイプ）に切替。
// 2026-05-20: ?style=active のとき safari/hunt へリダイレクト。
//             ワールドマップで入口を分けたため、このページは「罠スタイル専用」に固定。

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHuntStamina } from "../../actions";
import { SafariClient } from "./SafariClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;
type SearchParams = Promise<{ style?: string }>;

export default async function SafariPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { kidId: kidParam } = await params;
  const { style } = await searchParams;

  // ?style=active → アクティブ狩り専用ページへリダイレクト（戻りはマップへ）
  if (style === "active") {
    redirect(`/kids/${kidParam}/safari/hunt`);
  }

  // kids 一覧を先に取得して initialKid を確定する（UserTool クエリに必要）。
  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  const [ownedTrapRows, activeTraps] = await Promise.all([
    // この子が持っている TRAP 型の道具だけを返す。
    initialKid
      ? prisma.userTool.findMany({
          where: {
            userId: initialKid,
            tool: { type: "TRAP" },
          },
          include: { tool: true },
          orderBy: { tool: { sortOrder: "asc" } },
        })
      : Promise.resolve([]),
    // 全 CHILD の仕掛け中・出現中の罠。クライアントで選択中の子の分だけ表示。
    prisma.hunt.findMany({
      where: { status: { in: ["PLACED", "APPEARED"] } },
      orderBy: { appearsAt: "asc" },
      include: { targetAnimal: true },
    }),
  ]);

  // アクティブ狩り（BOW/SPEAR）用の本日残り回数。罠スタイル自体は制限なし。
  const huntStamina = initialKid ? await getHuntStamina(initialKid) : null;

  // UserTool → クライアント用の軽量型に変換。
  const ownedTraps = ownedTrapRows.map((ut) => ({
    toolId: ut.tool.toolId,
    toolName: ut.tool.name,
    emoji: ut.tool.emoji,
    quantity: ut.quantity,
  }));

  const traps = activeTraps.map((t) => ({
    id: t.id,
    userId: t.userId,
    trapItemId: t.trapItemId,
    baitItemId: t.baitItemId,
    status: t.status as "PLACED" | "APPEARED",
    placedAt: t.placedAt.toISOString(),
    appearsAt: t.appearsAt.toISOString(),
    posX: t.posX,
    posY: t.posY,
    targetAnimal: {
      id: t.targetAnimal.id,
      animalId: t.targetAnimal.animalId,
      name: t.targetAnimal.name,
      genericName: t.targetAnimal.genericName,
      specificName: t.targetAnimal.specificName,
      emoji: t.targetAnimal.emoji,
      rarity: t.targetAnimal.rarity as
        | "COMMON"
        | "RARE"
        | "EPIC"
        | "LEGENDARY",
      description: t.targetAnimal.description,
      imageUrl: t.targetAnimal.imageUrl,
      isExtinct: t.targetAnimal.isExtinct,
    },
  }));

  return (
    <SafariClient
      initialKidId={initialKid}
      kids={kids}
      ownedTraps={ownedTraps}
      activeTraps={traps}
      huntStaminaRemaining={huntStamina?.remaining ?? null}
      huntStaminaLimit={huntStamina?.limit ?? 3}
    />
  );
}
