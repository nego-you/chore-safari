import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("コイン残高と取引履歴を完全に削除します...");

  const deletedTx = await prisma.coinTransaction.deleteMany();
  console.log(`削除した取引履歴: ${deletedTx.count} 件`);

  const users = await prisma.user.updateMany({
    data: { coinBalance: 0 },
  });
  console.log(`残高を0にしたユーザー: ${users.count} 人`);

  console.log("✅ コイン関連データを完全にリセットしました。");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
