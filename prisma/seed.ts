// 子供 + 共有インベントリ + どうぶつ図鑑マスタの初期データ投入。

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

type InventorySeed = {
  itemId: string;
  itemName: string;
  itemType: "FOOD" | "TRAP_PART";
  quantity: number;
};

// 共有倉庫の初期アイテム。
const INVENTORY: InventorySeed[] = [
  // エサ
  { itemId: "meat", itemName: "おにく", itemType: "FOOD", quantity: 1 },
  { itemId: "fish", itemName: "おさかな", itemType: "FOOD", quantity: 0 },
  { itemId: "berry", itemName: "きのみ", itemType: "FOOD", quantity: 0 },
  // 罠パーツ
  { itemId: "rope", itemName: "ロープ", itemType: "TRAP_PART", quantity: 3 },
  { itemId: "wood", itemName: "きのいた", itemType: "TRAP_PART", quantity: 0 },
  { itemId: "net", itemName: "あみ", itemType: "TRAP_PART", quantity: 0 },
];

type AnimalSeed = {
  animalId: string;
  name: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  description: string;
};

type QuestSeed = {
  title: string;
  description?: string;
  rewardCoins: number;
  emoji: string;
};

// 親が承認するクエスト一覧。子供3人共通で使えるイメージ。
const QUESTS: QuestSeed[] = [
  { title: "おふろそうじ", description: "おふろを ピカピカに してね", rewardCoins: 50, emoji: "🛁" },
  { title: "ほんを1さつよむ", description: "さいごまで よめたら しんこく", rewardCoins: 30, emoji: "📖" },
  { title: "あさ4時半におきる", description: "アラームを じぶんで とめて おきよう", rewardCoins: 100, emoji: "⏰" },
  { title: "おもちゃをかたづける", description: "リビングの おもちゃを ぜんぶ もとに もどす", rewardCoins: 20, emoji: "🧸" },
  { title: "おはなみずやり", description: "ベランダの おはなに みずを あげる", rewardCoins: 15, emoji: "🌱" },
  { title: "テストでまんてん", description: "がっこうの テスト 100てん", rewardCoins: 300, emoji: "💯" },
];

// 図鑑マスタ。rarity ごとに出やすさを exploreSafari 側で weight 設定する。
const ANIMALS: AnimalSeed[] = [
  // COMMON（よく でる）
  { animalId: "rabbit", name: "うさぎ", emoji: "🐰", rarity: "COMMON", description: "もりで いちばん おおく いる ふわふわさん" },
  { animalId: "squirrel", name: "りす", emoji: "🐿️", rarity: "COMMON", description: "きのみを ほっぺに ためる めいじん" },
  { animalId: "deer", name: "しか", emoji: "🦌", rarity: "COMMON", description: "おおきな つのが りっぱな もりの しんし" },
  { animalId: "boar", name: "いのしし", emoji: "🐗", rarity: "COMMON", description: "まっしぐらに はしる ちからもち" },
  // RARE（ときどき でる）
  { animalId: "fox", name: "きつね", emoji: "🦊", rarity: "RARE", description: "あしが はやくて つかまえにくい いたずらっこ" },
  { animalId: "wolf", name: "おおかみ", emoji: "🐺", rarity: "RARE", description: "ぐんれで くらす しんけんな ハンター" },
  { animalId: "bear", name: "くま", emoji: "🐻", rarity: "RARE", description: "ハチミツが だいすき。とっても パワフル" },
  // EPIC（たまに でる）
  { animalId: "lion", name: "ライオン", emoji: "🦁", rarity: "EPIC", description: "ひゃくじゅうの おう。たてがみが かっこいい" },
  { animalId: "elephant", name: "ぞう", emoji: "🐘", rarity: "EPIC", description: "おおきな はなが じざいに うごく ちょうろう" },
  { animalId: "tiger", name: "とら", emoji: "🐅", rarity: "EPIC", description: "しまもようの ハンター。およぐのも じょうず" },
  // LEGENDARY（めったに でない！）
  { animalId: "trex", name: "ティラノサウルス", emoji: "🦖", rarity: "LEGENDARY", description: "でんせつの だいきょうりゅう！" },
  { animalId: "dragon", name: "ドラゴン", emoji: "🐉", rarity: "LEGENDARY", description: "そらを とぶ でんせつの いきもの" },
  { animalId: "unicorn", name: "ユニコーン", emoji: "🦄", rarity: "LEGENDARY", description: "つのが きらきら かがやく ましんびじゅう" },
];

async function main() {
  // 既存ユーザー・履歴・捕獲記録をクリアしてからシード（開発用途）。
  await prisma.questSubmission.deleteMany();
  await prisma.specialBonusNotification.deleteMany();
  await prisma.caughtAnimal.deleteMany();
  await prisma.gachaTransaction.deleteMany();
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

  for (const item of INVENTORY) {
    const upserted = await prisma.sharedInventoryItem.upsert({
      where: { itemId: item.itemId },
      update: {
        itemName: item.itemName,
        itemType: item.itemType,
        quantity: item.quantity,
      },
      create: {
        itemId: item.itemId,
        itemName: item.itemName,
        itemType: item.itemType,
        quantity: item.quantity,
      },
    });
    console.log(
      `Seeded item: ${upserted.itemName} x${upserted.quantity} (${upserted.itemType})`,
    );
  }

  for (const animal of ANIMALS) {
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
    console.log(
      `Seeded animal: ${upserted.emoji} ${upserted.name} (${upserted.rarity})`,
    );
  }

  // クエスト：title をキーに upsert（同じ title が既にあれば報酬と説明を更新）。
  for (const quest of QUESTS) {
    // title に unique 制約は無いが、開発シード用途では title 一致で識別する。
    const existing = await prisma.quest.findFirst({ where: { title: quest.title } });
    const upserted = existing
      ? await prisma.quest.update({
          where: { id: existing.id },
          data: {
            description: quest.description ?? null,
            rewardCoins: quest.rewardCoins,
            emoji: quest.emoji,
            isActive: true,
          },
        })
      : await prisma.quest.create({
          data: {
            title: quest.title,
            description: quest.description ?? null,
            rewardCoins: quest.rewardCoins,
            emoji: quest.emoji,
          },
        });
    console.log(
      `Seeded quest: ${upserted.emoji} ${upserted.title} (+${upserted.rewardCoins})`,
    );
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
