# コイン・在庫の永続化リファクタ設計（案B）

**作成日**: 2026-05-30
**ステータス**: ✅ **実装完了**（このドキュメントは当時の設計記録。現行の実態は [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) の「状態管理の実態」が正）
**目的**: コイン・在庫の「DB と localStorage(Zustand) の二重管理」を解消し、**DB を Single Source of Truth** にする。
**方針**: 案B（DB 権威 ＋ Zustand は常にサーバ値で上書きされるミラー）。

> ⚠️ **この設計の発行後（2026-05-31〜06-12）に状況が進んだ点**（本文中の前提と食い違うので注意）:
> - **`Material` / `UserMaterial` テーブルは削除済み**（2026-05-31 マイグレーション）。本文「6.2 当面そのまま」「9. 統廃合は今回やらない」の前提は解消された。クレーンの UserMaterial 二重書き込みも撤去済み。
> - **`animalsInYard` / `logisticsQueue`（Zustand の動物キュー）は撤去済み**で、動物は DB `CaughtAnimal` に一本化された（「9. 非対象」だった統合は完了）。
> - スタミナ・絆（Kizuna）の扱いは本文の「非対象」のまま（スタミナはエフェメラル、Kizuna は別途 DB 化）。
> - 一本道化（2026-06-12）で在庫を生む施設（農場・牧場・クラフト等）はワールドマップから非表示化されたが、`GameInventoryItem` 同期の仕組み自体は不変。

---

## 1. 現状の問題（要約）

[store/useSafariStore.ts](../store/useSafariStore.ts) が `coins` / `inventory` を localStorage に永続化し、
一部の増減が DB に書かれないため乖離する。詳細は [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) の「状態管理の実態」参照。

精査の結果、実際に動いている「DB 未反映」の経済操作は次のとおり：

| 種別 | 箇所 | 現状 | 対応 |
|---|---|---|---|
| コイン減 | 牧場のエサやり `spendCoins(FEED_COST)` | DB 未反映 | サーバアクション化 |
| コイン増 | 物流 `shipTruck()` | **未使用（死にコード）** | ストアから削除 |
| コイン（玩具） | 動物園 `gs.inventory.coins` | ローカル専用カウンタ（経済とは無関係） | 対象外 |
| 在庫 増減 | 農場/クラフト/牧場/物流/動物園/クレーン | DB 未反映 | DB 化（スナップショット同期） |
| ロード同期 | `initCoins`(===0 ガード) / `resetForKid`(kid 変更時のみ) | localStorage が残りDB乖離 | ロード時は常に DB 値採用 |
| 同期漏れ | 卒業プレゼント後 `syncCoins` 未呼び出し | ヘッダーが古いまま | 修正 |

すでに **クレーン・レース・早押しクイズはサーバ権威 ＋ `syncCoins` 反映済み**で正しい。

---

## 2. コインと在庫で戦略を分ける（重要）

| | 書き手 | 整合性要件 | 採用方式 |
|---|---|---|---|
| **コイン** | **2人**（子供のゲーム＋**親の Bank 承認**） | 加算/減算は競合しうる → **増分演算必須** | **トランザクション型サーバアクション**（`increment`/`decrement` ＋ `CoinTransaction`）。スナップショット上書きは厳禁（親の付与を消すため）。 |
| **在庫** | **1人**（子供本人のみ） | 競合なし | **スナップショット同期（last-write-wins）**。全呼び出し箇所を書き換えず、ストアの変更を debounce で DB に保存。 |

この峻別が設計の肝。コインをスナップショット同期すると親の承認を踏み潰すため、コインだけは必ずトランザクション。

---

## 3. DB スキーマ

コイン側は既存（`User.coinBalance` ＋ `CoinTransaction`）をそのまま使う。
在庫用に汎用テーブルを 1 つ追加する（Zustand の `InventoryMap = Record<string, number>` をそのまま写す）。

```prisma
// ゲーム内インベントリ（草・石・うんち・作物・素材など自由形式キー）。
// 1ユーザー×1itemKeyで1行。単一書き手のためスナップショット同期で運用。
model GameInventoryItem {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  itemKey   String   @map("item_key")   // "grass" / "stone" / "poop" / "carrot" / "wood_branch" ...
  quantity  Int      @default(0)
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, itemKey])
  @@index([userId])
  @@map("game_inventory_items")
}
```

