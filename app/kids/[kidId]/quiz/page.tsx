// /kids/[kidId]/quiz — 早押しクイズ（ゲームセンター方式）。1プレイ20コイン消費、正解で難易度別に20/30/40コイン。

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuizClient } from "./QuizClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

// 原則1（現実が主役）に基づくバックドア封鎖フラグ（2026-06-13）:
//   早押しクイズは「お手伝い経由でなくコインを稼げる自己完結ループ」のため、
//   ワールドマップ（HIDDEN_PIN_IDS で arcade を非表示）から導線を外している。
//   URL 直叩きアクセスも一律でワールドマップへ強制送還し、SSoT な現実経済だけを流通させる。
//   将来のリニューアルで復活させるときは false にする（以下の既存ロジックを温存）。
//   型注釈 `: boolean` は「常に true」と静的確定させないため（後続コードを到達可能に保つ）。
const REDIRECT_TO_WORLDMAP: boolean = true;

export default async function QuizPage({ params }: { params: Params }) {
  const { kidId } = await params;

  if (REDIRECT_TO_WORLDMAP) {
    redirect(`/kids/${kidId}`);
  }

  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidId && kids.some((k) => k.id === kidId) ? kidId : null;

  return <QuizClient initialKidId={initialKid} kids={kids} />;
}
