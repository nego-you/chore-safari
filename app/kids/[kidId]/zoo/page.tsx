// /kids/[kidId]/zoo — 動物園ミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ZooClient from "./ZooClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function ZooPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <ZooClient />;
}
