// /kids/[kidId]/safari — 罠を仕掛けて、出現→タイミングゲームで捕獲する非同期フロー。
// 即時抽選 (旧 exploreSafari) は廃止。setTrap → 待機 → checkTrap → resolveTrap の流れ。
// 2026-05-18: インベントリを SharedInventoryItem → UserTool（TRAP タイプ）に切替。
// 2026-05-20: ?style=active のとき safari/hunt へリダイレクト。
//             ワールドマップで入口を分けたため、このページは「罠スタイル専用」に固定。

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHuntStamina, getTrapStamina } from "../../actions";
import { grantDailyFreeTraps } from "@/features/safari/actions";
import { TRAP_RECIPES } from "../../config";
import { SafariClient } from "./SafariClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;
type SearchParams = Promise<{ style?: string; biome?: string }>;

export default async function SafariPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { kidId: kidParam } = await params;
  const { style, biome } = await searchParams;

  // ?style=active → アクティブ狩り専用ページへリダイレクト（戻りはマップへ）。
  // バイオーム（エンカウントしたタイル）は出現どうぶつの選出に使うので引き継ぐ。
  if (style === "active") {
    const suffix = biome ? `?biome=${encodeURIComponent(biome)}` : "";
    redirect(`/kids/${kidParam}/safari/hunt${suffix}`);
  }

  // kids 一覧を先に取得して initialKid を確定する（UserTool クエリに必要）。
  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidParam && kids.some((k) => k.id === kidParam) ? kidParam : null;

  // 毎日無料の罠枠：ownedTrapRows を読む前に底上げしておく（=セレクタに反映される）。
  const freeTrap = initialKid ? await grantDailyFreeTraps(initialKid) : null;

  // ワナづくり（part レシピ）の活性判定用に、ガチャ罠パーツの所持数を取得。
  const partItemIds = Array.from(
    new Set(
      TRAP_RECIPES.filter((r) => r.source === "part").flatMap((r) =>
        r.ingredients.map((i) => i.itemId),
      ),
    ),
  );

  const [ownedTrapRows, activeTraps, partRows] = await Promise.all([
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
    // ガチャ罠パーツ（SharedInventoryItem・家族共有）の所持数。
    partItemIds.length > 0
      ? prisma.sharedInventoryItem.findMany({
          where: { itemId: { in: partItemIds } },
          select: { itemId: true, quantity: true },
        })
      : Promise.resolve([] as { itemId: string; quantity: number }[]),
  ]);

  const partInventory: Record<string, number> = {};
  for (const row of partRows) partInventory[row.itemId] = row.quantity;

  // アクティブ狩り（BOW/SPEAR）と罠設置それぞれの本日残り回数。
  // 罠設置にも1日上限あり（一本道化 2026-06-12）。
  const [huntStamina, trapStamina] = await Promise.all([
    initialKid ? getHuntStamina(initialKid) : Promise.resolve(null),
    initialKid ? getTrapStamina(initialKid) : Promise.resolve(null),
  ]);

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
      trapStaminaRemaining={trapStamina?.remaining ?? null}
      trapStaminaLimit={trapStamina?.limit ?? 3}
      freeTrapGranted={freeTrap?.granted ?? false}
      freeTrapName={freeTrap?.toolName ?? null}
      partInventory={partInventory}
    />
  );
}
