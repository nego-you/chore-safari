// 全 CHILD の coinBalance を 0 にリセットするワンショットスクリプト。
//
// 使い方（プロジェクトルートで）:
//   docker compose exec web npx tsx scripts/reset-coins.ts
//
// やること:
//   1. role=CHILD のユーザを列挙
//   2. 残高が 0 でない子だけを対象に、coinBalance を 0 にする
//   3. 同じトランザクション内で CoinTransaction (kind=ADJUSTMENT) に
//      「コイン全クリア」というマイナス取引を残す（履歴を消さないため）

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const children = await prisma.user.findMany({
    where: { role: "CHILD" },
    select: { id: true, name: true, coinBalance: true },
  });

  if (children.length === 0) {
    console.log("CHILD ロールのユーザがいません。何もしません。");
    return;
  }

  const targets = children.filter((c) => c.coinBalance !== 0);

  if (targets.length === 0) {
    console.log("すでに全員 0 コインです。何もしません。");
    return;
  }

  console.log("リセット対象:");
  for (const c of targets) {
    console.log(`  - ${c.name} (${c.id}): ${c.coinBalance} → 0`);
  }

  await prisma.$transaction(async (tx) => {
    for (const c of targets) {
      await tx.user.update({
        where: { id: c.id },
        data: { coinBalance: 0 },
      });
      await tx.coinTransaction.create({
        data: {
          userId: c.id,
          amount: -c.coinBalance,
          kind: "ADJUSTMENT",
          reason: "コイン全クリア（端数調整）",
        },
      });
    }
  });

  console.log(`✅ ${targets.length} 人ぶんの残高を 0 にリセットしました。`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
