// /kids/[kidId]/race — 30秒カオスレース画面。
// Ollamaが生成したシナリオに従い、みこと・ゆきと・かなたの3人がレースする。
// 旧 RaceClient（動物選択×Geminiストリーミング）はそのまま残しているので
// 必要なら RaceClient を import して切り戻せる。

import { RacePlayer } from "./RacePlayer";

export const dynamic = "force-dynamic";

type Params = Promise<{ kidId: string }>;

export default async function RacePage({ params }: { params: Params }) {
  const { kidId } = await params;
  return <RacePlayer kidId={kidId} />;
}
