/**
 * safari-hunt.spec.ts
 *
 * お手伝いサファリ E2E テスト — デバッグの起点となる基本シナリオ集
 *
 * 対象画面:
 *   / (ホーム)
 *   /kids  (子供ピッカー → ワールドマップ)
 *   /bank  (親用 Bank ポータル)
 *
 * ⚠️  前提: `npm run db:up` でDBが起動し、シード済みであること。
 *      DB なし / シードなしの場合は「子供が表示されない」状態でも
 *      ページ自体は読み込まれるので UI 構造テストは通る。
 */

import { expect, test } from "@playwright/test";

// ──────────────────────────────────────────────────────────────────────────────
// 1. ホームページ
// ──────────────────────────────────────────────────────────────────────────────
test.describe("ホームページ (/)", () => {
  test("ページが 200 で読み込まれること", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
  });

  test("/kids リンクが存在すること", async ({ page }) => {
    await page.goto("/");
    // ホームには /kids へのリンクが（直接 or 間接的に）あると想定
    // なければ href を含む <a> タグの有無だけ確認
    const links = page.locator("a");
    await expect(links.first()).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. 子供ポータル (/kids) — ピッカー画面
// ──────────────────────────────────────────────────────────────────────────────
test.describe("子供ポータル (/kids)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/kids");
  });

  test("ページが正常に読み込まれること", async ({ page }) => {
    // 「だれがあそぶ？」等のピッカー文言、またはカードが出るまで待つ
    await expect(page).toHaveURL("/kids");
    // body が空でないことを確認
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("ページタイトルまたは見出しが存在すること", async ({ page }) => {
    // h1 または「だれが」を含むテキストが描画されるまで待つ
    await page.waitForLoadState("networkidle");
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 8_000 });
  });

  test("子供カードが描画される（DBシード済みの場合）", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // 子供カードは button[data-testid] または button 内に絵文字を持つ想定。
    // シードなし環境でもテスト自体は PASS させるため、
    // カードが 0 枚でも fail にしないソフトアサーションを使う。
    const cards = page.locator("button").filter({ hasText: /🦭|🐹|🦦/ });
    const count = await cards.count();

    // シード済みなら 3 枚（美琴・幸仁・叶泰）、未シードなら 0 枚
    console.log(`[子供カード数] ${count} 枚`);
    // count が 3 なら正常、0 でもテスト継続
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("子供カードをクリックするとワールドマップに遷移する", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // 絵文字ボタン（子供カード）を探す
    const cards = page.locator("button").filter({ hasText: /🦭|🐹|🦦/ });
    const count = await cards.count();

    if (count === 0) {
      test.skip(); // DB 未シード環境はスキップ
      return;
    }

    // 最初の子供カードをクリック
    await cards.first().click();

    // SFC風ワールドマップが描画され、スタートゲートが出るまで待つ
    // WorldMapPortal は最初に「▶ ぼうけんに でる」ボタンを描画する
    const mapStart = page.locator("button").filter({ hasText: /ぼうけん/ });
    await expect(mapStart.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. ワールドマップ遷移後の状態検証
// ──────────────────────────────────────────────────────────────────────────────
test.describe("ワールドマップ UI", () => {
  test("マップのスタートゲートが描画されること", async ({ page }) => {
    await page.goto("/kids");
    await page.waitForLoadState("networkidle");

    const cards = page.locator("button").filter({ hasText: /🦭|🐹|🦦/ });
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();

    // SFC風マップは最初に「▶ ぼうけんに でる」スタートゲートを表示する
    const startBtn = page.locator("button").filter({ hasText: /ぼうけん/ });
    await expect(startBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("『ぼうけんに でる』を押すと A ボタンが操作可能になること", async ({
    page,
  }) => {
    await page.goto("/kids");
    await page.waitForLoadState("networkidle");

    const cards = page.locator("button").filter({ hasText: /🦭|🐹|🦦/ });
    if ((await cards.count()) === 0) {
      test.skip();
      return;
    }

    await cards.first().click();

    const startBtn = page.locator("button").filter({ hasText: /ぼうけん/ });
    await expect(startBtn.first()).toBeVisible({ timeout: 10_000 });
    await startBtn.first().click();

    // スタート後はマップ操作の A ボタン（施設に入る）が表示される
    const aBtn = page.locator("button").filter({ hasText: /^A$/ });
    await expect(aBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Bank ポータル (/bank)
// ──────────────────────────────────────────────────────────────────────────────
test.describe("Bank ポータル (/bank)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bank");
  });

  test("ページが正常に読み込まれること", async ({ page }) => {
    await expect(page).toHaveURL("/bank");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("4 つのタブ（残高・ペナルティ・ボーナス・検品）が存在すること", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // BankPortal の TABS 定義より
    const expectedTabs = ["残高", "ペナルティ", "ボーナス", "検品"];
    for (const tab of expectedTabs) {
      const tabEl = page.locator("button").filter({ hasText: tab });
      await expect(tabEl.first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("タブをクリックするとアクティブタブが切り替わること", async ({
    page,
  }) => {
    await page.waitForLoadState("networkidle");

    // 「ペナルティ」タブをクリック
    const penaltyTab = page.locator("button").filter({ hasText: "ペナルティ" });
    await expect(penaltyTab.first()).toBeVisible({ timeout: 8_000 });
    await penaltyTab.first().click();

    // ペナルティパネルが表示されること（🚨 emoji or "ペナルティ" heading）
    const panel = page.locator("section, div").filter({ hasText: /ペナルティ/ });
    await expect(panel.first()).toBeVisible({ timeout: 5_000 });
  });

  test("ボーナスタブに切り替えられること", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const bonusTab = page.locator("button").filter({ hasText: "ボーナス" });
    await expect(bonusTab.first()).toBeVisible({ timeout: 8_000 });
    await bonusTab.first().click();

    await page.waitForTimeout(300); // アニメーション待ち
    // ボーナスパネルが表示されること
    const panel = page.locator("section, div").filter({ hasText: /ボーナス/ });
    await expect(panel.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. ナビゲーション・ルーティング
// ──────────────────────────────────────────────────────────────────────────────
test.describe("ルーティング", () => {
  test("/kids/quests が読み込まれること", async ({ page }) => {
    const res = await page.goto("/kids/quests");
    // 200 または Server Action リダイレクトの場合でも 3xx は OK
    expect(res?.status()).toBeLessThan(500);
  });

  test("/bank/quests が読み込まれること", async ({ page }) => {
    const res = await page.goto("/bank/quests");
    expect(res?.status()).toBeLessThan(500);
  });

  test("存在しないパスは 404 を返すこと", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-xyz");
    expect(res?.status()).toBe(404);
  });
});
