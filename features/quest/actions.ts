"use server";

// features/quest/actions.ts
// クエスト申請（子供側）。
// 同じ (user, quest) に PENDING な申請がある場合は重複申請をはじく。

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── 型 ────────────────────────────────────────────────────────────────

export type SubmitQuestResult =
  | {
      success: true;
      submission: {
        id: string;
        questId: string;
        userId: string;
        status: "PENDING";
        submittedAt: string;
      };
    }
  | { success: false; error: string };

// ── メインアクション ────────────────────────────────────────────────────

export async function submitQuest(
  userId: string,
  questId: string,
): Promise<SubmitQuestResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "CHILD") {
    return { success: false, error: "ユーザーが みつかりません" };
  }

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || !quest.isActive) {
    return { success: false, error: "クエストが みつかりません" };
  }

  const pending = await prisma.questSubmission.findFirst({
    where: { userId, questId, status: "PENDING" },
  });
  if (pending) {
    return { success: false, error: "もう しんせいずみだよ" };
  }

  const created = await prisma.questSubmission.create({
    data: { userId, questId, status: "PENDING" },
  });

  revalidatePath("/kids/[kidId]/quests", "page");
  revalidatePath("/bank");

  return {
    success: true,
    submission: {
      id: created.id,
      questId: created.questId,
      userId: created.userId,
      status: "PENDING",
      submittedAt: created.submittedAt.toISOString(),
    },
  };
}
