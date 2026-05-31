// /kids/[kidId]/layout.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SafariLayoutShell } from "./SafariLayoutShell";
import type { GuideInfo } from "./GuideContext";
import { getInventory } from "@/features/inventory/actions";
import { getKizuna } from "@/features/kizuna/actions";

type Params = Promise<{ kidId: string }>;

export default async function KidLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { kidId } = await params;

  // NOTE: activeGuideAnimal は schema.prisma 更新済み。
  //       prisma generate 後に型が解決される。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kid = await (prisma.user.findFirst as any)({
    where: { id: kidId, role: "CHILD" },
    select: {
      id: true,
      name: true,
      coinBalance: true,
      currentStreak: true,
      longestStreak: true,
      streakStatus: true,
      activeGuideAnimal: {
        select: {
          id: true,
          intimacyScore: true,
          animal: {
            select: { genericName: true, emoji: true },
          },
        },
      },
    },
  }) as {
    id: string;
    name: string;
    coinBalance: number;
    currentStreak: number;
    longestStreak: number;
    streakStatus: string;
    activeGuideAnimal: {
      id: string;
      intimacyScore: number;
      animal: { genericName: string; emoji: string };
    } | null;
  } | null;

  if (!kid) notFound();

  // ゲーム内インベントリ・おたがいさま進捗を DB から取得（ストアのハイドレート用）
  const [initialInventory, initialKizuna] = await Promise.all([
    getInventory(kid.id),
    getKizuna(kid.id),
  ]);

  const initialGuide: GuideInfo = kid.activeGuideAnimal
    ? {
        id: kid.activeGuideAnimal.id,
        animalName: kid.activeGuideAnimal.animal.genericName,
        emoji: kid.activeGuideAnimal.animal.emoji,
        intimacyScore: kid.activeGuideAnimal.intimacyScore,
      }
    : null;

  return (
    <SafariLayoutShell
      kidId={kid.id}
      kidName={kid.name}
      coinBalance={kid.coinBalance}
      initialInventory={initialInventory}
      initialKizuna={initialKizuna}
      currentStreak={kid.currentStreak ?? 0}
      longestStreak={kid.longestStreak ?? 0}
      streakStatus={kid.streakStatus ?? "ACTIVE"}
      initialGuide={initialGuide}
    >
      {children}
    </SafariLayoutShell>
  );
}
