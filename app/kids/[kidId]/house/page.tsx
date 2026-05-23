// /kids/[kidId]/house — 自分の家（ベースキャンプ）
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BaseCampClient from "./BaseCampClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function HousePage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <BaseCampClient />;
}
