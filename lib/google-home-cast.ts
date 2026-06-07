// lib/google-home-cast.ts
// Google Home（Nest スピーカー）に喋らせる「ローカルキャスト」ヘルパー。
//
// 実際の発話は LAN 内で動く外部ブリッジ（pychromecast / catt / Home Assistant の
// notify サービスなど）に委譲する。ここではそのブリッジへ「喋ってほしいテキスト」を
// HTTP POST で渡すだけにとどめ、アプリ本体は配信手段に依存しないようにする。
//
// 設定（.env）:
//   GOOGLE_HOME_CAST_URL    キャストブリッジの Webhook URL（例: http://192.168.1.50:8009/say）
//   GOOGLE_HOME_CAST_TOKEN  （任意）ブリッジ側の簡易認証トークン
//
// 設計方針:
//   - この関数は **決して例外を投げない**。音声フィードバックはあくまで付加機能であり、
//     コイン処理本体（残高更新・履歴記録）の成否に影響させてはいけない。
//   - URL 未設定なら no-op（開発環境ではログのみ）。本番で喋らせたいときだけ設定する。

export type CastResult = {
  ok: boolean;
  /** URL 未設定などでキャストを試行しなかった場合 true */
  skipped?: boolean;
  error?: string;
};

/**
 * Google Home に指定テキストを喋らせる（ベストエフォート）。
 * 失敗しても例外は投げず、結果オブジェクトで成否を返す。
 */
export async function castToGoogleHome(
  text: string,
  opts?: { timeoutMs?: number },
): Promise<CastResult> {
  const message = text?.trim();
  if (!message) {
    return { ok: false, error: "text is empty" };
  }

  const url = process.env.GOOGLE_HOME_CAST_URL?.trim();
  if (!url) {
    // 開発環境ではキャスト先が無いのが普通なので、警告ログだけ残してスキップ。
    console.warn(
      "[google-home-cast] GOOGLE_HOME_CAST_URL 未設定のため音声キャストをスキップしました:",
      message,
    );
    return { ok: false, skipped: true };
  }

  const token = process.env.GOOGLE_HOME_CAST_TOKEN?.trim();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: message }),
      // 子供を待たせ過ぎないよう短めのタイムアウト。
      signal: AbortSignal.timeout(opts?.timeoutMs ?? 8_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[google-home-cast] キャストブリッジがエラーを返しました ${res.status}: ${detail}`,
      );
      return { ok: false, error: `cast bridge responded ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    console.error("[google-home-cast] キャストブリッジに接続できません:", err);
    return { ok: false, error: "cast bridge unreachable" };
  }
}
