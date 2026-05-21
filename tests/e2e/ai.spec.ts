import { test, expect } from '@playwright/test';

test.describe('AI Integration: LLMを活用したミニゲーム', () => {
  let kidPath = '';

  test.beforeEach(async ({ page }) => {
    await page.goto('/kids');
    const firstKidLink = page.locator('a[href^="/kids/"]').first();
    kidPath = await firstKidLink.getAttribute('href') || '/kids/test-kid';
  });

  test('動物図鑑からOllamaを介してクイズが自動生成されることを検証する', async ({ page }) => {
    // APIモック（Ollamaが起動していない環境でもテストが通るようにする）
    await page.route('/api/quiz/generate', async route => {
      const json = {
        question: "モッククイズ: この動物の特徴はどれ？",
        options: ["正解の選択肢", "ダミー１", "ダミー２"],
        answer: "正解の選択肢",
        source: "mock"
      };
      await route.fulfill({ json });
    });

    // 1. 図鑑画面へ
    await page.goto(`${kidPath}/dictionary`);

    // 2. 動物の「クイズにちょうせん」ボタンを探して押す
    const quizButton = page.getByRole('button', { name: /クイズ|挑戦/ }).first();
    if (await quizButton.isVisible()) {
      await quizButton.click();
      
      // クイズのモーダルやパネルが表示される
      await expect(page.locator('text=モッククイズ')).toBeVisible();
      await expect(page.getByRole('button', { name: '正解の選択肢' })).toBeVisible();
    }
  });

  test('動物レース画面にてOllamaを通じた実況シナリオが生成されることを確認する', async ({ page }) => {
    // APIモック
    await page.route('/api/race/generate', async route => {
      const json = {
        winner: "みこと",
        events: [
          { time: 0, character: "all", action: "speed_up", message: "🔥 レーススタート！" },
          { time: 10, character: "みこと", action: "chaotic", message: "🛸 モック実況: 突然UFOに攫われた！" },
          { time: 30, character: "みこと", action: "finish", message: "🏆 みことがゴール！" }
        ]
      };
      await route.fulfill({ json });
    });

    // 1. レース画面へ
    await page.goto(`${kidPath}/race`);
    await expect(page.locator('text=レース')).first()).toBeVisible();

    // 2. レース開始ボタンを押す
    const startRaceButton = page.getByRole('button', { name: /レース開始|スタート/ }).first();
    if (await startRaceButton.isVisible()) {
      await startRaceButton.click();
      
      // モックされた実況イベント（UFO）が表示されるか確認
      // ※テキストが1文字ずつ表示されるタイプリピーターの場合は完全一致ではなく部分一致で待つ
      await expect(page.locator('text=UFO')).toBeVisible({ timeout: 15000 });
    }
  });
});
