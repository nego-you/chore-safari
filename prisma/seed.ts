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
  // ゲームプレイ中の抽象名（例: ゾウ）
  genericName: string;
  // 図鑑に載る詳細な種名（例: アフリカゾウ）
  specificName: string;
  // 後方互換フィールド（specificNameと同じ値でよい）
  name: string;
  emoji: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  // 約100文字の詳細解説（図鑑用）
  description: string;
  isExtinct?: boolean;
  imageUrl?: string;
};

type QuestSeed = {
  title: string;
  description?: string;
  rewardCoins: number;
  emoji: string;
};

type PenaltySeed = {
  title: string;
  description?: string;
  coinAmount: number;
  emoji: string;
};

// ペナルティ初期データ。target_users 空＝全員に適用可能。
const PENALTIES: PenaltySeed[] = [
  { title: "けんか", description: "きょうだい げんかをした", coinAmount: 50, emoji: "🚨" },
  { title: "うそをついた", description: "うそを ついて あやまらなかった", coinAmount: 80, emoji: "🤥" },
  { title: "かたづけない", description: "おもちゃを ちらかしっぱなし", coinAmount: 20, emoji: "🧹" },
  { title: "やくそく やぶり", description: "ねるじかんを まもらなかった", coinAmount: 30, emoji: "⏰" },
];

