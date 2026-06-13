// /kids 配下で共有する設定値。
// "use server" の actions.ts からは async 関数以外を export できないため、
// 定数はここに分離してサーバ/クライアント双方から import できるようにしておく。

export const GACHA_COST = 100;

// クレーンゲームの料金。ガチャより高め＝高級アイテムが出る仕組み。
export const CRANE_COST = 100;

// ─────────────────────────────────────────────────────────────
// 一本道化リフォーム（2026-06-12 / docs/DESIGN_PRINCIPLES.md 準拠）
// ─────────────────────────────────────────────────────────────

// コインで買える基本罠（お手伝い → コイン → 罠 → 図鑑 の原則ルート）。
export const TRAP_COST = 30;
export const SHOP_TRAP_TOOL_ID = "pitfall";

// 罠を仕掛けられる1日の上限回数（アクティブ狩りの HUNT_DAILY_LIMIT=3 とは別カウント）。
export const TRAP_DAILY_LIMIT = 3;

// クエスト申請の1日の上限回数（うんぱんミッション含む全カテゴリ合算）。
export const QUEST_DAILY_SUBMIT_LIMIT = 10;

// ワールドマップから隠す施設ピン（プログレッシブ・ディスクロージャー）。
// コード・ページ自体は残置しており、ここから ID を外せばすぐ復活できる。
export const HIDDEN_PIN_IDS: readonly string[] = [
  "craft",   // クラフト工房（画面内完結の作業系）
  "farm",    // 農場
  "ranch",   // 牧場
  "zoo",     // 動物園
  "race",    // カオスレース
  "arcade",  // ゲームセンター（クレーン/早押し/スロット）
  "flow",    // ながれ可視化（一本道化により不要）
];
