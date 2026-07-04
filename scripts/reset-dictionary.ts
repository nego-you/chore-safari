import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("図鑑（捕獲履歴）と進行中の狩りデータを削除します...");

  const deletedHunts = await prisma.hunt.deleteMany();
  console.log(`削除した進行中の狩りデータ: ${deletedHunts.count} 件`);

  const deletedCatches = await prisma.caughtAnimal.deleteMany();
  console.log(`削除した図鑑（捕獲）データ: ${deletedCatches.count} 件`);

  console.log("✅ 図鑑・狩りデータをリセットしました。");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