// 親が承認するクエスト一覧。子供3人共通で使えるイメージ。
const QUESTS: QuestSeed[] = [
  { title: "おふろそうじ", description: "おふろを ピカピカに してね", rewardCoins: 50, emoji: "🛁" },
  { title: "ほんを1さつよむ", description: "さいごまで よめたら しんこく", rewardCoins: 30, emoji: "📖" },
  { title: "あさ4時半におきる", description: "アラームを じぶんで とめて おきよう", rewardCoins: 100, emoji: "⏰" },
  { title: "おもちゃをかたづける", description: "リビングの おもちゃを ぜんぶ もとに もどす", rewardCoins: 20, emoji: "🧸" },
  { title: "おはなみずやり", description: "ベランダの おはなに みずを あげる", rewardCoins: 15, emoji: "🌱" },
  { title: "テストでまんてん", description: "がっこうの テスト 100てん", rewardCoins: 300, emoji: "💯" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 図鑑マスタ（本格博物学版）
// genericName = ゲーム中の抽象名 / specificName = 図鑑の詳細種名
// ─────────────────────────────────────────────────────────────────────────────
const ANIMALS: AnimalSeed[] = [
  // ══════════════════════════════════════════
  // COMMON — ふつう（よく でる）
  // ══════════════════════════════════════════

  // ウサギ属
  {
    animalId: "rabbit_japanese",
    genericName: "うさぎ", specificName: "ニホンノウサギ", name: "ニホンノウサギ",
    emoji: "🐰", rarity: "COMMON",
    description: "日本の山や森に広く生息するウサギ。冬になると毛が白くなり、雪景色に溶け込む。後ろ足が長く、時速50kmで走ることができる。草や木の芽を食べる草食動物だ。",
  },
  {
    animalId: "rabbit_european",
    genericName: "うさぎ", specificName: "アナウサギ", name: "アナウサギ",
    emoji: "🐇", rarity: "COMMON",
    description: "ヨーロッパ原産で、地面に複雑なトンネルを掘って集団で暮らす。現在のペットウサギはすべてアナウサギが先祖。目が頭の横についており、ほぼ360度見渡せる。",
  },

  // リス属
  {
    animalId: "squirrel_japanese",
    genericName: "りす", specificName: "ニホンリス", name: "ニホンリス",
    emoji: "🐿️", rarity: "COMMON",
    description: "日本固有の小型リス。冬眠前にドングリや木の実を地面に埋めて貯める。しかし埋めた場所を忘れることも多く、そのまま芽が出て森が育つ。ふわふわの尻尾が特徴的。",
  },
  {
    animalId: "squirrel_flying",
    genericName: "りす", specificName: "モモンガ", name: "モモンガ",
    emoji: "🐿️", rarity: "COMMON",
    description: "前脚と後脚の間に広がる「飛膜」を使って木から木へとグライダーのように滑空する。最大で100メートルも飛ぶことがある。夜行性で、大きな目が暗闇でも見える。",
  },

  // シカ属
  {
    animalId: "deer_japanese",
    genericName: "しか", specificName: "ニホンジカ", name: "ニホンジカ",
    emoji: "🦌", rarity: "COMMON",
    description: "日本全国に生息するシカ。オスだけが毎年生え変わる立派なツノを持つ。秋になると「バン！」と大きな鳴き声（ラッティング）でメスを呼ぶ。奈良公園のシカが有名。",
  },
  {
    animalId: "deer_reindeer",
    genericName: "しか", specificName: "トナカイ", name: "トナカイ",
    emoji: "🦌", rarity: "COMMON",
    description: "シカの仲間で唯一、オスもメスもツノを持つ珍しい種。北極圏の厳しい寒さに適応し、蹄（ひづめ）は雪をしっかり踏みしめる形になっている。集団で長距離を移動する。",
  },

  // イノシシ属
  {
    animalId: "boar_japanese",
    genericName: "いのしし", specificName: "ニホンイノシシ", name: "ニホンイノシシ",
    emoji: "🐗", rarity: "COMMON",
    description: "日本の山野に生息するイノシシ。鼻先が強靭で、地面を掘って根っこや虫を探す。猪突猛進という言葉があるほど一直線に走る。子供はウリ坊と呼ばれ縞模様がかわいい。",
  },

  // タヌキ
  {
    animalId: "raccoon_dog",
    genericName: "たぬき", specificName: "ホンドタヌキ", name: "ホンドタヌキ",
    emoji: "🦝", rarity: "COMMON",
    description: "日本固有亜種のタヌキ。イヌ科の動物だが、冬になると冬眠に近い状態で過ごす珍しい習性を持つ。雑食性で何でも食べる。「化けるのがうまい」と昔話でも有名な動物。",
  },

  // ══════════════════════════════════════════
  // RARE — レア（ときどき でる）
  // ══════════════════════════════════════════

  // キツネ属
  {
    animalId: "fox_red",
    genericName: "きつね", specificName: "キタキツネ", name: "キタキツネ",
    emoji: "🦊", rarity: "RARE",
    description: "北海道に生息するアカギツネの亜種。雪の上に耳をそばだて、雪の下のネズミの動く音を聞いて垂直に飛び上がって捕らえる「マウシング」が得意。賢くて適応力が高い。",
  },
  {
    animalId: "fox_fennec",
    genericName: "きつね", specificName: "フェネック", name: "フェネック",
    emoji: "🦊", rarity: "RARE",
    description: "世界最小のキツネ。サハラ砂漠に生息し、体の割に巨大な耳で砂漠の熱を放散して体を冷やす。耳は聴力にも優れ、地下に潜った獲物の音も聞き取れる。夜行性で砂に穴を掘る。",
  },

  // オオカミ属
  {
    animalId: "wolf_gray",
    genericName: "おおかみ", specificName: "タイリクオオカミ", name: "タイリクオオカミ",
    emoji: "🐺", rarity: "RARE",
    description: "イヌの祖先。ユーラシア大陸に広く分布し、5〜15頭の群れで行動する。群れにはリーダーのアルファペアがいて社会性が高い。遠吠えで群れの仲間に位置を知らせる。",
  },
  {
    animalId: "wolf_japanese",
    genericName: "おおかみ", specificName: "ニホンオオカミ", name: "ニホンオオカミ",
    emoji: "🐺", rarity: "RARE",
    description: "かつて日本に生息したオオカミ。明治時代に絶滅した。世界最小のオオカミで、山の神として祀られる地域もあった。最後の個体は1905年に奈良県で記録されている。",
    isExtinct: true,
  },

  // クマ属
  {
    animalId: "bear_brown",
    genericName: "くま", specificName: "ヒグマ", name: "ヒグマ",
    emoji: "🐻", rarity: "RARE",
    description: "日本最大の陸上動物で北海道に生息。体重は500kgを超えることも。秋にサケをとって食べ、冬眠前に大量の脂肪を蓄える。嗅覚はイヌの7倍以上と言われるほど鋭い。",
  },
  {
    animalId: "bear_polar",
    genericName: "くま", specificName: "ホッキョクグマ", name: "ホッキョクグマ",
    emoji: "🐻‍❄️", rarity: "RARE",
    description: "北極に生息する世界最大の肉食陸上動物。白く見える毛は実は透明で、光を反射して白く見える。アザラシを主食とし、泳ぎも得意。水中を時速10kmで泳ぐことができる。",
  },

  // チンパンジー
  {
    animalId: "chimpanzee",
    genericName: "さる", specificName: "チンパンジー", name: "チンパンジー",
    emoji: "🐒", rarity: "RARE",
    description: "人間のDNAと98.7%一致する最も近い親戚。石を使ってナッツを割ったり、木の枝を加工してアリを釣ったりと道具を使う。感情が豊かで仲間と抱擁やキスで挨拶する。",
  },

  // ══════════════════════════════════════════
  // EPIC — すごレア（たまに でる）
  // ══════════════════════════════════════════

  // ライオン
  {
    animalId: "lion",
    genericName: "ライオン", specificName: "アフリカライオン", name: "アフリカライオン",
    emoji: "🦁", rarity: "EPIC",
    description: "百獣の王と呼ばれるネコ科最大級の動物。オスのたてがみが美しい。群れ（プライド）で暮らす唯一のネコ科で、狩りはメスが担う。遠吠えは8km先まで届く。",
  },
  {
    animalId: "lion_white",
    genericName: "ライオン", specificName: "ホワイトライオン", name: "ホワイトライオン",
    emoji: "🦁", rarity: "EPIC",
    description: "南アフリカのティンババティ地域に生まれる、突然変異による白いライオン。色素が薄くなる「リューシズム」という遺伝子変異によるもの。野生での目撃はきわめて珍しい。",
  },

  // ゾウ
  {
    animalId: "elephant_african",
    genericName: "ぞう", specificName: "アフリカゾウ", name: "アフリカゾウ",
    emoji: "🐘", rarity: "EPIC",
    description: "陸上最大の動物で体重は6トンにも達する。鼻は筋肉だけで構成され15万本の筋肉繊維を持つ。知能が高く、死んだ仲間の骨を撫でる「弔い」の行動も確認されている。",
  },
  {
    animalId: "elephant_asian",
    genericName: "ぞう", specificName: "アジアゾウ", name: "アジアゾウ",
    emoji: "🐘", rarity: "EPIC",
    description: "アフリカゾウより小型で耳が小さい。インドから東南アジアに生息。古くから人と共に働いてきた歴史を持ち、仏教では神聖な動物とされる。鏡で自分を認識できる賢さがある。",
  },
  {
    animalId: "elephant_mammoth",
    genericName: "ぞう", specificName: "マンモス", name: "マンモス",
    emoji: "🦣", rarity: "EPIC",
    description: "約4000年前まで生きていたゾウの仲間。長い湾曲したキバと厚い毛皮が特徴で、氷河期の寒さに適応していた。シベリアの永久凍土からほぼ完全な遺体が発見されている。",
    isExtinct: true,
  },

  // トラ
  {
    animalId: "tiger_bengal",
    genericName: "とら", specificName: "ベンガルトラ", name: "ベンガルトラ",
    emoji: "🐅", rarity: "EPIC",
    description: "世界最大のネコ科動物でインドを中心に生息。縞模様は個体ごとに異なり指紋のようなもの。単独で行動し、広大ななわばりを持つ。泳ぎが得意でワニを捕食することも。",
  },
  {
    animalId: "tiger_white",
    genericName: "とら", specificName: "ホワイトタイガー", name: "ホワイトタイガー",
    emoji: "🐅", rarity: "EPIC",
    description: "色素が薄い突然変異のベンガルトラ。青い目と白い毛に黒縞という幻想的な姿。野生では非常に珍しく、自然界では目立ちすぎて狩りに不利とも言われる。",
  },

  // チーター
  {
    animalId: "cheetah",
    genericName: "チーター", specificName: "チーター", name: "チーター",
    emoji: "🐆", rarity: "EPIC",
    description: "陸上最速の動物で時速110kmを超える瞬発力を持つ。ただし長距離は走れず30秒ほどで力尽きる。爪が引っ込まないため路面を蹴る力が強い。狩りの成功率は50%以上と高い。",
  },

  // ゴリラ
  {
    animalId: "gorilla",
    genericName: "ゴリラ", specificName: "ニシローランドゴリラ", name: "ニシローランドゴリラ",
    emoji: "🦍", rarity: "EPIC",
    description: "最大の霊長類で体重は200kgを超えることも。実は温厚な草食寄りの動物で、危険を感じたときにだけ胸を叩くドラミングを行う。手話を覚えることができるほど知能が高い。",
  },

  // ══════════════════════════════════════════
  // LEGENDARY — でんせつ（めったに でない！）
  // ══════════════════════════════════════════

  // 恐竜
  {
    animalId: "trex",
    genericName: "きょうりゅう", specificName: "ティラノサウルス・レックス", name: "ティラノサウルス・レックス",
    emoji: "🦖", rarity: "LEGENDARY", isExtinct: true,
    description: "白亜紀後期に生きた史上最強クラスの肉食恐竜。あごの噛む力は6トンで鋼鉄も砕く。体長13m・体重9トン。「T. rex」の化石は現在まで50体以上が発見されている。",
  },
  {
    animalId: "triceratops",
    genericName: "きょうりゅう", specificName: "トリケラトプス", name: "トリケラトプス",
    emoji: "🦕", rarity: "LEGENDARY", isExtinct: true,
    description: "3本のツノと大きなフリルを持つ草食恐竜。白亜紀末期に生息し、ティラノサウルスと同じ時代を生きた。フリルは体温調節や仲間への信号に使われたと考えられている。",
  },
  {
    animalId: "brachiosaurus",
    genericName: "きょうりゅう", specificName: "ブラキオサウルス", name: "ブラキオサウルス",
    emoji: "🦕", rarity: "LEGENDARY", isExtinct: true,
    description: "ジュラ紀後期に生きた超巨大な草食恐竜。首が長く体長25m・体重80トンという驚異的なサイズ。前足が後足より長いため背中が前に傾いている。高い木の葉を食べていた。",
  },

  // 幻獣・神話
  {
    animalId: "dragon",
    genericName: "りゅう", specificName: "ヨーロッパドラゴン", name: "ヨーロッパドラゴン",
    emoji: "🐉", rarity: "LEGENDARY",
    description: "ヨーロッパの伝説に登場する巨大な翼竜。炎を吐き、宝物を守るとされる。古代ローマの軍旗にも描かれ、中世ヨーロッパの騎士伝説に欠かせない存在として語り継がれている。",
  },
  {
    animalId: "unicorn",
    genericName: "ユニコーン", specificName: "ユニコーン", name: "ユニコーン",
    emoji: "🦄", rarity: "LEGENDARY",
    description: "ヨーロッパの伝説に登場する一本ツノの白馬。ツノには毒を消す力があるとされ、純粋な心の持ち主にだけ近寄ると言われる。スコットランドの国章にも描かれた神聖な存在。",
  },

  // ✨ SSR 最強王シリーズ（レアアイテム使用時のみ高確率で出現）
  {
    animalId: "tyrannosaurus",
    genericName: "きょうりゅう", specificName: "【恐竜王】ティラノサウルス", name: "【恐竜王】ティラノサウルス",
    emoji: "🦖", rarity: "LEGENDARY", isExtinct: true,
    description: "すべての恐竜の中でも最強と呼ばれる伝説の王者。あごの力は6トンを超え、骨ごと噛み砕く。最新研究では羽毛があった可能性も。地球史上最も有名な恐竜として君臨し続ける！",
  },
  {
    animalId: "hercules_beetle",
    genericName: "かぶとむし", specificName: "【昆虫王】ヘラクレスオオカブト", name: "【昆虫王】ヘラクレスオオカブト",
    emoji: "🪲", rarity: "LEGENDARY",
    description: "世界最長のカブトムシでツノを含めると18cmを超える。中南米の熱帯雨林に生息し、自分の体重の850倍という超人的な力を持つ。幼虫期間は約2年で成虫になる昆虫界の王者！",
  },
  {
    animalId: "lion_king",
    genericName: "ライオン", specificName: "【百獣の王】ライオン", name: "【百獣の王】ライオン",
    emoji: "🦁", rarity: "LEGENDARY",
    description: "サバンナに君臨する伝説の王。群れを率いるオスのたてがみは年齢とともに黒くなるほど強い証。吠え声は8km先まで響き渡り、すべての動物が恐れをなす。まさに百獣の王！",
  },
  {
    animalId: "megalodon",
    genericName: "サメ", specificName: "【海帝】メガロドン", name: "【海帝】メガロドン",
    emoji: "🦈", rarity: "LEGENDARY", isExtinct: true,
    description: "約300万年前まで生きていた史上最大のサメ。体長18m・歯の大きさ18cmという超巨大捕食者。現代のホホジロザメの3倍以上のサイズで、クジラすら捕食していたと考えられる！",
  },
  {
    animalId: "dragon_king",
    genericName: "りゅう", specificName: "【幻獣王】ドラゴン", name: "【幻獣王】ドラゴン",
    emoji: "🐉", rarity: "LEGENDARY",
    description: "東洋と西洋すべての伝説を超えた幻獣界の絶対王者。大地を揺るがす咆哮、鋼鉄を溶かす炎、天を翔ける巨大な翼…。あらゆる力を持つとされる究極の存在が今ここに降臨！",
  },
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
    const data = {
      name: animal.name,
      genericName: animal.genericName,
      specificName: animal.specificName,
      emoji: animal.emoji,
      rarity: animal.rarity,
      description: animal.description,
      isExtinct: animal.isExtinct ?? false,
      imageUrl: animal.imageUrl ?? null,
    };
    const upserted = await prisma.animal.upsert({
      where: { animalId: animal.animalId },
      update: data,
      create: { animalId: animal.animalId, ...data },
    });
    const extinctMark = upserted.isExtinct ? "💀" : "";
    console.log(
      `Seeded animal: ${upserted.emoji}${extinctMark} ${upserted.specificName} [${upserted.genericName}] (${upserted.rarity})`,
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

  // ペナルティマスタ（クエストと同じく title 一致で upsert）
  for (const p of PENALTIES) {
    const existing = await prisma.penalty.findFirst({ where: { title: p.title } });
    const upserted = existing
      ? await prisma.penalty.update({
          where: { id: existing.id },
          data: {
            description: p.description ?? null,
            coinAmount: p.coinAmount,
            emoji: p.emoji,
            isActive: true,
          },
        })
      : await prisma.penalty.create({
          data: {
            title: p.title,
            description: p.description ?? null,
            coinAmount: p.coinAmount,
            emoji: p.emoji,
          },
        });
    console.log(
      `Seeded penalty: ${upserted.emoji} ${upserted.title} (-${upserted.coinAmount})`,
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
