# Chore Safari — 新エコシステム移行ロードマップ

**作成日**: 2026-05-25  
**対象**: 全開発メンバー  
**目的**: 「狩り・武器」世界観からの完全脱却と、DB不整合バグ2件の根本解消

---

## 目次

1. [改修の全体像](#1-改修の全体像)
2. [ステップ1：DBスキーマ改修案](#2-ステップ1dbスキーマ改修案)
3. [ステップ2：App Routerディレクトリ再編案](#3-ステップ2app-routerディレクトリ再編案)
4. [ステップ3：移行・不整合解消ロードマップ](#4-ステップ3移行不整合解消ロードマップ)
5. [既知バグの解消戦略](#5-既知バグの解消戦略)
6. [Zustand利用ガイドライン](#6-zustand利用ガイドライン)

---

## 1. 改修の全体像

### 廃止するもの（旧世界観）

| 旧 | 新 | 理由 |
|---|---|---|
| `Hunt` モデル | `TameSession` | 「狩り」→「テイム（仲間入り）」 |
| `Tool` モデル | `TameItemMaster` | 武器・罠 → 楽器・おもちゃ・誘いエサ |
| `HuntType` enum | `TameMethod` | TRAP/BOW/SPEAR/WEAPON → LURE/MUSIC/TOY/SONG |
| `HuntStatus` enum | `TameStatus` | CAUGHT/ESCAPED → BEFRIENDED/FLED |
| `ToolType` enum | `TameMethod` | 同上 |
| `UserTool` モデル | `UserInventoryItem` (MUSIC_ITEM/TOY) | 統合インベントリへ |
| `UserMaterial` モデル | `UserInventoryItem` (MATERIAL) | 統合インベントリへ |
| `CoinTxKind.PENALTY` | `CoinTxKind.DONATION` | 「寄付」として温かく表現 |
| `PenaltyNotification` モデル | `DonationNotification` | 同上 |
| `app/kids/[kidId]/safari/hunt/` | `app/kids/[kidId]/field/[stageId]/` | ルート刷新 |
| `app/kids/[kidId]/craft/` | `app/kids/[kidId]/workshop/` | 武器クラフト廃止 |
| `app/kids/[kidId]/crane/` + `race/` | `app/kids/[kidId]/arcade/` 配下へ | ゲームセンターへ集約 |
| `app/kids/[kidId]/house/` | `app/kids/[kidId]/basecamp/` | 世界観統一 |

### 新設するもの

- `TameSession`, `TameItemMaster`, `AnimalCompanion`, `AnimalCareLog`
- `PoopLog`, `FarmPlot`, `NpcRelation`
- `UserInventoryItem`（統合インベントリ）
- `User.staminaCurrent/staminaMax/staminaLastUpdatedAt`
- `AnimalCompanion.currentLocation / hungerLevel / moodLevel / lastFedAt / lastPlayedAt`
- `app/kids/[kidId]/farm/`, `zoo/`, `garden/`, `arcade/`
- `actions/` ディレクトリ（Server Actions の集約）

---

## 2. ステップ1：DBスキーマ改修案

詳細なスキーマコードは `prisma/schema.proposed.prisma` を参照。  
以下では変更点を設計意図とともに解説する。

### 2-1. スタミナ管理（User モデルへの追加）

```prisma
model User {
  // 既存フィールド省略...

  // ── スタミナ管理（新規追加） ────────────────────────────
  staminaCurrent       Int       @default(100) @map("stamina_current")
  staminaMax           Int       @default(100) @map("stamina_max")
  staminaLastUpdatedAt DateTime  @default(now()) @map("stamina_last_updated_at")
}
```

**設計のポイント**

- `staminaCurrent` はDBに保存するが、画面表示時は `lib/stamina.ts` で `(now() - staminaLastUpdatedAt)` の経過時間から現在値を動的に計算する。
- 消費 Server Action 実行時に計算→書き込みを1トランザクションで行う。これにより Zustand への依存ゼロで正確な値を維持できる。
- `staminaMax` はユーザーレベルに応じて将来拡張可能な設計。

```typescript
// lib/stamina.ts
const STAMINA_REGEN_PER_HOUR = 10; // 1時間に10回復

export function calcCurrentStamina(
  base: number,
  max: number,
  lastUpdatedAt: Date
): number {
  const hoursElapsed = (Date.now() - lastUpdatedAt.getTime()) / 3_600_000;
  return Math.min(max, base + Math.floor(hoursElapsed * STAMINA_REGEN_PER_HOUR));
}
```

### 2-2. 動物の空腹度・機嫌・配置場所（AnimalCompanion）

```prisma
enum AnimalLocation {
  BASECAMP      // 仲間になったばかり／ふれあい場所（デフォルト）
  FARM          // 牧場（糞を落とす・エサが必要）
  ZOO           // 動物園（展示・来場者へ見せる）
  HALL_OF_FAME  // 殿堂（寿命を全うした記念）
}

model AnimalCompanion {
  // ── 配置場所（Single Source of Truth）──
  currentLocation  AnimalLocation  @default(BASECAMP)
  farmPlotId       String?         // FARM配置時の区画ID（null=区画未割当）
  farmPlot         FarmPlot?       @relation(...)
  assignedAt       DateTime        @default(now())

  // ── 動物のステータス ──
  hungerLevel      Int             @default(80)  // 0=空腹〜100=満腹
  moodLevel        Int             @default(80)  // 0=不機嫌〜100=上機嫌
  lastFedAt        DateTime?                     // 空腹度の計算基準
  lastPlayedAt     DateTime?                     // 機嫌の計算基準
}
```

**設計のポイント**

`hungerLevel`・`moodLevel` の現在値は `lastFedAt` / `lastPlayedAt` から算出する。

```typescript
// lib/animal-status.ts
const HUNGER_DECAY_PER_HOUR = 5;   // 1時間で空腹度-5
const MOOD_DECAY_PER_HOUR   = 3;   // 1時間で機嫌-3

export function calcHungerLevel(lastFedAt: Date | null, dbValue: number): number {
  if (!lastFedAt) return dbValue;
  const hours = (Date.now() - lastFedAt.getTime()) / 3_600_000;
  return Math.max(0, dbValue - Math.floor(hours * HUNGER_DECAY_PER_HOUR));
}

export function calcMoodLevel(lastPlayedAt: Date | null, dbValue: number): number {
  if (!lastPlayedAt) return dbValue;
  const hours = (Date.now() - lastPlayedAt.getTime()) / 3_600_000;
  return Math.max(0, dbValue - Math.floor(hours * MOOD_DECAY_PER_HOUR));
}
```

Ollama プロンプトには `moodLevel` を渡し、機嫌が悪いときは口調を変える。

```typescript
// lib/ai-guide.ts 内のコンテキスト生成
const moodContext =
  moodLevel >= 70 ? "とても機嫌がいい" :
  moodLevel >= 40 ? "普通の状態" :
                    "機嫌が悪く、返事が素っ気ない";
```

### 2-3. エコサイクル関連モデル

```
牧場の動物（FARM配置）
    ↓ hungerLevel > 50 かつ一定時間経過で PoopLog が自動生成
PoopLog（isCollected=false）
    ↓ 子供が牧場画面で「回収」ボタンを押す
UserInventoryItem (category=POOP, quantity+1)
    ↓ 工房でクラフト
UserInventoryItem (category=FERTILIZER)
    ↓ 農場（garden）に投入
FarmPlot.fertilized=true → readyAt 短縮
    ↓ readyAt を過ぎたら収穫
UserInventoryItem (category=CROP)
    ↓ 世話アクション FEED でエサとして使用
AnimalCareLog (actionType=FEED) + AnimalCompanion.hungerLevel 更新
```

### 2-4. インベントリ統合

旧 `UserMaterial`・`UserTool`・`SharedInventoryItem` を廃止し、`UserInventoryItem` に一本化する。

```prisma
enum ItemCategory {
  MATERIAL    // 素材（クレーンゲームドロップ）
  LURE        // 誘いエサ（クラフト品）
  TOY         // おもちゃ（クラフト品）
  MUSIC_ITEM  // 楽器（クラフト品・消耗しない）
  ANIMAL_FOOD // 動物のエサ（加工済みの食べ物）
  CROP        // 収穫物（農場から。エサ加工の元）
  FERTILIZER  // 肥料（糞から生成）
  POOP        // 糞（牧場で回収）
  CRAFT_TOOL  // 工房ツール（スタミナ軽減等・消耗しない）
}

model UserInventoryItem {
  userId   String
  itemId   String       // "wood_branch" / "ocarina" / "carrot" 等
  itemName String
  category ItemCategory
  quantity Int          @default(0)
  @@unique([userId, itemId])
}
```

UI では `category` でタブ分けして表示する（素材タブ・道具タブ・食材タブ等）。

---

## 3. ステップ2：App Routerディレクトリ再編案

### ルーティングツリー

```
app/
├── api/
│   ├── alexa/
│   ├── chat/           ← 新設: Ollama AI対話エンドポイント
│   ├── manifest/
│   ├── quiz/
│   └── race/
│
├── bank/               ← 変更なし（親用ポータル）
│   ├── dev/
│   ├── penalties/
│   ├── quests/
│   └── page.tsx
│
└── kids/
    ├── page.tsx         ← 子供選択
    └── [kidId]/
        ├── page.tsx     ← ワールドマップ（全施設へのハブ）
        │
        ├── basecamp/          ← 旧 house/（リネーム）
        │   ├── page.tsx       　  仲間一覧・ふれあいハブ
        │   └── [companionId]/
        │       └── page.tsx      AI会話・エサやり・おもちゃ
        │
        ├── field/             ← 旧 safari/ + safari/hunt/（統合・リネーム）
        │   ├── page.tsx          ステージ選択マップ
        │   └── [stageId]/
        │       └── page.tsx      テイムゲーム（タイミングゲーム）
        │
        ├── farm/              ← 新設
        │   ├── page.tsx          牧場全体（配置動物・糞回収）
        │   └── [plotId]/
        │       └── page.tsx      区画詳細・動物の世話
        │
        ├── zoo/               ← 新設
        │   └── page.tsx          展示動物一覧
        │
        ├── garden/            ← 新設
        │   └── page.tsx          農場区画・野菜育成
        │
        ├── workshop/          ← 旧 craft/（リネーム・レシピ刷新）
        │   └── page.tsx
        │
        ├── arcade/            ← 新設（旧 crane/ + race/ を統合）
        │   ├── page.tsx          ゲームセンターハブ
        │   ├── crane/
        │   │   └── page.tsx
        │   └── race/
        │       └── page.tsx
        │
        ├── dictionary/        ← 変更なし
        │   ├── page.tsx
        │   └── [animalId]/
        │       └── page.tsx
        │
        ├── guild/             ← 変更なし
        │   └── page.tsx
        │
        └── warehouse/         ← 機能拡張（カテゴリタブ追加）
            └── page.tsx
```

### 旧→新 URL マッピング（リダイレクト設定）

`next.config.js` に以下の `redirects` を追加して旧URLのリンク切れを防ぐ。

```javascript
// next.config.js
async redirects() {
  return [
    { source: '/kids/:kidId/house/:path*',        destination: '/kids/:kidId/basecamp/:path*',  permanent: true },
    { source: '/kids/:kidId/safari/:path*',       destination: '/kids/:kidId/field/:path*',     permanent: true },
    { source: '/kids/:kidId/craft',               destination: '/kids/:kidId/workshop',         permanent: true },
    { source: '/kids/:kidId/crane',               destination: '/kids/:kidId/arcade/crane',     permanent: true },
    { source: '/kids/:kidId/race',                destination: '/kids/:kidId/arcade/race',      permanent: true },
  ];
}
```

---

## 4. ステップ3：移行・不整合解消ロードマップ

**基本方針**: 既存コードを段階的に置き換え、各フェーズ末に本番リリース可能な状態を維持する。

---

### Phase A — 基盤固め・バグ緊急修正（推定 2〜3 週間）

> **目標**: 既存コードを壊さずに、2つのバグを根本から塞ぐ。

#### A-1. コイン DB 不整合の解消（最優先）

**問題**: `coinBalance` の増減が Zustand や localStorage 上でのみ行われており、DBと乖離している。

**解消手順**:

1. `actions/coin.ts` を新設し、コイン増減の唯一の入口を作る。

```typescript
// actions/coin.ts
'use server'
import { prisma } from '@/lib/prisma';

export async function addCoins(
  userId: string,
  amount: number,
  kind: CoinTxKind,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.coinBalance + amount < 0) throw new Error('INSUFFICIENT_COINS');

    const [updated] = await Promise.all([
      tx.user.update({
        where: { id: userId },
        data: { coinBalance: { increment: amount } },
      }),
      tx.coinTransaction.create({
        data: { userId, amount, kind, reason },
      }),
    ]);
    return updated.coinBalance;
  });
}
```

2. 既存の Zustand のコイン操作（`store/useSafariStore.ts` 内の `incrementCoins` 等）を `addCoins` Server Action 呼び出しに置き換える。
3. Zustand からコイン残高の保持を削除。DBから取得した値のみを表示に使う。

**既存データのマイグレーション**: DB の `coinBalance` と Zustand の値が乖離している場合、移行スクリプト（`scripts/reconcile-coins.ts`）を作成し、取引履歴の合計から正しい残高を再計算して上書きする。

```typescript
// scripts/reconcile-coins.ts
const users = await prisma.user.findMany({ include: { transactions: true } });
for (const user of users) {
  const correct = user.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  await prisma.user.update({
    where: { id: user.id },
    data: { coinBalance: correct },
  });
}
```

#### A-2. 動物配置ロジックの欠如の解消

**問題**: `CaughtAnimal` に `locationId` が明示的に存在せず、牧場等の画面で全動物が無条件に表示されてしまっている。

**解消手順**:

1. 既存 `schema.prisma` に `currentLocation` フィールドを追加するマイグレーションを作成（デフォルト `BASECAMP`）。

```sql
-- prisma migration SQL（自動生成）
ALTER TABLE "caught_animals" 
  ADD COLUMN "current_location" TEXT NOT NULL DEFAULT 'BASECAMP';
```

2. 牧場・動物園の表示クエリに `where: { currentLocation: 'FARM' }` を追加する。

```typescript
// 牧場ページ: app/kids/[kidId]/farm/page.tsx
const farmAnimals = await prisma.caughtAnimal.findMany({
  where: { userId: kidId, currentLocation: 'FARM', isAlive: true },
  include: { animal: true },
});
```

3. 配置変更の Server Action を新設する。

```typescript
// actions/companion.ts
'use server'
export async function assignLocation(
  companionId: string,
  location: 'BASECAMP' | 'FARM' | 'ZOO',
  farmPlotId?: string
) {
  return prisma.caughtAnimal.update({
    where: { id: companionId },
    data: { currentLocation: location, farmPlotId: farmPlotId ?? null, assignedAt: new Date() },
  });
}
```

#### A-3. クエスト承認フローの徹底

親の承認 Server Action に `addCoins` を組み込み、承認とコイン付与を必ず同一トランザクションで行う。

```typescript
// actions/quest.ts
'use server'
export async function approveSubmission(submissionId: string) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.questSubmission.findUniqueOrThrow({
      where: { id: submissionId },
      include: { quest: true },
    });
    await tx.questSubmission.update({
      where: { id: submissionId },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    });
    await tx.user.update({
      where: { id: submission.userId },
      data: { coinBalance: { increment: submission.quest.rewardCoins } },
    });
    await tx.coinTransaction.create({
      data: {
        userId: submission.userId,
        amount: submission.quest.rewardCoins,
        kind: 'CHORE',
        reason: `クエスト承認: ${submission.quest.title}`,
      },
    });
  });
}
```

---

### Phase B — 世界観の書き換え（推定 3〜4 週間）

> **目標**: `Hunt`/`Weapon` を完全廃止し、新モデルに置き換える。

#### B-1. DBマイグレーション（旧→新モデル）

`prisma/schema.proposed.prisma` を正式な `schema.prisma` として適用する。

**移行順序**（依存関係を考慮した削除順）:

1. `hunts` テーブルのデータを `tame_sessions` へ変換するデータマイグレーション  
   （`huntType=TRAP` → `method='LURE'`、`CAUGHT` → `BEFRIENDED`、`ESCAPED` → `FLED`）
2. `user_tools` + `user_materials` のデータを `user_inventory` へ移行
3. `tools` テーブルを `tame_item_masters` として再定義
4. 旧テーブルを DROP

```typescript
// prisma/migrations/[timestamp]_world_overhaul/migration.ts
// ① hunts → tame_sessions へのデータ移行
await prisma.$executeRaw`
  INSERT INTO tame_sessions (id, user_id, method, lure_item_id, status, started_at, approaches_at, target_animal_id, resolved_at, pos_x, pos_y)
  SELECT 
    id,
    user_id,
    CASE hunt_type 
      WHEN 'TRAP' THEN 'LURE'
      WHEN 'BOW'  THEN 'MUSIC'
      WHEN 'SPEAR' THEN 'TOY'
      ELSE 'LURE'
    END,
    bait_item_id,
    CASE status
      WHEN 'PLACED'   THEN 'APPROACHING'
      WHEN 'APPEARED' THEN 'APPEARED'
      WHEN 'CAUGHT'   THEN 'BEFRIENDED'
      WHEN 'ESCAPED'  THEN 'FLED'
    END,
    placed_at,
    appears_at,
    target_animal_id,
    resolved_at,
    pos_x,
    pos_y
  FROM hunts
`;
```

#### B-2. ルーティングのリネーム

`app/kids/[kidId]/` 以下のディレクトリを以下の順でリネームする。各リネーム後は `next.config.js` に redirect を追加して旧 URL のリンク切れを防ぐ。

| 旧パス | 新パス | 作業 |
|---|---|---|
| `house/` | `basecamp/` | ディレクトリリネーム + redirect |
| `safari/` | `field/` | ディレクトリリネーム + redirect |
| `safari/hunt/` | `field/[stageId]/` | 動的ルートに変更 |
| `craft/` | `workshop/` | ディレクトリリネーム + redirect |
| `crane/` | `arcade/crane/` | 移動 + redirect |
| `race/` | `arcade/race/` | 移動 + redirect |

#### B-3. シードデータの更新

- `Tool` シードデータ（弓・槍・罠）を `TameItemMaster`（オカリナ・ボール・木の実）に差し替え
- `Animal` シードデータに `preferredTameMethod`・`favoriteFoodId` を追加
- 旧 `HuntType`・`ToolType` enum 値をすべて削除

---

### Phase C — エコサイクル実装（推定 3〜4 週間）

> **目標**: 牧場・農場・糞サイクル・スタミナを動かす。

#### C-1. スタミナシステム

```typescript
// actions/stamina.ts
'use server'
export async function consumeStamina(userId: string, cost: number) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const current = calcCurrentStamina(
      user.staminaCurrent, user.staminaMax, user.staminaLastUpdatedAt
    );
    if (current < cost) throw new Error('STAMINA_DEPLETED');
    return tx.user.update({
      where: { id: userId },
      data: { staminaCurrent: current - cost, staminaLastUpdatedAt: new Date() },
    });
  });
}
```

スタミナ枯渇時は行動ボタンをグレーアウトし、「眺めるだけ」「図鑑を読む」「AIと話す」ボタンは常にアクティブにしておく。

#### C-2. 動物の世話・糞サイクル

1. `AnimalCareLog` の記録 Server Action（`actions/companion.ts` の `feedAnimal`・`playWithAnimal`）
2. `PoopLog` の自動生成ロジック（FARM 配置動物 + 満腹度 > 50 + 最終排泄から N 時間経過で生成）
3. 牧場画面に「回収する」ボタンを設置し、`isCollected=true` + `UserInventoryItem(POOP) +1` を同一トランザクションで実行

#### C-3. 農場・野菜育成

1. `FarmPlot` の CRUD Server Actions（`actions/farm.ts`）
2. `fertilized=true` にすると `readyAt` を短縮するロジック
3. 収穫 Action で `FarmPlot.status=EMPTY` にリセット + `UserInventoryItem(CROP) +1`

---

### Phase D — ゲームセンター・恩送り・最終調整（推定 2〜3 週間）

> **目標**: 娯楽施設の統合と恩送りイベントの拡張で全体を完成させる。

#### D-1. Arcade（ゲームセンター）の完成

- `app/kids/[kidId]/arcade/` のハブ画面を作成
- `crane/`・`race/` を `arcade/` 配下に移動し、旧 URL に redirect を設定
- クレーンゲームのコイン消費を `addCoins`（負の amount）経由に統一

#### D-2. 恩送りイベントの拡張

```typescript
// actions/kizuna.ts
'use server'
export async function helpNpc(userId: string, npcId: string, itemId: string) {
  return prisma.$transaction(async (tx) => {
    // インベントリからアイテム消費
    await tx.userInventoryItem.updateMany({
      where: { userId, itemId },
      data: { quantity: { decrement: 1 } },
    });
    // NPC関係を更新
    await tx.npcRelation.upsert({
      where: { userId_npcId: { userId, npcId } },
      create: { userId, npcId, npcName: NPC_NAMES[npcId], helpCount: 1, lastHelpedAt: new Date() },
      update: { helpCount: { increment: 1 }, lastHelpedAt: new Date() },
    });
    // kizunaPoints を加算
    await tx.user.update({
      where: { id: userId },
      data: { kizunaPoints: { increment: KIZUNA_PER_HELP } },
    });
  });
}

// 台風ピンチ時の救済チェック
export async function checkKizunaRescue(userId: string, npcId: string) {
  const relation = await prisma.npcRelation.findUnique({
    where: { userId_npcId: { userId, npcId } },
  });
  if (!relation || relation.rewardGiven || relation.helpCount < 3) return null;
  // 恩返しイベントを発動
  await prisma.npcRelation.update({
    where: { id: relation.id },
    data: { rewardGiven: true },
  });
  return { eventType: 'RESCUE', npcId };
}
```

#### D-3. E2E テストの更新

- `tests/e2e/` 内の Hunt/Safari 系テストを TameSession/Field 系に書き換え
- コイン残高の検証を Zustand ではなく DB クエリで行うように変更
- 動物配置ロジックの E2E テストを新規追加

---

## 5. 既知バグの解消戦略

### バグ1: コインの DB 不整合

| 項目 | 内容 |
|---|---|
| **根本原因** | Zustand store の `coinBalance` が DB と別管理されており、リロードで値がリセットされたり、複数タブで乖離が生じる |
| **解消フェーズ** | **Phase A-1**（最優先・1週間以内） |
| **解消方法** | `actions/coin.ts` に集約した Server Action 経由でのみ増減 → DB が Single Source of Truth |
| **検証方法** | `scripts/reconcile-coins.ts` で既存データを修正 → E2E テストで DB 値と画面表示の一致を確認 |

### バグ2: 動物配置ロジックの欠如

| 項目 | 内容 |
|---|---|
| **根本原因** | `CaughtAnimal` に `currentLocation` フィールドがなく、牧場の表示クエリに絞り込み条件がない |
| **解消フェーズ** | **Phase A-2**（Phase A-1 と並行） |
| **解消方法** | マイグレーションで `current_location` カラムを追加（デフォルト `BASECAMP`）→ 各エリアの表示クエリに `where` 条件を追加 |
| **検証方法** | 動物を配置 → 別のエリアに移動 → 元のエリアに表示されないことを E2E テストで検証 |

---

## 6. Zustand利用ガイドライン

### ✅ Zustand で管理してよいもの（UI状態）

```typescript
// store/useUIStore.ts
interface UIState {
  isModalOpen: boolean;
  toastMessage: string | null;
  isAnimating: boolean;
  selectedCompanionId: string | null;
}

// store/useSafariStore.ts
interface SafariState {
  timingGamePhase: 'idle' | 'approaching' | 'active' | 'result';
  fieldAnimationState: 'walking' | 'running' | 'hiding';
  recentResultType: 'befriended' | 'fled' | null;
}
```

### ❌ Zustand で管理してはいけないもの（DB状態）

```typescript
// 以下は Zustand から削除し、Server Actions / RSC から取得する
// coinBalance    → prisma.user.coinBalance
// staminaCurrent → calcCurrentStamina() で動的計算
// companions     → prisma.animalCompanion.findMany()
// inventory      → prisma.userInventoryItem.findMany()
// hungerLevel    → calcHungerLevel() で動的計算
// moodLevel      → calcMoodLevel() で動的計算
```

### データフロー図

```
[子供の操作]
    │
    ▼
[Client Component] ─── useTransition / useFormStatus（ローディング UI）
    │
    ▼
[Server Action (actions/*.ts)]
    │
    ├── prisma.$transaction([...]) ── DB更新
    │
    └── return { 新しい状態 }
         │
         ▼
    [Client Component が再レンダリング]
    ※ Zustand には UI 状態（アニメーション等）のみ書き込む
```

---

## 付録：移行チェックリスト

### Phase A 完了条件
- [ ] `actions/coin.ts` が実装され、全コイン操作がここを経由している
- [ ] `reconcile-coins.ts` を実行し、全ユーザーの残高が取引履歴と一致している
- [ ] `CaughtAnimal.currentLocation` のマイグレーションが完了している
- [ ] 牧場・動物園・BaseCamp の表示クエリに `where: { currentLocation }` が追加されている
- [ ] クエスト承認が `approveSubmission` Server Action のトランザクション内で行われている

### Phase B 完了条件
- [ ] `Hunt`・`Tool` 関連のモデル・enum が DB から削除されている
- [ ] `TameSession`・`TameItemMaster` のシードデータが投入されている
- [ ] 旧 URL への redirect が `next.config.js` に設定されている
- [ ] `house/`・`safari/`・`craft/` ディレクトリが削除されている

### Phase C 完了条件
- [ ] スタミナの消費・回復が Server Action 経由で動作している
- [ ] 牧場の動物が時間経過で `PoopLog` を生成している
- [ ] 糞→肥料→野菜→エサのエコサイクルがエンドツーエンドで動作している

### Phase D 完了条件
- [ ] Arcade ハブが動作し、crane/race が arcade/ 配下に統合されている
- [ ] `helpNpc` と `checkKizunaRescue` が実装されている
- [ ] E2E テストが旧 Hunt 系から新 TameSession 系に更新されている
- [ ] Zustand から DB 状態（コイン・スタミナ・インベントリ）が完全に削除されている

---

**作成者**: Claude
**最終更新**: 2026-05-25
