// lib/ai-guide.ts
// AIガイドキャラクター機能 — 3R/3C アーキテクチャ実装
//
//   ┌─────────────────────────────────────────────────┐
//   │  chat()           : ユーザー入力への 1:1 対話    │
//   │  suggestProactively() : 自発的な声かけ生成       │
//   └─────────────────────────────────────────────────┘
//
//   各メソッド共通の 3R/3C フロー:
//     Receptor  : Prisma でユーザー状況を収集
//     Constraint: 優先度判定・発話タイミング制御・システムプロンプト構築
//     Reactor   : Gemini API 呼出（generateObject で構造化出力）

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { geminiGenerateObject } from "@/lib/gemini";

// ─────────────────────────────────────────────────────────────
// Gemini レスポンス スキーマ
// ─────────────────────────────────────────────────────────────
const AiResponseSchema = z.object({
  reply_text: z.string(),
  emotion: z.enum(["neutral", "joy", "blush", "think"]),
  suggested_action: z.enum(["none", "open_camera", "open_quiz"]),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 共通型
// ─────────────────────────────────────────────────────────────

/** 自発提案 Reactor の出力スキーマ（シンプルなテキストのみ） */
const SuggestionResponseSchema = z.object({
  suggestion_text: z.string(),
  emotion: z.enum(["neutral", "joy", "blush", "think", "worry"]),
});
export type SuggestionResponse = z.infer<typeof SuggestionResponseSchema>;

// ─────────────────────────────────────────────────────────────
// 1. Receptor — データ収集
// ─────────────────────────────────────────────────────────────
class AIGuideReceptor {
  /** chat() 用: CaughtAnimal + UserActivity */
  async collectData(userId: string, caughtAnimalId: string) {
    const [caughtAnimal, activities, appearedHunts, lastGacha, lastHunt] = await Promise.all([
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
      // 出現済み罠の数（今すぐ確認できる状態）
      prisma.hunt.count({ where: { userId, status: "APPEARED" } }),
      // 最後にガチャをした日時
      prisma.gachaTransaction.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // 最後に狩りをした日時
      prisma.hunt.findFirst({
        where: { userId },
        orderBy: { placedAt: "desc" },
        select: { placedAt: true },
      }),
    ]);

    return { caughtAnimal, activities, appearedHunts, lastGacha, lastHunt };
  }

  /** suggestProactively() 用: ユーザー状況の全体収集 */
  async collectContext(userId: string, activeGuideId: string) {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [user, guideAnimal, expiringAnimals, activities, pendingQuests, appearedHunts, lastGacha, lastHunt] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            coinBalance: true,
            currentStreak: true,
            streakStatus: true,
          },
        }),
        prisma.caughtAnimal.findUnique({
          where: { id: activeGuideId },
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
              select: { firstPerson: true, toneRule: true },
            },
          },
        }),
        // 寿命が 3 日以内に切れる生存中の動物
        prisma.caughtAnimal.findMany({
          where: {
            caughtByUserId: userId,
            isAlive: true,
            expiresAt: { lte: threeDaysLater, gt: now },
          },
          select: {
            animal: { select: { genericName: true, emoji: true } },
            expiresAt: true,
          },
          take: 3,
        }),
        prisma.userActivity.findMany({
          where: { userId },
          select: { featureId: true, lastUsedAt: true },
        }),
        // 承認待ちのクエスト申請数
        prisma.questSubmission.count({
          where: { userId, status: "PENDING" },
        }),
        // 出現済み罠の数
        prisma.hunt.count({ where: { userId, status: "APPEARED" } }),
        // 最後にガチャをした日時
        prisma.gachaTransaction.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        // 最後に狩りをした日時
        prisma.hunt.findFirst({
          where: { userId },
          orderBy: { placedAt: "desc" },
          select: { placedAt: true },
        }),
      ]);

    return {
      user,
      guideAnimal,
      expiringAnimals,
      activities,
      pendingQuests,
      appearedHunts,
      lastGacha,
      lastHunt,
    };
  }
}

type CollectedData = Awaited<ReturnType<AIGuideReceptor["collectData"]>>;
type CaughtAnimalData = NonNullable<CollectedData["caughtAnimal"]>;
type ActivityData = CollectedData["activities"];

type CollectedContext = Awaited<ReturnType<AIGuideReceptor["collectContext"]>>;

