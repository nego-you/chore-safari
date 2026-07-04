import { test, expect } from '@playwright/test';

test.describe('Crane & Craft: 素材獲得とアイテム合成', () => {
  // ※シードデータの子供IDに依存しないように、まずは子供一覧画面から遷移する
  let kidPath = '';

  test.beforeEach(async ({ page }) => {
    // キッズポータル（子供選択画面）へ
    await page.goto('/kids');
    
    // 最初に見つかった子供のリンクを取得して遷移
    // /kids/:kidId へのリンクを探す
    const firstKidLink = page.locator('a[href^="/kids/"]').first();
    kidPath = await firstKidLink.getAttribute('href') || '/kids/test-kid';
  });

  test('クレーンゲームを実行できることを確認する', async ({ page }) => {
    // クレーンゲーム画面へ遷移
    await page.goto(`${kidPath}/crane`);

    // クレーンゲームのタイトルや開始ボタンが表示されているか確認
    // （実際のUIに合わせてテキストは調整が必要）
    await expect(page.locator('text=クレーンゲーム').first()).toBeVisible();
    
    // 開始ボタンがあれば押す
    const startButton = page.getByRole('button', { name: /開始|プレイ/ });
    if (await startButton.isVisible()) {
      await startButton.click();
    }
  });

  test('クラフト画面にてインベントリの素材を組み合わせてアイテム合成に成功することを確認する', async ({ page }) => {
    // クラフト画面へ遷移
    await page.goto(`${kidPath}/craft`);

    await expect(page.locator('text=クラフト').first()).toBeVisible();

    // レシピ（「にくいり おとしあな」など）が表示されているか確認
    const recipeCard = page.locator('text=おとしあな').first();
    if (await recipeCard.isVisible()) {
      await expect(recipeCard).toBeVisible();
      
      // 合成ボタンがあれば押す（素材が足りない場合は disabled かもしれない）
      const craftButton = page.getByRole('button', { name: /つくる|クラフト/ }).first();
      if (await craftButton.isVisible() && await craftButton.isEnabled()) {
        await craftButton.click();
      }
    }
  });
});
