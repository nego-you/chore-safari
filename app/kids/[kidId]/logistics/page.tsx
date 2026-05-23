// /kids/[kidId]/logistics — 物流センターミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LogisticsClient from "./LogisticsClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function LogisticsPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <LogisticsClient />;
}