> 既存の `Material`/`UserMaterial`/`UserTool`/`SharedInventoryItem` は当面そのまま（クレーン素材・道具マスタ）。
> ゲーム内の流動在庫は `GameInventoryItem` に一本化する。将来的に統廃合を検討。

---

## 4. サーバアクション

### コイン（`features/coins/actions.ts` 新設）
```ts
// 増分演算 ＋ 取引履歴を 1 トランザクションで。残高不足は例外。
adjustCoins(kidId, amount, kind, reason): { newCoinBalance }
```
- 牧場エサやり等の「DB 未反映だった減算」をこれ経由に変更。
- 既存の `/api/coins` POST と同じ思想（あちらは外部連携用 Route Handler）。

### 在庫（`features/inventory/actions.ts` 新設）
```ts
getInventory(kidId): InventoryMap                 // ロード時のハイドレート用
saveInventory(kidId, map: InventoryMap): void     // スナップショット保存（upsert / 0 は行削除 or 0 保持）
```
- `saveInventory` は debounce 経由でのみ呼ぶ（単一書き手なので last-write-wins で安全）。

---

## 5. ストア（useSafariStore）の変更

1. **ハイドレート用アクション追加**: `hydrateFromServer({ coins, inventory })` を追加し、ロード時に DB 値で**必ず上書き**。
2. **`initCoins` の `=== 0` ガード撤廃**（ロード時は DB 勝ち）。
3. **コインのローカル単独増減を撤廃**：`shipTruck` の経済部分を削除（未使用）。`addCoins`/`spendCoins` は「楽観更新 → 直後に必ず `syncCoins(server)`」のペア利用のみ許可（クレーン/クイズの既存方式）。牧場エサは `adjustCoins` の戻り値で `syncCoins`。
4. **在庫スナップショット同期**: `_hydrated` フラグを持ち、ハイドレート後の `inventory` 変更を debounce（例 800ms）で `saveInventory` に送る購読を `SafariLayoutShell` 内に置く。

---

## 6. ロード時ハイドレート

- [SafariLayoutShell](../app/kids/[kidId]/SafariLayoutShell.tsx) の `StoreInitializer` を、
  `kidId` ＋ DB の `coinBalance` ＋ `getInventory()` 結果で **毎マウント** `hydrateFromServer` するよう変更。
- これにより「親が Bank で付与 → 子のヘッダーに即反映」「リロードで DB と一致」を保証。

---

## 7. 表示の統一

- [GlobalHeader](../app/kids/[kidId]/GlobalHeader.tsx) のコインは Zustand ミラーのままで可（ハイドレートで DB と一致するため）。
- 卒業プレゼント（[warehouse](../app/kids/[kidId]/warehouse/WarehouseClient.tsx)）は戻り値 `newCoinBalance` で `syncCoins` を呼ぶよう修正。

---

## 8. 段階的ロールアウト

1. **Schema + migration**（`GameInventoryItem` 追加）。
2. **コイン**：`adjustCoins` 追加 → 牧場エサやりを置換 → 卒業 `syncCoins` 追加 → ロード時 DB 採用。
   - ここまでで「コインの二重管理」は解消（検証可能な独立スライス）。
3. **在庫**：`getInventory`/`saveInventory` 追加 → ストアに `hydrateFromServer` ＋ debounce 同期 → `StoreInitializer` で在庫ハイドレート。
4. **検証**：`prisma validate` / `tsc --noEmit` / 主要動線の手動確認（親承認→子反映、クレーン購入、牧場エサ、リロード一致）。

---

## 9. 非対象（今回やらない）

- `animalsInYard` / `logisticsQueue`（Zustand の動物キュー）と DB `CaughtAnimal` の統合。
- スタミナ・勲章・絆（Kizuna）の DB 化。
- 動物園のローカル玩具カウンタ（`gs.inventory`）。
- `Material`/`UserMaterial`/`UserTool` と `GameInventoryItem` の統廃合。
