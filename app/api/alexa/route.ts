// POST /api/alexa — Amazon Alexa Custom Skill からの「お手伝いやったよ」報告を受け取る。
// Alexa の Intent スロット（KidName / SpokenQuestName）を取り出して、
//   - User を名前で特定
//   - Quest を「タイトル部分一致」かつ「対象ユーザに含まれる（または全員用）」で検索
//   - 該当があれば QuestSubmission を PENDING で作成（重複は作らない）
// したうえで、Alexa Custom Skill のレスポンス JSON を返す。

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Alexa リクエスト/レスポンスの最小限の型。
// 公式の Request/Response JSON のうち、本ルートで読む部分だけを表現する。
// ─────────────────────────────────────────────

type AlexaSlot = {
  name?: string;
  value?: string;
};

type AlexaIntent = {
  name?: string;
  slots?: Record<string, AlexaSlot>;
};

type AlexaRequestBody = {
  request?: {
    type?: string;
    intent?: AlexaIntent;
  };
};

type AlexaResponseJson = {
  version: "1.0";
  response: {
    outputSpeech: {
      type: "PlainText";
      text: string;
    };
    shouldEndSession: boolean;
  };
};

function speak(text: string): Response {
  const body: AlexaResponseJson = {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text },
      shouldEndSession: true,
    },
  };
  return Response.json(body);
}

// スロット値を取り出すユーティリティ。
// Alexa のスロット名は大文字小文字が一致するはずだが、安全のため両方確認する。
function getSlotValue(
  intent: AlexaIntent | undefined,
  slotName: string,
): string | undefined {
  const slots = intent?.slots;
  if (!slots) return undefined;
  const direct = slots[slotName]?.value;
  if (direct && direct.trim()) return direct.trim();
  // 大小ゆれ対策
  for (const key of Object.keys(slots)) {
    if (key.toLowerCase() === slotName.toLowerCase()) {
      const v = slots[key]?.value;
      if (v && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  let body: AlexaRequestBody;
  try {
    body = (await req.json()) as AlexaRequestBody;
  } catch {
    // Alexa 側にも一応「分からなかった」と返しておく。
    return speak("ごめんね、誰の報告か分からなかったよ。");
  }

  const intent = body.request?.intent;
  const kidName = getSlotValue(intent, "KidName");
  const spokenQuestName = getSlotValue(intent, "SpokenQuestName");

  // ── ユーザー特定 ──
  if (!kidName) {
    return speak("ごめんね、誰の報告か分からなかったよ。");
  }

  const child = await prisma.user.findFirst({
    where: {
      name: kidName,
      role: "CHILD",
    },
    select: { id: true, name: true },
  });

  if (!child) {
    return speak("ごめんね、誰の報告か分からなかったよ。");
  }

  // ── クエスト検索（あいまい検索 ＋ 対象者フィルタ） ──
  if (!spokenQuestName) {
    return speak(
      `ごめんね、${child.name}のクエストが分からなかったよ。もう一度教えてね。`,
    );
  }

  const quest = await prisma.quest.findFirst({
    where: {
      AND: [
        { isActive: true },
        { title: { contains: spokenQuestName } },
        {
          OR: [
            // 対象が「全員（誰も紐付いていない＝空）」のクエスト
            { targetUsers: { none: {} } },
            // この子供が対象に含まれているクエスト
            { targetUsers: { some: { id: child.id } } },
          ],
        },
      ],
    },
    select: { id: true, title: true },
  });

  if (!quest) {
    return speak(
      `ごめんね、${spokenQuestName}というお手伝いが見つからないか、${child.name}のクエストじゃないみたい。もう一度教えてね。`,
    );
  }

  // ── 申請作成（既に PENDING があれば作らない） ──
  try {
    const pending = await prisma.questSubmission.findFirst({
      where: {
        userId: child.id,
        questId: quest.id,
        status: "PENDING",
      },
      select: { id: true },
    });

    if (!pending) {
      await prisma.questSubmission.create({
        data: {
          userId: child.id,
          questId: quest.id,
          status: "PENDING",
        },
      });
    }
  } catch (err) {
    console.error("[/api/alexa] failed to create QuestSubmission:", err);
    return speak("ごめんね、報告の保存に失敗したよ。もう一度教えてね。");
  }

  return speak(
    `${child.name}の、${quest.title}の報告を受け付けたよ！パパの確認を待っててね！`,
  );
}
