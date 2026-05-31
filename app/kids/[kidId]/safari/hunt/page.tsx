// /kids/[kidId]/safari/hunt — アクティブ狩りミニゲーム
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHuntStamina } from "../../../actions";
import HuntClient from "./HuntClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function HuntPage({ params }: { params: Params }) {
  const { kidId } = await params;
  const kid = await prisma.user.findFirst({
    where: { id: kidId, role: "CHILD" },
    select: { id: true, name: true },
  });
  if (!kid) notFound();
  // 1日の捕獲回数（アクティブ狩り）の残り
  const stamina = await getHuntStamina(kid.id);
  return (
    <HuntClient
      kidId={kid.id}
      huntRemaining={stamina.remaining}
      huntLimit={stamina.limit}
    />
  );
}
