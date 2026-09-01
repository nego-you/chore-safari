// ─────────────────────────────────────────────────────────────────────────────
// 動物マスタの「非破壊」シンク。
//
//   db:seed（破壊的・進捗を消す）とは違い、本スクリプトは:
//     1) 旧・幻獣（REMOVED_ANIMAL_IDS）を DB から削除（実在動物のみ方針）
//     2) 実在の王者（RELOCATIONS）を実在ステージへ移設
//     3) 新種（EXTRA_ANIMALS）を upsert（既存は更新・無ければ作成）
//     4) 空になった不要ステージ（REMOVED_STAGE_IDS）を削除
//   だけを行う。user / coin / caughtAnimal を deleteMany しないので、
//   家族の進捗を消さずに図鑑だけを更新できる。
//
// 実行:  npm run db:animals
//        （DB が起動している必要あり: npm run db:up）
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import {
  EXTRA_ANIMALS,
  ERA_BY_STAGE,
  LOCATION_BY_STAGE,
  REMOVED_ANIMAL_IDS,
  RELOCATIONS,
  REMOVED_STAGE_IDS,
  GENERIC_NAME_MERGES,
} from "./animals-extra";

const prisma = new PrismaClient();

async function main() {
  console.log("🦁 animals 非破壊シンク 開始\n");

  // 1) 旧・幻獣を削除（CaughtAnimal は cascade 連動削除）
  if (REMOVED_ANIMAL_IDS.length > 0) {
    const del = await prisma.animal.deleteMany({
      where: { animalId: { in: REMOVED_ANIMAL_IDS } },
    });
    console.log(`🗑  幻獣を削除: ${del.count} 種`);
  }

  // 2) 実在の王者を実在ステージへ移設（stageId / era / location を更新）
  for (const r of RELOCATIONS) {
    const stage = await prisma.stage.findUnique({ where: { stageId: r.stageId } });
    if (!stage) {
      console.warn(`  ! ステージ未検出: ${r.stageId}（${r.animalId} の移設をスキップ）`);
      continue;
    }
    const res = await prisma.animal.updateMany({
      where: { animalId: r.animalId },
      data: {
        stageId: stage.id,
        era: ERA_BY_STAGE[r.stageId] ?? "げんだい（いま）",
        location: LOCATION_BY_STAGE[r.stageId] ?? "せかいかくち",
      },
    });
    if (res.count > 0) console.log(`↪  移設: ${r.animalId} → ${r.stageId}`);
  }

  // 3) 新種を upsert
  let added = 0;
  let updated = 0;
  for (const a of EXTRA_ANIMALS) {
    const stage = await prisma.stage.findUnique({ where: { stageId: a.stageId } });
    if (!stage) {
      console.warn(`  ! ステージ未検出: ${a.stageId}（${a.animalId} は stage=null で登録）`);
    }
    const data = {
      name: a.specificName,
      genericName: a.genericName,
      specificName: a.specificName,
      emoji: a.emoji,
      rarity: a.rarity,
      description: a.description,
      habitat: a.habitat,
      era: ERA_BY_STAGE[a.stageId] ?? "げんだい（いま）",
      location: LOCATION_BY_STAGE[a.stageId] ?? "せかいかくち",
      isExtinct: a.isExtinct ?? false,
      stageId: stage?.id ?? null,
      lifespanYears: a.lifespanYears ?? 10,
    };
    const existing = await prisma.animal.findUnique({ where: { animalId: a.animalId } });
    await prisma.animal.upsert({
      where: { animalId: a.animalId },
      update: data,
      create: { animalId: a.animalId, ...data },
    });
    if (existing) updated++;
    else added++;
    console.log(`  ${existing ? "↻" : "＋"} ${a.emoji} ${a.specificName} [${a.genericName}] (${a.rarity})`);
  }

  // 3.5) genericName の表記ゆれ（ひらがな/カタカナ）を統合（非破壊）
  //      例: "いか" を "イカ" に寄せ、図鑑で同じ「なかま」が2つに割れないようにする。
  for (const m of GENERIC_NAME_MERGES) {
    const res = await prisma.animal.updateMany({
      where: { genericName: m.from },
      data: { genericName: m.to },
    });
    if (res.count > 0) console.log(`🔀 なかま統合: ${m.from} → ${m.to}（${res.count}種）`);
  }

  // 4) 空になった不要ステージを削除（中身が残っていれば残す）
  for (const sid of REMOVED_STAGE_IDS) {
    const stage = await prisma.stage.findUnique({
      where: { stageId: sid },
      include: { animals: true },
    });
    if (!stage) continue;
    if (stage.animals.length === 0) {
      await prisma.stage.delete({ where: { id: stage.id } });
      console.log(`🗑  空ステージを削除: ${sid}`);
    } else {
      console.warn(`  ! ステージ ${sid} に ${stage.animals.length} 種残存。削除しません`);
    }
  }

  const total = await prisma.animal.count();
  console.log(
    `\n✅ 完了  追加=${added} / 更新=${updated} / 削除=${REMOVED_ANIMAL_IDS.length}  ｜ 現在の総動物数: ${total}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
