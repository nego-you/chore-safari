// /kids/[kidId]/flow — 「ぜんぶの ながれ」見える化ページ
// Notion「流れの見える化」指示に基づく、小学校低学年〜幼児向けの
// やさしい全体フロー図。文章は最小限・大きな絵文字と矢印で見せる。
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FlowClient from "./FlowClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function FlowPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <FlowClient />;
}
