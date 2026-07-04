// /kids/[kidId]/craft — クラフト工房ミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CraftClient from "./CraftClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function CraftPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <CraftClient />;
}
