// lib/ai-guide.ts
// AIガイドキャラクター機能 — 3R/3C アーキテクチャ実装
//   Receptor  : データ収集（Prisma）
//   Constraint: プロンプト構築（親密度フェーズ・未利用機能誘導）
//   Reactor   : Ollama API 呼出・Zod パース

import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// Ollama レスポンス スキーマ
// ─────────────────────────────────────────────────────────────
const AiResponseSchema = z.object({
  reply_text: z.string(),
  emotion: z.enum(["neutral", "joy", "blush", "think"]),
  suggested_action: z.enum(["none", "open_camera", "open_quiz"]),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 1. Receptor — データ収集
// ─────────────────────────────────────────────────────────────
class AIGuideReceptor {
  async collectData(userId: string, caughtAnimalId: string) {
    const [caughtAnimal, activities] = await Promise.all([
      prisma.caughtAnimal.findUnique({
        where: { id: caughtAnimalId },
        select: {
          id: true,
          intimacyScore: true,
          caughtAt: true,
          animal: {
            select: {
              genericName: true,
              specificName: true,
              emoji: true,
              lifespanYears: true,
            },
          },
          personality: {
            select: {
              name: true,
              firstPerson: true,
              toneRule: true,
            },
          },
        },
      }),
      prisma.userActivity.findMany({
        where: { userId },
        select: { featureId: true, lastUsedAt: true },
      }),
    ]);

    return { caughtAnimal, activities };
  }
}

type CollectedData = Awaited<ReturnType<AIGuideReceptor["collectData"]>>;
type CaughtAnimalData = NonNullable<CollectedData["caughtAnimal"]>;
type ActivityData = CollectedData["activities"];

// ─────────────────────────────────────────────────────────────
// 2. Constraint — プロンプト構築
// ─────────────────────────────────────────────────────────────
class AIGuideConstraint {
  buildSystemPrompt(
    ca: CaughtAnimalData,
    activities: ActivityData,
    currentScreen: string,
  ): string {
    const personality = ca.personality ?? {
      firstPerson: "ぼく",
      toneRule: "元気よく、やさしい口調で話す。",
    };

    const phaseRule = this._phaseRule(ca.intimacyScore);
    const suggestionRule = this._suggestionRule(activities);
    const ageInYears = Math.floor(
      (Date.now() - ca.caughtAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return `
あなたはサファリアプリのAIガイドキャラクターです。
以下の設定と制約に厳密に従って、子供ユーザーと会話してください。

【キャラクター設定】
・種族: ${ca.animal.genericName}（${ca.animal.specificName}）
・一人称: ${personality.firstPerson}
・基本の口調ルール: ${personality.toneRule}
・ゲーム内の年齢: ${ageInYears} さい（じゅみょう: ${ca.animal.lifespanYears} ねん）

【親密度による口調の制約】
現在の親密度スコア: ${ca.intimacyScore}
適用する段階ルール:
${phaseRule}

【状況とアクションの誘導】
現在のアプリ画面: ${currentScreen}
推奨アクション:
${suggestionRule}
(推奨アクションがある場合は、会話の中で自然にその機能を使うよう誘導してください)

【対象ユーザー】
相手は幼い子供（3〜8歳）です。
やさしく、ひらがな中心で、短い言葉で話してください。

【出力形式の制約】
必ず以下のJSONスキーマに従い、JSON文字列のみを出力してください。
Markdownのコードブロック記法等は一切含めないでください。
{
  "reply_text": "string (ユーザーへの返答テキスト。ひらがな中心で50字以内)",
  "emotion": "neutral|joy|blush|think",
  "suggested_action": "none|open_camera|open_quiz"
}
    `.trim();
  }

  private _phaseRule(score: number): string {
    if (score <= 300) {
      return "Phase1 (0-300): まだ仲良くなりたてです。少しよそよそしく、敬語っぽい口調で話してください。";
    } else if (score <= 800) {
      return "Phase2 (301-800): 友達になれました！親しみのある、フレンドリーな口調で話してください。";
    } else {
      return "Phase3 (801-): 大親友です！家族や親友のような、強い絆を感じさせる言葉遣いで話してください。";
    }
  }

  private _suggestionRule(activities: ActivityData): string {
    const rules: string[] = [];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const cameraActivity = activities.find((a: { featureId: string; lastUsedAt: Date }) => a.featureId === "camera");
    const quizActivity = activities.find((a: { featureId: string; lastUsedAt: Date }) => a.featureId === "quiz");

    if (!cameraActivity || cameraActivity.lastUsedAt < threeDaysAgo) {
      rules.push(
        "- ユーザーは最近カメラ機能を使っていません。動物の写真を撮るよう促し、suggested_action を open_camera にしてください。",
      );
    }
    if (!quizActivity || quizActivity.lastUsedAt < threeDaysAgo) {
      rules.push(
        "- ユーザーは最近クイズ機能を使っていません。サファリクイズに誘い、suggested_action を open_quiz にしてください。",
      );
    }

    return rules.length > 0
      ? rules.join("\n")
      : "特になし。suggested_action は none にし、通常の会話をしてください。";
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Reactor — Ollama API 呼出・Zod パース
// ─────────────────────────────────────────────────────────────
class AIGuideReactor {
  async generateReply(systemPrompt: string, userText: string): Promise<AiResponse> {
    const ollamaUrl =
      process.env.OLLAMA_API_URL ?? "http://localhost:11434/api/chat";
    const model = process.env.OLLAMA_MODEL ?? "llama3";

    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        format: "json",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const parsedContent = JSON.parse(data.message.content as string);
    return AiResponseSchema.parse(parsedContent);
  }
}

// ─────────────────────────────────────────────────────────────
// Facade — 外部から使う唯一の入口
// ─────────────────────────────────────────────────────────────
export class AIGuideService {
  private receptor = new AIGuideReceptor();
  private constraint = new AIGuideConstraint();
  private reactor = new AIGuideReactor();

  async chat(
    userId: string,
    caughtAnimalId: string,
    message: string,
    currentScreen: string,
  ): Promise<AiResponse> {
    const { caughtAnimal, activities } = await this.receptor.collectData(
      userId,
      caughtAnimalId,
    );
    if (!caughtAnimal) {
      throw new Error("CAUGHT_ANIMAL_NOT_FOUND");
    }

    const systemPrompt = this.constraint.buildSystemPrompt(
      caughtAnimal,
      activities,
      currentScreen,
    );

    const response = await this.reactor.generateReply(systemPrompt, message);

    // 会話するたびに親密度 +10
    await prisma.caughtAnimal.update({
      where: { id: caughtAnimalId },
      data: { intimacyScore: { increment: 10 } },
    });

    return response;
  }

  /** 機能利用履歴を更新（カメラ・クイズ利用後に呼ぶ） */
  static async recordActivity(userId: string, featureId: string): Promise<void> {
    await prisma.userActivity.upsert({
      where: { userId_featureId: { userId, featureId } },
      update: { lastUsedAt: new Date() },
      create: { userId, featureId },
    });
  }
}
