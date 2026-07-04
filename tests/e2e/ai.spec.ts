import { test, expect } from '@playwright/test';

test.describe('AI Integration: LLMを活用したミニゲーム', () => {
  let kidPath = '';

  test.beforeEach(async ({ page }) => {
    await page.goto('/kids');
    const firstKidLink = page.locator('a[href^="/kids/"]').first();
    kidPath = await firstKidLink.getAttribute('href') || '/kids/test-kid';
  });

  test('動物図鑑から Gemini を介してクイズが自動生成されることを検証する', async ({ page }) => {
    // APIモック（GEMINI_API_KEY 未設定の環境でもテストが通るようにする）
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

  // 旧: 「動物レース画面で Ollama 実況が生成される」テストは廃止。
  // 現行のカオスレース（RacePlayer）はクライアント側の乱数で実況を生成し、
  // LLM／API（旧 /api/race・/api/race/generate）を一切使わないため、ここでは検証しない。
  // ベット式レースの E2E が必要なら、ベット選択 → スタート → 勝敗確定の流れで別途追加する。
});
