// SSR（激レア）動物の追加シード。
// 既存の animals テーブルに upsert する（重複実行しても安全）。
// 実行: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-ssr.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ────────── 最強王モチーフ SSR 動物 ──────────
// rarity は LEGENDARY を使う（フロントの演出でLEGENDARYをSSRとして扱う）
const SSR_ANIMALS = [
  {
    animalId: "tyrannosaurus",
    name: "【恐竜王】ティラノサウルス",
    emoji: "🦖",
    rarity: "LEGENDARY" as const,
    description:
      "ちきゅうさいきょうの だいきょうりゅう。あごのちからは すべてを くだく！",
  },
  {
    animalId: "hercules_beetle",
    name: "【昆虫王】ヘラクレスオオカブト",
    emoji: "🪲",
    rarity: "LEGENDARY" as const,
    description:
      "こんちゅうかいの おう。じぶんの からだの 850ばいを もちあげる きわみの ちから！",
  },
  {
    animalId: "lion_king",
    name: "【百獣の王】ライオン",
    emoji: "🦁",
    rarity: "LEGENDARY" as const,
    description:
      "さばんなに たつ でんせつの おう。そのほえごえは 8キロさきまで とどく！",
  },
  {
    animalId: "megalodon",
    name: "【海帝】メガロドン",
    emoji: "🦈",
    rarity: "LEGENDARY" as const,
    description:
      "うみのそこに ねむる きょだいザメ。ホホジロザメの 3ばいの おおきさ！",
  },
  {
    animalId: "dragon_king",
    name: "【幻獣王】ドラゴン",
    emoji: "🐉",
    rarity: "LEGENDARY" as const,
    description:
      "そらと だいちを しらべる でんせつの りゅう。そのほのおは てつをも とかす！",
  },
];

async function main() {
  console.log("🔥 SSR 動物を追加中...");

  for (const animal of SSR_ANIMALS) {
    const upserted = await prisma.animal.upsert({
      where: { animalId: animal.animalId },
      update: {
        name: animal.name,
        emoji: animal.emoji,
        rarity: animal.rarity,
        description: animal.description,
      },
      create: {
        animalId: animal.animalId,
        name: animal.name,
        emoji: animal.emoji,
        rarity: animal.rarity,
        description: animal.description,
      },
    });
    console.log(`  ✅ ${upserted.emoji} ${upserted.name} (${upserted.rarity})`);
  }

  console.log("🎉 SSR 動物の追加が完了しました！");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
