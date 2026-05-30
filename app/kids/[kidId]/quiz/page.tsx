// /kids/[kidId]/quiz — 早押しクイズ（ゲームセンター方式）。1プレイ20コイン消費、正解で難易度別に20/30/40コイン。

import { prisma } from "@/lib/prisma";
import { QuizClient } from "./QuizClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function QuizPage({ params }: { params: Params }) {
  const { kidId } = await params;

  const kids = await prisma.user.findMany({
    where: { role: "CHILD" },
    orderBy: { birthDate: "asc" },
    select: { id: true, name: true, coinBalance: true },
  });

  const initialKid =
    kidId && kids.some((k) => k.id === kidId) ? kidId : null;

  return <QuizClient initialKidId={initialKid} kids={kids} />;
}
