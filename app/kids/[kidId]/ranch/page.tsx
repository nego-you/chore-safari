// /kids/[kidId]/ranch — 牧場ミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RanchClient from "./RanchClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function RanchPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  return <RanchClient />;
}