// ─────────────────────────────────────────────────────────────
// 2. Constraint — プロンプト構築 + 発話タイミング制御
// ─────────────────────────────────────────────────────────────
class AIGuideConstraint {
  /**
   * 自発提案のトリガー判定。
   * - 最後の自発提案から COOLDOWN_MIN 分未満なら null を返し、スキップする。
   * - 話しかける内容があれば優先度テキストを返す。
   */
  shouldTriggerSuggestion(
    activities: CollectedContext["activities"],
  ): string | null {
    const COOLDOWN_MIN = 30;
    const cooldownMs = COOLDOWN_MIN * 60 * 1000;

    const lastSuggestion = activities.find(
      (a) => a.featureId === "guide_proactive",
    );
    if (lastSuggestion) {
      const elapsed = Date.now() - lastSuggestion.lastUsedAt.getTime();
      if (elapsed < cooldownMs) return null;
    }
    // 内容がある（後続の buildSuggestionPrompt で生成）ことを示すために
    // ここでは「話す意図あり」を示す非 null を返す
    return "TRIGGER";
  }

  /** 自発提案のシステムプロンプトを構築する */
  buildSuggestionPrompt(ctx: CollectedContext): string {
    const { user, guideAnimal, expiringAnimals, activities, pendingQuests, appearedHunts, lastGacha, lastHunt } =
      ctx;

    if (!guideAnimal || !user) return "";

    const personality = guideAnimal.personality ?? {
      firstPerson: "ぼく",
      toneRule: "元気よく、やさしい口調で話す。",
    };

    // ── 優先度リストを組み立て ──
    // tier1: 緊急・重要（最初の1件を確定で使う）
    // tier2: 日常提案（ランダムに1件選ぶ）
    const tier1: string[] = [];
    const tier2: string[] = [];

    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const getAct = (id: string) => activities.find((a) => a.featureId === id);

    if (expiringAnimals.length > 0) {
      const names = expiringAnimals
        .map((a) => `${a.animal.emoji}${a.animal.genericName}`)
        .join("、");
      tier1.push(`【最優先】寿命が3日以内の仲間（${names}）のことを心配して声をかける`);
    }

    if (appearedHunts > 0) {
      tier1.push(`罠に${appearedHunts}匹引っかかっている！今すぐサファリに確認しに行くよう強く誘う`);
    }

    if (user.coinBalance < 50) {
      tier1.push("コインが少ないので、おてつだいクエストをがんばるよう励ます");
    }

    if (user.currentStreak >= 3) {
      tier1.push(`${user.currentStreak}日連続達成中！ ストリークをほめてモチベートする`);
    }

    if (pendingQuests > 0) {
      tier1.push(`承認待ちのクエストが${pendingQuests}件ある。親に見てもらうよう促す`);
    }

    // tier2: DB実績・アクティビティ履歴ベースの日常提案
    if (!lastGacha || lastGacha.createdAt < threeDaysAgo) {
      tier2.push("最近ガチャをやっていない。ガチャに誘う");
    }
    if (!lastHunt || lastHunt.placedAt < threeDaysAgo) {
      tier2.push("最近サファリで狩りをしていない。罠を仕掛けるか狩りに行くよう誘う");
    }
    const raceAct = getAct("race");
    if (!raceAct || raceAct.lastUsedAt < threeDaysAgo) {
      tier2.push("最近カオスレースをしていない。レースに誘う");
    }
    const craftAct = getAct("craft");
    if (!craftAct || craftAct.lastUsedAt < sevenDaysAgo) {
      tier2.push("最近クラフトをしていない。道具を作るよう誘う");
    }
    const cameraAct = getAct("camera");
    if (!cameraAct || cameraAct.lastUsedAt < sevenDaysAgo) {
      tier2.push("最近カメラ機能を使っていない。写真を撮るよう誘う");
    }

    let priorityText: string;
    if (tier1.length > 0) {
      priorityText = tier1[0]; // 緊急事項は先頭確定
    } else if (tier2.length > 0) {
      priorityText = tier2[Math.floor(Math.random() * tier2.length)]; // 日常提案はランダム
    } else {
      priorityText = "特に緊急事項はない。日常の挨拶や励ましの言葉をかける";
    }

    const ageInDays = Math.floor(
      (Date.now() - guideAnimal.caughtAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return `
あなたはサファリアプリのAIガイドキャラクターです。
プレイヤーの状況を把握して、ひとこと声をかけてください。

【あなたのキャラクター設定】
・種族: ${guideAnimal.animal.genericName}
・一人称: ${personality.firstPerson}
・口調ルール: ${personality.toneRule}
・ゲーム内の年齢: ${ageInDays}日（じゅみょう: ${guideAnimal.animal.lifespanYears}ねん）

【プレイヤーの現在状況】
・コイン残高: ${user.coinBalance}コイン
・連続達成日数: ${user.currentStreak}日
・親密度スコア: ${guideAnimal.intimacyScore}

【今回の声かけ方針（これだけを話す）】
${priorityText}

【制約】
・相手は幼い子供（3〜8歳）です。ひらがな中心で、短く（40字以内）話してください。
・唐突に話しかけるので、自然に始めてください（「ねえねえ」「そういえば」などで始めてOK）。

【出力形式】
必ず以下のJSONのみを出力してください。Markdownコードブロックや説明文は不要です。
{"suggestion_text": "40字以内のひらがな中心の一言", "emotion": "neutral|joy|blush|think|worry"}
    `.trim();
  }

  buildSystemPrompt(
    ca: CaughtAnimalData,
    activities: ActivityData,
    currentScreen: string,
    appearedHunts: number,
    lastGacha: { createdAt: Date } | null,
    lastHunt: { placedAt: Date } | null,
  ): string {
    const personality = ca.personality ?? {
      firstPerson: "ぼく",
      toneRule: "元気よく、やさしい口調で話す。",
    };

    const phaseRule = this._phaseRule(ca.intimacyScore);
    const suggestionRule = this._suggestionRule(activities, appearedHunts, lastGacha, lastHunt);
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

【ゲームの経済の流れ（「ながれをおしえて」と聞かれたら説明する）】
①クエストギルドでおてつだいをしてコインをもらう
②クラフト工房でわなやどうぐをつくる
③サファリ（罠スタイル or アクティブ狩り）でどうぶつをつかまえる
④自分の家・牧場・動物園でどうぶつをそだてる
⑤カオスレースやゲームセンターでコインをつかってあそぶ
聞かれたら上のながれを、ひとつずつ、やさしいことばでおしえてあげてください。

【対象ユーザー】
相手は幼い子供（3〜8歳）です。
やさしく、ひらがな中心で、短い言葉で話してください。

【出力形式】
必ず以下のJSONのみを出力してください。Markdownコードブロックや説明文は一切不要です。
{"reply_text": "ひらがな中心で50字以内の返答", "emotion": "neutral|joy|blush|think", "suggested_action": "none|open_camera|open_quiz"}
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

  private _suggestionRule(
    activities: ActivityData,
    appearedHunts: number,
    lastGacha: { createdAt: Date } | null,
    lastHunt: { placedAt: Date } | null,
  ): string {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const getAct = (id: string) =>
      activities.find((a: { featureId: string; lastUsedAt: Date }) => a.featureId === id);

    // ── 最優先（確定）：出現済みの罠 ──────────────────────────────
    // DB で実際に APPEARED 状態の Hunt がある場合は即座に誘導
    if (appearedHunts > 0) {
      return `- 罠に動物が引っかかっています（${appearedHunts}件）。今すぐサファリに確認しに行くよう強く誘ってください。suggested_action は none。`;
    }

    // ── 候補プール（ランダム選択で毎回違う話題に） ────────────────
    // DB実績ベース・アクティビティ履歴ベースの提案を混ぜる
    const pool: string[] = [];

    if (!lastGacha || lastGacha.createdAt < threeDaysAgo) {
      pool.push("- 最近ガチャをやっていません。ガチャに誘ってください。suggested_action は none。");
    }
    if (!lastHunt || lastHunt.placedAt < threeDaysAgo) {
      pool.push("- 最近サファリで狩りをしていません。罠を仕掛けるか狩りに行くよう誘ってください。suggested_action は none。");
    }
    const raceAct = getAct("race");
    if (!raceAct || raceAct.lastUsedAt < threeDaysAgo) {
      pool.push("- 最近カオスレースをしていません。レースに誘ってください。suggested_action は none。");
    }
    const craftAct = getAct("craft");
    if (!craftAct || craftAct.lastUsedAt < sevenDaysAgo) {
      pool.push("- 最近クラフトをしていません。道具を作るよう誘ってください。suggested_action は none。");
    }
    const quizAct = getAct("quiz");
    if (!quizAct || quizAct.lastUsedAt < threeDaysAgo) {
      pool.push("- 最近クイズをしていません。サファリクイズに誘い、suggested_action を open_quiz にしてください。");
    }
    const cameraAct = getAct("camera");
    if (!cameraAct || cameraAct.lastUsedAt < sevenDaysAgo) {
      pool.push("- 最近カメラ機能を使っていません。動物の写真を撮るよう促し、suggested_action を open_camera にしてください。");
    }

    if (pool.length === 0) {
      return "特になし。suggested_action は none にし、通常の会話をしてください。";
    }
    // ランダムに1件選ぶ（毎回カメラ一択にならないように）
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Reactor — Gemini API 呼出（generateObject で構造化出力）
// ─────────────────────────────────────────────────────────────
class AIGuideReactor {
  /** チャット応答を生成 */
  async generateReply(systemPrompt: string, userText: string): Promise<AiResponse> {
    const result = await geminiGenerateObject(AiResponseSchema, systemPrompt, userText);

    if (!result.ok) {
      throw new Error(`Gemini error: ${result.error}`);
    }

    console.log("[generateReply] object:", JSON.stringify(result.object));
    return result.object;
  }

  /** 自発提案テキストを生成 */
  async generateSuggestion(systemPrompt: string): Promise<SuggestionResponse> {
    // ユーザー入力は不要。"今の状況を見て一言話して" と促すだけ。
    const result = await geminiGenerateObject(
      SuggestionResponseSchema,
      systemPrompt,
      "今の状況を見て、ひとこと話しかけて。",
    );

    if (!result.ok) {
      throw new Error(`Gemini error: ${result.error}`);
    }

    return result.object;
  }
}

// ─────────────────────────────────────────────────────────────
// Facade — 外部から使う唯一の入口
// ─────────────────────────────────────────────────────────────
export class AIGuideService {
  private receptor = new AIGuideReceptor();
  private constraint = new AIGuideConstraint();
  private reactor = new AIGuideReactor();

  // ── 1:1 チャット ─────────────────────────────────────────
  async chat(
    userId: string,
    caughtAnimalId: string,
    message: string,
    currentScreen: string,
  ): Promise<AiResponse> {
    const { caughtAnimal, activities, appearedHunts, lastGacha, lastHunt } = await this.receptor.collectData(
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
      appearedHunts,
      lastGacha,
      lastHunt,
    );

    const response = await this.reactor.generateReply(systemPrompt, message);

    // 会話するたびに親密度 +10
    await prisma.caughtAnimal.update({
      where: { id: caughtAnimalId },
      data: { intimacyScore: { increment: 10 } },
    });

    return response;
  }

  // ── 自発提案（3R/3C 完全版）──────────────────────────────
  /**
   * ガイドキャラの自発的な声かけを生成する。
   * - Receptor  : ユーザー状況を収集
   * - Constraint: クールダウン判定 → スキップ or 優先メッセージ選定
   * - Reactor   : Gemini でセリフ生成
   * @returns 表示すべきテキスト（無ければ null）
   */
  async suggestProactively(
    userId: string,
    activeGuideId: string,
  ): Promise<SuggestionResponse | null> {
    // Receptor
    const ctx = await this.receptor.collectContext(userId, activeGuideId);
    if (!ctx.guideAnimal || !ctx.user) return null;

    // Constraint — クールダウン判定
    const trigger = this.constraint.shouldTriggerSuggestion(ctx.activities);
    if (!trigger) return null;

    // Constraint — システムプロンプト構築
    const systemPrompt = this.constraint.buildSuggestionPrompt(ctx);
    if (!systemPrompt) return null;

    // Reactor — 生成
    let suggestion: SuggestionResponse;
    try {
      suggestion = await this.reactor.generateSuggestion(systemPrompt);
    } catch {
      // Gemini API エラーは無視してサイレントフォールバック
      return null;
    }

    // 次のクールダウン開始: guide_proactive activity を更新
    await AIGuideService.recordActivity(userId, "guide_proactive");

    return suggestion;
  }

  // ── ユーティリティ ───────────────────────────────────────

  /** 機能利用履歴を更新（カメラ・クイズ利用後に呼ぶ） */
  static async recordActivity(userId: string, featureId: string): Promise<void> {
    await prisma.userActivity.upsert({
      where: { userId_featureId: { userId, featureId } },
      update: { lastUsedAt: new Date() },
      create: { userId, featureId },
    });
  }
}
