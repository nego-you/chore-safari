// 子供3人の初期データを投入するシードスクリプト。
// 名前と生年月日（仮）、コイン残高は 0 で開始。

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ChildSeed = {
  name: string;
  birthDate: string; // YYYY-MM-DD
};

// 生年月日は仮のもの。あとで /bank などから差し替え可能にする予定。
const CHILDREN: ChildSeed[] = [
  { name: "美琴", birthDate: "2018-11-03" },
  { name: "幸仁", birthDate: "2021-03-11" },
  { name: "叶泰", birthDate: "2023-12-19" },
];

async function main() {
  // 既存ユーザーをクリアしてからシード（開発用途）。
  await prisma.coinTransaction.deleteMany();
  await prisma.user.deleteMany();

  for (const child of CHILDREN) {
    const created = await prisma.user.create({
      data: {
        name: child.name,
        birthDate: new Date(child.birthDate),
        role: "CHILD",
        coinBalance: 0,
      },
    });
    console.log(`Seeded child: ${created.name} (${created.id})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
