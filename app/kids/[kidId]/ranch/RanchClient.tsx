"use client";
// ★ Zustand 統合:
//   BEFORE: inventory { coins, poop, grass } を useState で管理していた
//   AFTER : coins → useSafariStore.coins
//           grass/poop → useSafariStore.inventory['grass'/'poop']
//   アクション対応:
//     collectPoop  → addToInventory('poop', 1)
//     feed(grass)  → consumeInventory('grass', 1)
//     feed(coins)  → spendCoins(FEED_COST)
import { useState, useEffect, useRef, useCallback } from "react";
import { useSafariStore } from "@/store/useSafariStore";
import { adjustCoins } from "@/features/coins/actions";

// ============================================================
// Type Definitions
// ============================================================
interface Vec2 { x: number; y: number; }

type Diet = "HERBIVORE" | "CARNIVORE" | "OMNIVORE";
type FoodType = "grass" | "carrot" | "feed";
type FoodCategory = "PLANT" | "MEAT";
type AnimalState = "idle" | "happy" | "superHappy" | "refuse";

interface Animal {
  id: number;
  name: string;
  emoji: string;
  diet: Diet;
  pos: Vec2;
  target: Vec2;
  dir: "left" | "right";
  moving: boolean;
  lifespanDays: number;
  hunger: number;
  state: AnimalState;
  // ── 動きの個性 ──────────────────────────────
  moveSpeed: number;      // RAFごとのlerp係数（小さい=ゆっくり、大きい=はやい）
  moveInterval: number;   // 次の目標地点を決めるまでの目安時間(ms)
  nextMoveTime: number;   // 次に目標を更新するタイムスタンプ
  waddleDuration: number; // よちよちアニメの1周期(秒)
  // ── うんち（食後遅延方式）───────────────────
  lastFedTime: number | null; // 最後にエサを食べたタイムスタンプ
  poopDelay: number;          // 食後何ms後にうんちをするか
}

interface FoodItem {
  type: FoodType;
  category: FoodCategory;
  emoji: string;
  label: string;
  cost: number;
  hungerRestore: number;
  superSynergy: boolean;
}

interface PoopDrop {
  id: number;
  pos: Vec2;
  collecting: boolean;
}

interface Inventory {
  coins: number;
  poop: number;
  grass: number;
}

// Particle for success burst
interface Particle {
  id: number;
  animalId: number;
  emoji: string;
  x: number; // relative to animal center
  y: number;
  vx: number;
  vy: number;
  createdAt: number;
  kind: "success" | "refuse";
}

interface Toast {
  id: number;
  message: string;
  kind: "success" | "refuse";
  createdAt: number;
}

interface DragState {
  type: FoodType | null;
  currentPos: Vec2;
  active: boolean;
}

// ============================================================
// Constants
// ============================================================
const FIELD_W = 460;
const FIELD_H = 320;
const ANIMAL_SIZE = 52;
const HUNGER_TICK = 9000;
const FEED_COST = 50;

