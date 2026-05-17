// DEVモード画面：テスト用裏アカウントのポータル。
// 銀行画面のヘッダーにある「🧪 DEV」ボタンから遷移する。

import { getOrCreateTestUser } from "../actions";
import { DevClient } from "./DevClient";

export const dynamic = "force-dynamic";

export default async function DevPage() {
  const testUser = await getOrCreateTestUser();
  return <DevClient testUser={testUser} />;
}
