// /kids/[kidId]/safari/hunt — アクティブ狩りミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHuntStamina } from "../../../actions";
import { DayEndScreen } from "../../DayEndScreen";
import HuntClient from "./HuntClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;
// ワールドマップでエンカウントしたタイル（バイオーム）。出現どうぶつの選出に使う。
type SearchParams = Promise<{ biome?: string }>;

export default async function HuntPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { kidId } = await params;
  const { biome } = await searchParams;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  // 1日の捕獲回数（アクティブ狩り）の残り
  const stamina = await getHuntStamina(kid.id);

  // きょうの分が終わっていたら、入口で「おしまい」画面を明示的に出す
  // （ハマりすぎ防止・一本道化 2026-06-12）。
  if (stamina.remaining <= 0) {
    return (
      <main className="min-h-screen bg-indigo-950">
        <DayEndScreen
          kidId={kid.id}
          message="きょうの かりは もう おしまい！"
          subMessage="また あした、げんじつの おてつだいで がんばろう！"
        />
      </main>
    );
  }

  return (
    <HuntClient
      kidId={kid.id}
      huntRemaining={stamina.remaining}
      huntLimit={stamina.limit}
      biome={biome ?? null}
    />
  );
}