const DIET_META: Record<Diet, { icon: string; label: string; color: string; bg: string; border: string }> = {
  HERBIVORE: { icon: "🌿", label: "そうしょく", color: "#15803d", bg: "#dcfce7", border: "#86efac" },
  CARNIVORE: { icon: "🍖", label: "にくしょく", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  OMNIVORE:  { icon: "🍀", label: "ざっしょく", color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
};

const FOOD: Record<FoodType, FoodItem> = {
  grass:  { type: "grass",  category: "PLANT", emoji: "🌿", label: "農場のくさ",    cost: 1,        hungerRestore: 55, superSynergy: true  },
  carrot: { type: "carrot", category: "PLANT", emoji: "🥕", label: "農場のにんじん", cost: 1,        hungerRestore: 45, superSynergy: true  },
  feed:   { type: "feed",   category: "MEAT",  emoji: "🍖", label: "コインのエサ",  cost: FEED_COST, hungerRestore: 30, superSynergy: false },
};

function canEat(diet: Diet, cat: FoodCategory): boolean {
  if (diet === "OMNIVORE")  return true;
  if (diet === "HERBIVORE") return cat === "PLANT";
  if (diet === "CARNIVORE") return cat === "MEAT";
  return false;
}

// 動物ごとの動きの個性とうんちのリズム
const INITIAL_ANIMALS: Animal[] = [
  {
    id: 1, name: "ライオン", emoji: "🦁", diet: "CARNIVORE",
    pos: { x: 60, y: 80 }, target: { x: 60, y: 80 }, dir: "right", moving: false,
    lifespanDays: 12, hunger: 60, state: "idle",
    moveSpeed: 0.022, moveInterval: 4500, nextMoveTime: Date.now() + 3000,
    waddleDuration: 0.60,   // どっしりゆったり
    lastFedTime: null, poopDelay: 42000,
  },
  {
    id: 2, name: "ウサギ", emoji: "🐰", diet: "HERBIVORE",
    pos: { x: 200, y: 160 }, target: { x: 200, y: 160 }, dir: "left", moving: false,
    lifespanDays: 5, hunger: 30, state: "idle",
    moveSpeed: 0.072, moveInterval: 1000, nextMoveTime: Date.now() + 200,
    waddleDuration: 0.20,   // ぴょんぴょんはやい
    lastFedTime: null, poopDelay: 20000,
  },
  {
    id: 3, name: "パンダ", emoji: "🐼", diet: "HERBIVORE",
    pos: { x: 340, y: 90 }, target: { x: 340, y: 90 }, dir: "right", moving: false,
    lifespanDays: 20, hunger: 80, state: "idle",
    moveSpeed: 0.012, moveInterval: 7000, nextMoveTime: Date.now() + 6000,
    waddleDuration: 0.90,   // のんびりゆっくり
    lastFedTime: null, poopDelay: 55000,
  },
  {
    id: 4, name: "ひつじ", emoji: "🐑", diet: "HERBIVORE",
    pos: { x: 130, y: 230 }, target: { x: 130, y: 230 }, dir: "left", moving: false,
    lifespanDays: 8, hunger: 45, state: "idle",
    moveSpeed: 0.040, moveInterval: 2600, nextMoveTime: Date.now() + 1000,
    waddleDuration: 0.38,   // ふつうくらい
    lastFedTime: null, poopDelay: 33000,
  },
];

// ============================================================
// CSS
// ============================================================
const css = `
@import url('https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=Nunito:wght@700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }

/* -- movement -- */
@keyframes waddle {
  0%,100% { transform: rotate(-6deg) translateY(0); }
  50%      { transform: rotate(6deg) translateY(-4px); }
}
@keyframes idle-bob {
  0%,100% { transform: translateY(0) scale(1); }
  50%     { transform: translateY(-5px) scale(1.04); }
}

/* -- SUCCESS: big bounce-jump -- */
@keyframes eat-happy {
  0%   { transform: scale(1)    translateY(0)    rotate(0deg); filter: brightness(1); }
  20%  { transform: scale(1.5)  translateY(-18px) rotate(-12deg); filter: brightness(1.3) drop-shadow(0 0 12px #4ade80); }
  45%  { transform: scale(1.5)  translateY(-22px) rotate(12deg);  filter: brightness(1.4) drop-shadow(0 0 16px #4ade80); }
  70%  { transform: scale(1.25) translateY(-8px)  rotate(-4deg);  filter: brightness(1.2) drop-shadow(0 0 8px #4ade80); }
  100% { transform: scale(1)    translateY(0)    rotate(0deg);   filter: brightness(1); }
}
/* -- SUPER-HAPPY (grass synergy) -- */
@keyframes eat-super {
  0%   { transform: scale(1)    rotate(0deg);   filter: brightness(1); }
  15%  { transform: scale(1.7)  rotate(-18deg); filter: brightness(1.5) drop-shadow(0 0 18px #facc15) hue-rotate(20deg); }
  35%  { transform: scale(1.7)  rotate(18deg);  filter: brightness(1.6) drop-shadow(0 0 22px #facc15) hue-rotate(-20deg); }
  55%  { transform: scale(1.4)  rotate(-8deg);  filter: brightness(1.3) drop-shadow(0 0 12px #facc15); }
  75%  { transform: scale(1.2)  rotate(6deg);   filter: brightness(1.1); }
  100% { transform: scale(1)    rotate(0deg);   filter: brightness(1); }
}
/* -- REFUSE: shrink-shake with red flash -- */
@keyframes refuse-anim {
  0%   { transform: scale(1)    rotate(0deg);  filter: brightness(1); }
  10%  { transform: scale(0.75) rotate(0deg);  filter: brightness(0.6) sepia(1) saturate(5) hue-rotate(-20deg); }
  25%  { transform: scale(0.8)  rotate(-14deg); filter: brightness(0.7) sepia(1) saturate(4) hue-rotate(-20deg); }
  45%  { transform: scale(0.8)  rotate(14deg);  filter: brightness(0.7) sepia(1) saturate(4) hue-rotate(-20deg); }
  65%  { transform: scale(0.85) rotate(-8deg);  filter: brightness(0.8); }
  80%  { transform: scale(0.9)  rotate(5deg);   filter: brightness(0.9); }
  100% { transform: scale(1)    rotate(0deg);  filter: brightness(1); }
}
/* -- particles -- */
@keyframes particle-fly {
  0%   { opacity:1; transform: translate(0,0) scale(1); }
  80%  { opacity:1; }
  100% { opacity:0; transform: translate(var(--px),var(--py)) scale(0.4); }
}
/* -- poop -- */
@keyframes poop-idle    { 0%,100%{transform:rotate(-5deg) scale(1);}    50%{transform:rotate(5deg) scale(1.08);} }
@keyframes poop-collect { 0%{opacity:1;transform:translateY(0) scale(1);} 100%{opacity:0;transform:translateY(-60px) scale(0.1);} }
/* -- field deco -- */
@keyframes grass-sway  { 0%,100%{transform:rotate(-3deg);transform-origin:bottom center;} 50%{transform:rotate(3deg);transform-origin:bottom center;} }
@keyframes cloud-drift { 0%{transform:translateX(-20px);} 100%{transform:translateX(20px);} }
@keyframes drag-item   { 0%,100%{transform:scale(1.1) rotate(-5deg);} 50%{transform:scale(1.2) rotate(5deg);} }
@keyframes hunger-pulse{ 0%,100%{opacity:1;} 50%{opacity:0.45;} }
/* -- feedback overlay on animal -- */
@keyframes feedback-bg-ok {
  0%   { opacity:0; transform:scale(0.7); }
  30%  { opacity:1; transform:scale(1.15); }
  70%  { opacity:1; transform:scale(1.05); }
  100% { opacity:0; transform:scale(1); }
}
@keyframes feedback-bg-ng {
  0%   { opacity:0;  background: radial-gradient(circle, rgba(239,68,68,0.9) 0%, rgba(239,68,68,0) 70%); transform:scale(0.7); }
  25%  { opacity:1;  background: radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0) 70%); transform:scale(1.2); }
  60%  { opacity:0.6; transform:scale(1.1); }
  100% { opacity:0;  transform:scale(1); }
}
/* -- toast -- */
@keyframes toast-slide-in  { 0%{opacity:0;transform:translateX(-50%) translateY(-16px) scale(0.88);} 100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);} }
@keyframes toast-slide-out { 0%{opacity:1;transform:translateX(-50%) scale(1);} 100%{opacity:0;transform:translateX(-50%) scale(0.9) translateY(-10px);} }
/* -- drop-target -- */
@keyframes target-ok { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0);} 50%{box-shadow:0 0 0 10px rgba(74,222,128,0.35);} }
@keyframes target-ng { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0);} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0.35);} }
`;

// ============================================================
// Helpers
// ============================================================
const rand    = (min: number, max: number) => Math.random() * (max - min) + min;
const dist    = (a: Vec2, b: Vec2)          => Math.hypot(b.x - a.x, b.y - a.y);
const lerp    = (a: number, b: number, t: number) => a + (b - a) * t;
const randPos = (): Vec2 => ({ x: rand(20, FIELD_W - ANIMAL_SIZE - 20), y: rand(30, FIELD_H - ANIMAL_SIZE - 30) });

// ============================================================
// HungerBar
// ============================================================
function HungerBar({ hunger }: { hunger: number }) {
  const color = hunger > 70 ? "#f87171" : hunger > 40 ? "#facc15" : "#4ade80";
  return (
    <div style={{ width: 58, height: 7, background: "rgba(0,0,0,0.18)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${hunger}%`, background: color, borderRadius: 4,
        transition: "width 0.4s, background 0.4s",
        animation: hunger > 70 ? "hunger-pulse 1s infinite" : "none" }} />
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================
export default function RanchClient() {
  // ★ ストアからグローバル経済データを取得
  const coins          = useSafariStore((s) => s.coins);
  const storeInventory = useSafariStore((s) => s.inventory);
  const addToInventory  = useSafariStore((s) => s.addToInventory);
  const consumeInventory = useSafariStore((s) => s.consumeInventory);
  const spendCoins     = useSafariStore((s) => s.spendCoins);
  const syncCoins      = useSafariStore((s) => s.syncCoins);
  const addCoins       = useSafariStore((s) => s.addCoins);

  // 便利ゲッター（インベントリ内の草・にんじん・フン）
  const grassCount  = storeInventory["grass"]  ?? 0;
  const carrotCount = storeInventory["carrot"] ?? 0;
  const poopCount   = storeInventory["poop"]   ?? 0;

  // ★ ローカル state（牧場固有：動物の動き・空腹・フンドロップ・UI）
  const [animals,   setAnimals]   = useState<Animal[]>(INITIAL_ANIMALS);
  const [poops,     setPoops]     = useState<PoopDrop[]>([]);
  // ★ DELETED: const [inventory, setInventory] = useState<Inventory>({ coins: 1200, poop: 0, grass: 5 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [toasts,    setToasts]    = useState<Toast[]>([]);
  const [drag,      setDrag]      = useState<DragState>({ type: null, currentPos: { x: 0, y: 0 }, active: false });
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);
  const [dropTarget,     setDropTarget]     = useState<number | null>(null);

  const fieldRef    = useRef<HTMLDivElement>(null);
  const particleId  = useRef(0);
  const poopId      = useRef(0);
  const toastId     = useRef(0);
  const animalsRef  = useRef(animals);  useEffect(() => { animalsRef.current  = animals;   }, [animals]);
  // ★ DELETED: inventoryRef（ストアの getState() で代替）
  const dragRef     = useRef(drag);      useEffect(() => { dragRef.current      = drag;      }, [drag]);

  // -- movement（目標更新＋移動を1つのRAFループに統合）--
  // 動物ごとに nextMoveTime を持つのでバラバラのタイミングで向きを変える
  useEffect(() => {
    let raf: number;
    const step = () => {
      const now = Date.now();
      setAnimals(prev => prev.map(a => {
        // 目標地点の更新（動物ごとに異なるインターバル ±30%ジッタ）
        let cur = a;
        if (now >= a.nextMoveTime) {
          const t = randPos();
          const jitter = a.moveInterval * (0.7 + Math.random() * 0.6);
          cur = { ...a, target: t, moving: true, dir: t.x > a.pos.x ? "right" : "left",
                  nextMoveTime: now + jitter };
        }
        // 位置をなめらかに更新（moveSpeedで速度が動物ごとに違う）
        if (!cur.moving) return cur;
        const nx = lerp(cur.pos.x, cur.target.x, cur.moveSpeed);
        const ny = lerp(cur.pos.y, cur.target.y, cur.moveSpeed);
        const arrived = dist({ x: nx, y: ny }, cur.target) < 2;
        return { ...cur, pos: { x: nx, y: ny }, moving: !arrived };
      }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // -- hunger --
  useEffect(() => {
    const iv = setInterval(() => {
      setAnimals(prev => prev.map(a => ({ ...a, hunger: Math.min(100, a.hunger + 8) })));
    }, HUNGER_TICK);
    return () => clearInterval(iv);
  }, []);

  // -- poop drop（食後 poopDelay ms 経過したら1回だけ出る）--
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setAnimals(prev => {
        const newPoops: PoopDrop[] = [];
        const next = prev.map(a => {
          if (a.lastFedTime !== null && now - a.lastFedTime >= a.poopDelay) {
            newPoops.push({ id: poopId.current++, pos: { x: a.pos.x + rand(-12, 12), y: a.pos.y + rand(-6, 6) }, collecting: false });
            return { ...a, lastFedTime: null }; // リセット（次の食事まで出ない）
          }
          return a;
        });
        if (newPoops.length) setPoops(p => [...p, ...newPoops]);
        return next;
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // -- cleanup --
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setParticles(prev => prev.filter(p => now - p.createdAt < 900));
      setToasts(prev =>    prev.filter(t => now - t.createdAt < 3400));
    }, 200);
    return () => clearInterval(iv);
  }, []);

  // -- drop-target highlight --
  useEffect(() => {
    if (!drag.active || !fieldRef.current) { setDropTarget(null); return; }
    const rect = fieldRef.current.getBoundingClientRect();
    const fx = drag.currentPos.x - rect.left;
    const fy = drag.currentPos.y - rect.top;
    let best: number | null = null; let minD = 90;
    for (const a of animalsRef.current) {
      const d = dist({ x: fx, y: fy }, { x: a.pos.x + ANIMAL_SIZE / 2, y: a.pos.y + ANIMAL_SIZE / 2 });
      if (d < minD) { minD = d; best = a.id; }
    }
    setDropTarget(best);
  }, [drag.currentPos, drag.active]);

  // -- spawn particles --
  const spawnParticles = useCallback((animalId: number, cx: number, cy: number, kind: "success" | "refuse") => {
    const emojis = kind === "success"
      ? ["💖","💛","🎵","✨","🌟","💚","🎉"]
      : ["💢","❌","😖","💦","❓"];
    const count = kind === "success" ? 8 : 5;
    const ps: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const speed = kind === "success" ? rand(55, 95) : rand(35, 65);
      return {
        id: particleId.current++,
        animalId,
        emoji: emojis[i % emojis.length],
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        createdAt: Date.now(),
        kind,
      };
    });
    setParticles(prev => [...prev, ...ps]);
  }, []);

  // -- add toast --
  const addToast = useCallback((message: string, kind: "success" | "refuse") => {
    const id = toastId.current++;
    setToasts(prev => [...prev.slice(-2), { id, message, kind, createdAt: Date.now() }]);
  }, []);

  // -- collect poop --
  // ★ BEFORE: setInventory(prev => ({ ...prev, poop: prev.poop + 1 }))
  // ★ AFTER : addToInventory('poop', 1) → グローバルインベントリへ反映
  const collectPoop = useCallback((pid: number, pos: Vec2) => {
    setPoops(prev => prev.map(p => p.id === pid ? { ...p, collecting: true } : p));
    setTimeout(() => {
      setPoops(prev => prev.filter(p => p.id !== pid));
      addToInventory("poop", 1);
    }, 650);
  }, [addToInventory]);

  // -- feed --
  const feedAnimal = useCallback((animalId: number, foodType: FoodType) => {
    const curAnimals = animalsRef.current;
    const a = curAnimals.find(x => x.id === animalId);
    if (!a) return;

    const food = FOOD[foodType];
    const ok   = canEat(a.diet, food.category);
    const cx   = a.pos.x + ANIMAL_SIZE / 2;
    const cy   = a.pos.y + ANIMAL_SIZE / 2;

    if (!ok) {
      // -- REFUSE --
      setAnimals(prev => prev.map(x => x.id === animalId ? { ...x, state: "refuse" } : x));
      spawnParticles(animalId, cx, cy, "refuse");
      const msg =
        a.diet === "HERBIVORE" ? `🚫 ${a.name} は にくが たべられないよ！` :
        a.diet === "CARNIVORE" ? `🚫 ${a.name} は くさを たべないみたい…` :
        `🚫 ${a.name} は それを たべられないよ！`;
      addToast(msg, "refuse");
      setTimeout(() => setAnimals(prev => prev.map(x => x.id === animalId ? { ...x, state: "idle" } : x)), 900);
      return;
    }

    // -- SUCCESS --
    const isSuper = food.superSynergy;

    // ★ BEFORE: setInventory(prev => ({...prev, grass: prev.grass-1}))
    // ★ AFTER : consumeInventory / spendCoins → ストアへ反映
    if (foodType === "grass") {
      consumeInventory("grass", 1);
    } else if (foodType === "carrot") {
      consumeInventory("carrot", 1);
    } else {
      // コインは DB が権威。楽観的に減らしつつサーバで確定し、結果で同期する。
      spendCoins(FEED_COST);
      const kidId = useSafariStore.getState().activeKidId;
      if (kidId) {
        void adjustCoins(kidId, -FEED_COST, "ADJUSTMENT", "牧場のエサ代").then((r) => {
          if (r.success) {
            syncCoins(r.newCoinBalance);
          } else {
            addCoins(FEED_COST); // サーバ拒否時はローカルを戻す
            addToast("🪙 コインが たりないよ！", "refuse");
          }
        });
      }
    }

    setAnimals(prev => prev.map(x => {
      if (x.id !== animalId) return x;
      // lastFedTime を更新 → poopDelay 後にうんちが出る
      return { ...x, hunger: Math.max(0, x.hunger - food.hungerRestore),
               state: isSuper ? "superHappy" : "happy",
               lastFedTime: Date.now() };
    }));

    spawnParticles(animalId, cx, cy, "success");
    const msg = isSuper
      ? `💖 ${a.name} が だいよろこび！しばらくすると💩するよ`
      : `😊 ${a.name} が もぐもぐ！しばらくすると💩するよ`;
    addToast(msg, "success");
    setTimeout(() => setAnimals(prev => prev.map(x => x.id === animalId ? { ...x, state: "idle" } : x)), 950);
  }, [spawnParticles, addToast, consumeInventory, spendCoins, syncCoins, addCoins]);

  // -- drag handlers --
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, type: FoodType) => {
    e.preventDefault();
    const cx = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const cy = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDrag({ type, currentPos: { x: cx, y: cy }, active: true });
  }, []);

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current.active) return;
    const cx = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const cy = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    setDrag(prev => ({ ...prev, currentPos: { x: cx, y: cy } }));
  }, []);

  const onDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    const d = dragRef.current;
    if (!d.active || !d.type) return;
    const cx = "changedTouches" in e ? (e as TouchEvent).changedTouches[0].clientX : (e as MouseEvent).clientX;
    const cy = "changedTouches" in e ? (e as TouchEvent).changedTouches[0].clientY : (e as MouseEvent).clientY;

    if (fieldRef.current) {
      const rect = fieldRef.current.getBoundingClientRect();
      const fx = cx - rect.left;
      const fy = cy - rect.top;
      let hit: Animal | null = null; let minD = 72;
      for (const a of animalsRef.current) {
        const dv = dist({ x: fx, y: fy }, { x: a.pos.x + ANIMAL_SIZE / 2, y: a.pos.y + ANIMAL_SIZE / 2 });
        if (dv < minD) { minD = dv; hit = a; }
      }
      if (hit) {
        // ★ BEFORE: inventoryRef.current で在庫確認
        // ★ AFTER : useSafariStore.getState() でストアの最新値を同期参照
        const { inventory: si, coins: sc } = useSafariStore.getState();
        const canAfford =
          d.type === "grass"   ? (si["grass"]   ?? 0) > 0 :
          d.type === "carrot"  ? (si["carrot"]  ?? 0) > 0 :
          sc >= FEED_COST;
        if (canAfford) {
          feedAnimal(hit.id, d.type);
        } else {
          addToast(
            d.type === "grass"  ? "🌿 くさ が たりないよ！" :
            d.type === "carrot" ? "🥕 にんじん が たりないよ！" :
            "🪙 コイン が たりないよ！",
            "refuse"
          );
        }
      }
    }
    setDrag({ type: null, currentPos: { x: 0, y: 0 }, active: false });
    setDropTarget(null);
  }, [feedAnimal, addToast]);

  useEffect(() => {
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("touchmove", onDragMove, { passive: false });
    window.addEventListener("mouseup",   onDragEnd);
    window.addEventListener("touchend",  onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("mouseup",   onDragEnd);
      window.removeEventListener("touchend",  onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #aee4f7 0%, #d4edda 55%, #8bc34a 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "'Nunito','Mochiy Pop One',sans-serif", padding: "0 0 24px", userSelect: "none" }}>

        {/* -- Toasts -- */}
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 9000, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none" }}>
          {toasts.map(t => {
            const leaving = Date.now() - t.createdAt > 2700;
            const isOk    = t.kind === "success";
            return (
              <div key={t.id} style={{
                background: isOk
                  ? "linear-gradient(135deg,#166534,#15803d)"
                  : "linear-gradient(135deg,#991b1b,#dc2626)",
                color: "#fff",
                borderRadius: 24,
                padding: "10px 22px",
                fontSize: "0.88rem",
                fontWeight: 800,
                letterSpacing: 0.4,
                boxShadow: isOk
                  ? "0 4px 20px rgba(22,101,52,0.45)"
                  : "0 4px 20px rgba(153,27,27,0.5)",
                animation: leaving ? "toast-slide-out 0.5s ease-out forwards" : "toast-slide-in 0.3s ease-out forwards",
                whiteSpace: "nowrap",
                border: `2px solid ${isOk ? "#4ade80" : "#fca5a5"}`,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: "1.2rem" }}>{isOk ? "✅" : "❌"}</span>
                {t.message}
              </div>
            );
          })}
        </div>

        {/* -- Header -- */}
        <div style={{ width: "100%", maxWidth: 480,
          background: "linear-gradient(135deg,#ff8f00,#f9a825)",
          padding: "14px 18px 12px", borderRadius: "0 0 24px 24px",
          boxShadow: "0 4px 18px rgba(0,0,0,0.18)",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#fff", letterSpacing: 1 }}>🏡 ぼくのまきば</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.8)" }}>いのちのがっこう — Ranch Field</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* ★ ストアの coins / inventory から取得 */}
            {([ ["🪙", coins], ["💩", poopCount], ["🌿", grassCount] ] as [string,number][]).map(([icon, val]) => (
              <div key={icon} style={{ background: "rgba(255,255,255,0.25)", borderRadius: 12, padding: "5px 10px", textAlign: "center", minWidth: 44 }}>
                <div style={{ fontSize: "1.1rem" }}>{icon}</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#fff" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* -- Field -- */}
        <div ref={fieldRef} style={{
          width: FIELD_W, height: FIELD_H, position: "relative",
          borderRadius: 20, overflow: "hidden",
          boxShadow: "0 6px 30px rgba(0,0,0,0.2), inset 0 0 0 3px rgba(255,255,255,0.3)",
          background: "radial-gradient(ellipse at 50% 80%,#6dbf67 0%,#4caf50 50%,#388e3c 100%)",
          cursor: drag.active ? "grabbing" : "default",
        }}>
          {/* sky */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(135,206,235,0.28) 0%,transparent 38%)", pointerEvents: "none" }} />
          {/* clouds */}
          {[{ l:"12%",d:"0s",t:"6%" },{ l:"52%",d:"2.1s",t:"4%" },{ l:"78%",d:"4.3s",t:"11%" }].map((c,i) => (
            <div key={i} style={{ position:"absolute", top:c.t, left:c.l, fontSize:"1.6rem", opacity:0.5,
              animation:`cloud-drift ${6+i*2}s ease-in-out infinite alternate`, animationDelay:c.d, pointerEvents:"none" }}>☁️</div>
          ))}
          {/* soil */}
          <div style={{ position:"absolute", bottom:28, left:"50%", transform:"translateX(-50%)", width:"68%", height:18, background:"rgba(200,164,110,0.4)", borderRadius:10, pointerEvents:"none" }} />
          {/* fence top */}
          {[0,1,2,3,4,5,6].map(i => <div key={i} style={{ position:"absolute", top:0, left:`${i*14+3}%`, width:10, height:32, background:"linear-gradient(180deg,#c8a46e,#a0784a)", borderRadius:"3px 3px 0 0", pointerEvents:"none" }} />)}
          <div style={{ position:"absolute", top:8, left:0, right:0, height:10, background:"linear-gradient(90deg,#c8a46e,#b8904a,#c8a46e)", borderRadius:4, pointerEvents:"none" }} />
          {/* fence bottom */}
          {[0,1,2,3,4,5,6].map(i => <div key={i} style={{ position:"absolute", bottom:0, left:`${i*14+3}%`, width:10, height:32, background:"linear-gradient(180deg,#a0784a,#c8a46e)", borderRadius:"0 0 3px 3px", pointerEvents:"none" }} />)}
          <div style={{ position:"absolute", bottom:8, left:0, right:0, height:10, background:"linear-gradient(90deg,#c8a46e,#b8904a,#c8a46e)", borderRadius:4, pointerEvents:"none" }} />
          {/* water */}
          <div style={{ position:"absolute", right:20, top:48, width:44, height:22, background:"linear-gradient(180deg,#87ceeb,#5ba8d0)", borderRadius:8, border:"2px solid #a0784a", boxShadow:"inset 0 2px 4px rgba(0,0,0,0.2)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", right:26, top:54, fontSize:"0.9rem", pointerEvents:"none" }}>💧</div>
          {/* grass tufts */}
          {[{x:"8%",y:"54%"},{x:"22%",y:"34%"},{x:"47%",y:"63%"},{x:"68%",y:"44%"},{x:"84%",y:"69%"},{x:"34%",y:"77%"}].map((g,i) => (
            <div key={i} style={{ position:"absolute", left:g.x, top:g.y, fontSize:"1rem",
              animation:`grass-sway ${2+i*0.3}s ease-in-out infinite`, animationDelay:`${i*0.4}s`, pointerEvents:"none" }}>🌿</div>
          ))}

          {/* -- Poops -- */}
          {poops.map(p => (
            <button key={p.id} onClick={() => !p.collecting && collectPoop(p.id, p.pos)} style={{
              position:"absolute", left:p.pos.x, top:p.pos.y,
              fontSize:"1.4rem", background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1,
              animation: p.collecting ? "poop-collect 0.65s ease-out forwards" : "poop-idle 1.6s ease-in-out infinite",
              filter:"drop-shadow(1px 1px 2px rgba(0,0,0,0.3))", zIndex:5 }}>💩</button>
          ))}

          {/* -- Particles -- */}
          {particles.map(p => (
            <div key={p.id} style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              fontSize: "1.3rem",
              pointerEvents: "none",
              zIndex: 25,
              ["--px" as string]: `${p.vx}px`,
              ["--py" as string]: `${p.vy}px`,
              animation: "particle-fly 0.85s ease-out forwards",
            }}>{p.emoji}</div>
          ))}

          {/* -- Animals -- */}
          {animals.map(a => {
            const s = a.state;
            const emojiAnim =
              s === "superHappy" ? "eat-super 0.85s ease-in-out forwards" :
              s === "happy"      ? "eat-happy 0.75s ease-in-out forwards" :
              s === "refuse"     ? "refuse-anim 0.8s ease-in-out forwards" :
              a.moving           ? `waddle ${a.waddleDuration}s ease-in-out infinite` :
                                   `idle-bob ${2 + a.id * 0.3}s ease-in-out infinite`;

            const dt = DIET_META[a.diet];
            const isTarget = dropTarget === a.id && drag.active;
            const targetOk = isTarget && drag.type ? canEat(a.diet, FOOD[drag.type].category) : null;

            return (
              <div key={a.id} style={{ position:"absolute", left:a.pos.x, top:a.pos.y, width:ANIMAL_SIZE, zIndex:10, cursor:"pointer", transition:"none" }}
                onClick={() => setSelectedAnimal(prev => prev === a.id ? null : a.id)}>

                {/* -- Success glow overlay -- */}
                {(s === "happy" || s === "superHappy") && (
                  <div style={{
                    position:"absolute", inset:-14, borderRadius:"50%", zIndex:-1, pointerEvents:"none",
                    background: s === "superHappy"
                      ? "radial-gradient(circle,rgba(250,204,21,0.85) 0%,rgba(74,222,128,0.5) 50%,transparent 70%)"
                      : "radial-gradient(circle,rgba(74,222,128,0.8) 0%,transparent 65%)",
                    animation: "feedback-bg-ok 0.85s ease-out forwards",
                  }} />
                )}
                {/* -- Refuse red flash overlay -- */}
                {s === "refuse" && (
                  <div style={{
                    position:"absolute", inset:-14, borderRadius:"50%", zIndex:-1, pointerEvents:"none",
                    background: "radial-gradient(circle,rgba(239,68,68,0.9) 0%,transparent 70%)",
                    animation: "feedback-bg-ng 0.75s ease-out forwards",
                  }} />
                )}

                {/* -- Status bubble -- */}
                <div style={{
                  position:"absolute", top:-52, left:"50%", transform:"translateX(-50%)",
                  background:"rgba(255,255,255,0.96)", borderRadius:12,
                  padding:"4px 8px", whiteSpace:"nowrap",
                  boxShadow: isTarget
                    ? `0 2px 8px rgba(0,0,0,0.14), 0 0 0 2px ${targetOk ? "#4ade80" : "#f87171"}`
                    : "0 2px 8px rgba(0,0,0,0.14)",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                  transition:"box-shadow 0.15s",
                }}>
                  <div style={{ fontSize:"0.58rem", color: a.lifespanDays <= 5 ? "#ef4444":"#16a34a", fontWeight:700 }}>✨{a.lifespanDays}日</div>
                  <HungerBar hunger={a.hunger} />
                  {/* diet tag */}
                  <div style={{ display:"inline-flex", alignItems:"center", gap:2,
                    background:dt.bg, color:dt.color, border:`1px solid ${dt.border}`,
                    borderRadius:7, padding:"1px 5px", fontSize:"0.58rem", fontWeight:800 }}>
                    {dt.icon}{dt.label}
                  </div>
                </div>

                {/* -- Drop-target ring -- */}
                {isTarget && (
                  <div style={{
                    position:"absolute", inset:-8, borderRadius:"50%",
                    border: `3px dashed ${targetOk ? "#4ade80" : "#f87171"}`,
                    animation: targetOk ? "target-ok 0.65s infinite" : "target-ng 0.65s infinite",
                    pointerEvents:"none",
                  }} />
                )}

                {/* -- Big "x" or "heart" overlay when state fires -- */}
                {s !== "idle" && s !== "happy" && (
                  <div style={{
                    position:"absolute", top:"50%", left:"50%",
                    transform:"translate(-50%,-50%)",
                    fontSize: s === "superHappy" ? "2.4rem" : s === "refuse" ? "2rem" : "1.8rem",
                    pointerEvents:"none", zIndex:30,
                    animation:"feedback-bg-ok 0.85s ease-out forwards",
                  }}>
                    {s === "superHappy" ? "💖" : s === "refuse" ? "✖️" : ""}
                  </div>
                )}

                {/* -- Animal emoji -- */}
                <div style={{
                  fontSize:`${ANIMAL_SIZE}px`, lineHeight:1, display:"block", textAlign:"center",
                  transform: a.dir === "left" ? "scaleX(-1)" : "scaleX(1)",
                  animation: emojiAnim,
                }}>{a.emoji}</div>

                {/* -- Tap popup -- */}
                {selectedAnimal === a.id && (
                  <div style={{
                    position:"absolute", top: ANIMAL_SIZE + 6, left:"50%", transform:"translateX(-50%)",
                    background:"#fff", borderRadius:14, padding:"10px 14px",
                    boxShadow:"0 4px 20px rgba(0,0,0,0.2)", zIndex:30, minWidth:126, textAlign:"center",
                  }}>
                    <div style={{ fontWeight:900, fontSize:"0.9rem", color:"#4a2e00", marginBottom:5 }}>{a.name}</div>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:3,
                      background:dt.bg, color:dt.color, border:`1.5px solid ${dt.border}`,
                      borderRadius:10, padding:"3px 8px", fontSize:"0.72rem", fontWeight:800, marginBottom:5 }}>
                      {dt.icon} {dt.label}
                    </div>
                    <div style={{ fontSize:"0.65rem", color:"#888" }}>おなか: {a.hunger}%</div>
                    <div style={{ fontSize:"0.65rem", color: a.lifespanDays <= 5 ? "#ef4444":"#16a34a", marginTop:2 }}>✨ あと {a.lifespanDays}日</div>
                    <div style={{ fontSize:"0.6rem", color:"#aaa", marginTop:4 }}>
                      {a.diet==="HERBIVORE" ? "🌿くさ が すき" : a.diet==="CARNIVORE" ? "🍖おにく が すき" : "🍀なんでも たべるよ"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* hint */}
        <div style={{ fontSize:"0.68rem", color:"rgba(0,0,0,0.45)", marginTop:6, marginBottom:8, textAlign:"center", letterSpacing:0.3 }}>
          💩 タップで回収 ／ エサをドラッグ🐾 まちがえた食性はもどるよ！
        </div>

        {/* -- Feed bar -- */}
        <div style={{ width:"100%", maxWidth:480, background:"rgba(255,255,255,0.88)", borderRadius:22, padding:"14px 16px",
          boxShadow:"0 -2px 20px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.08)", backdropFilter:"blur(8px)" }}>
          <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#888", marginBottom:10, textAlign:"center", letterSpacing:1 }}>
            ▼ エサをドラッグして動物にわたそう ▼
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {/* grass */}
            {(() => {
              const ok = grassCount > 0;
              return (
                <div onMouseDown={e => ok && onDragStart(e,"grass")} onTouchStart={e => ok && onDragStart(e,"grass")}
                  style={{ flex:"1 1 30%", borderRadius:16, padding:"12px 8px", textAlign:"center", touchAction:"none",
                    background: ok ? "linear-gradient(135deg,#4ade80,#16a34a)" : "#e5e7eb",
                    color: ok ? "#fff" : "#9ca3af", cursor: ok ? "grab" : "not-allowed",
                    boxShadow: ok ? "0 4px 12px rgba(74,222,128,0.4)" : "none", transition:"all 0.2s" }}>
                  <div style={{ fontSize:"1.8rem" }}>🌿</div>
                  <div style={{ fontSize:"0.75rem", fontWeight:800 }}>農場のくさ</div>
                  <div style={{ fontSize:"0.6rem", opacity:0.85, marginTop:2 }}>のこり {grassCount}本</div>
                  <div style={{ fontSize:"0.58rem", marginTop:4, opacity:0.85 }}>
                    <span style={{ background:"rgba(255,255,255,0.22)", borderRadius:6, padding:"1px 6px" }}>🌿そうしょく 🍀ざっしょく</span>
                  </div>
                </div>
              );
            })()}
            {/* carrot */}
            {(() => {
              const ok = carrotCount > 0;
              return (
                <div onMouseDown={e => ok && onDragStart(e,"carrot")} onTouchStart={e => ok && onDragStart(e,"carrot")}
                  style={{ flex:"1 1 30%", borderRadius:16, padding:"12px 8px", textAlign:"center", touchAction:"none",
                    background: ok ? "linear-gradient(135deg,#fb923c,#ea580c)" : "#e5e7eb",
                    color: ok ? "#fff" : "#9ca3af", cursor: ok ? "grab" : "not-allowed",
                    boxShadow: ok ? "0 4px 12px rgba(251,146,60,0.4)" : "none", transition:"all 0.2s" }}>
                  <div style={{ fontSize:"1.8rem" }}>🥕</div>
                  <div style={{ fontSize:"0.75rem", fontWeight:800 }}>農場のにんじん</div>
                  <div style={{ fontSize:"0.6rem", opacity:0.85, marginTop:2 }}>のこり {carrotCount}本</div>
                  <div style={{ fontSize:"0.58rem", marginTop:4, opacity:0.85 }}>
                    <span style={{ background:"rgba(255,255,255,0.22)", borderRadius:6, padding:"1px 6px" }}>🌿そうしょく 🍀ざっしょく</span>
                  </div>
                </div>
              );
            })()}
            {/* feed (meat) */}
            {(() => {
              const ok = coins >= FEED_COST;
              return (
                <div onMouseDown={e => ok && onDragStart(e,"feed")} onTouchStart={e => ok && onDragStart(e,"feed")}
                  style={{ flex:"1 1 30%", borderRadius:16, padding:"12px 8px", textAlign:"center", touchAction:"none",
                    background: ok ? "linear-gradient(135deg,#fbbf24,#d97706)" : "#e5e7eb",
                    color: ok ? "#fff" : "#9ca3af", cursor: ok ? "grab" : "not-allowed",
                    boxShadow: ok ? "0 4px 12px rgba(251,191,36,0.4)" : "none", transition:"all 0.2s" }}>
                  <div style={{ fontSize:"1.8rem" }}>🍖</div>
                  <div style={{ fontSize:"0.75rem", fontWeight:800 }}>コインのエサ</div>
                  <div style={{ fontSize:"0.6rem", opacity:0.85, marginTop:2 }}>{FEED_COST}コイン（のこり {coins}）</div>
                  <div style={{ fontSize:"0.58rem", marginTop:4, opacity:0.85 }}>
                    <span style={{ background:"rgba(255,255,255,0.22)", borderRadius:6, padding:"1px 6px" }}>🍖にくしょく 🍀ざっしょく</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* -- Drag ghost -- */}
        {drag.active && drag.type && (
          <div style={{ position:"fixed", left:drag.currentPos.x-26, top:drag.currentPos.y-26,
            fontSize:"3.2rem", pointerEvents:"none", zIndex:9999,
            animation:"drag-item 0.3s ease-in-out infinite",
            filter:"drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>
            {drag.type === "grass" ? "🌿" : drag.type === "carrot" ? "🥕" : "🍖"}
          </div>
        )}
      </div>
    </>
  );
}
