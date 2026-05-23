"use client";
import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   TYPE DEFINITIONS
   ============================================================ */
type Habitat = "savanna" | "forest" | "glacier";
type Diet = "CARNIVORE" | "HERBIVORE" | "PISCIVORE";
type RewardType = "coins" | "material" | "seed";
type PenaltyType = "cleanliness" | "block";

interface Animal {
  id: string;
  name: string;
  emoji: string;
  habitat: Habitat;
  diet: Diet;
  rarity: 1 | 2 | 3;
  incomePerTick: number;
}

interface ExhibitArea {
  id: Habitat;
  name: string;
  emoji: string;
  accentColor: string;
  groundColor: string;
  fenceColor: string;
  grassEmoji: string;
  unlockCost: { coins: number; woodBranch: number; ironFragment: number };
}

interface GoodVisitor {
  kind: "good";
  id: string;
  emoji: string;
  name: string;
  message: string;
  reward: { type: RewardType; amount: number };
  rewardLabel: string;
  requiresHighCleanliness?: boolean;
}

interface BadVisitor {
  kind: "bad";
  id: string;
  emoji: string;
  name: string;
  troubleIcon: string;
  troubleText: string;
  warningText: string;
  resolveText: string;
  penalty: { type: PenaltyType; cleaninessDelta?: number; blockArea?: Habitat };
  resolveDelta: number;
}

type VisitorTemplate = GoodVisitor | BadVisitor;

interface ActiveVisitor {
  uid: number;
  template: VisitorTemplate;
  x: number;
  y: number;
  dir: 1 | -1;
  phase: "walking" | "resolving";
}

interface SlotSynergy {
  stress: boolean;
  synergy: boolean;
  stressTooltip: string;
  modifier: number;
}

interface Inventory {
  coins: number;
  specialFood: number;
  woodBranch: number;
  ironFragment: number;
}

interface GameState {
  inventory: Inventory;
  cleanliness: number;
  pendingCoins: number;
  placedAnimals: Record<Habitat, (string | null)[]>;
  unlockedSlots: Record<Habitat, number>;
  blockedAreas: Set<Habitat>;
  isFeverTime: boolean;
  feverSecondsLeft: number;
  feverHeartsVisible: boolean;
}

type PopupState =
  | { kind: "good"; visitor: ActiveVisitor; template: GoodVisitor }
  | { kind: "bad"; visitor: ActiveVisitor; template: BadVisitor }
  | { kind: "place"; areaId: Habitat; slot: number }
  | { kind: "unlock"; areaId: Habitat }
  | null;

/* ============================================================
   STATIC DATA
   ============================================================ */
const ANIMALS: Animal[] = [
  { id: "lion",    name: "ライオン", emoji: "🦁", habitat: "savanna", diet: "CARNIVORE",  rarity: 3, incomePerTick: 18 },
  { id: "zebra",   name: "シマウマ", emoji: "🦓", habitat: "savanna", diet: "HERBIVORE",  rarity: 2, incomePerTick: 11 },
  { id: "giraffe", name: "キリン",   emoji: "🦒", habitat: "savanna", diet: "HERBIVORE",  rarity: 2, incomePerTick: 11 },
  { id: "rabbit",  name: "ウサギ",   emoji: "🐰", habitat: "forest",  diet: "HERBIVORE",  rarity: 1, incomePerTick: 6  },
  { id: "deer",    name: "シカ",     emoji: "🦌", habitat: "forest",  diet: "HERBIVORE",  rarity: 2, incomePerTick: 10 },
  { id: "fox",     name: "キツネ",   emoji: "🦊", habitat: "forest",  diet: "CARNIVORE",  rarity: 2, incomePerTick: 10 },
  { id: "penguin", name: "ペンギン", emoji: "🐧", habitat: "glacier", diet: "PISCIVORE",  rarity: 2, incomePerTick: 10 },
  { id: "polar",   name: "シロクマ", emoji: "🐻‍❄️", habitat: "glacier", diet: "CARNIVORE",  rarity: 3, incomePerTick: 18 },
  { id: "seal",    name: "アザラシ", emoji: "🦭", habitat: "glacier", diet: "PISCIVORE",  rarity: 1, incomePerTick: 6  },
];

const EXHIBIT_AREAS: ExhibitArea[] = [
  { id: "savanna", name: "サバンナ",   emoji: "🌅", accentColor: "#f97316", groundColor: "#fde68a", fenceColor: "#92400e", grassEmoji: "🌾",
    unlockCost: { coins: 200, woodBranch: 5, ironFragment: 2 } },
  { id: "forest",  name: "もりの中",   emoji: "🌲", accentColor: "#16a34a", groundColor: "#bbf7d0", fenceColor: "#166534", grassEmoji: "🌿",
    unlockCost: { coins: 200, woodBranch: 5, ironFragment: 2 } },
  { id: "glacier", name: "こおりの国", emoji: "❄️", accentColor: "#0ea5e9", groundColor: "#e0f2fe", fenceColor: "#0369a1", grassEmoji: "❄️",
    unlockCost: { coins: 200, woodBranch: 5, ironFragment: 2 } },
];

const GOOD_VISITORS: GoodVisitor[] = [
  { kind: "good", id: "grandma",   emoji: "👵", name: "えがおのおばあちゃん", message: "どうぶつたちが しあわせそうで、元気を もらえたわ。ありがとうね！", reward: { type: "coins", amount: 60 }, rewardLabel: "コイン60枚 GET！" },
  { kind: "good", id: "professor", emoji: "🎓", name: "どうぶつハカセ",       message: "こんなに 愛情たっぷりの 動物園は 初めて見たよ！すごいね！",       reward: { type: "material", amount: 1 }, rewardLabel: "レア素材 GET！" },
  { kind: "good", id: "ranger",    emoji: "🌳", name: "しぜん保護レンジャー", message: "ゴミひとつなくて、とっても きれいな 動物園だね！",                  reward: { type: "seed", amount: 1 }, rewardLabel: "農場のタネ GET！", requiresHighCleanliness: true },
];

const BAD_VISITORS: BadVisitor[] = [
  { kind: "bad", id: "litterer", emoji: "😤", name: "ポイ捨てする人", troubleIcon: "🍌", troubleText: "ポイすてしてるよ！",  warningText: "ダメ！ ゴミはゴミばこにすててね！",         resolveText: "ごめんなさい…ゴミを拾います。",   penalty: { type: "cleanliness", cleaninessDelta: -18 }, resolveDelta: 12 },
  { kind: "bad", id: "noisy",    emoji: "😠", name: "うるさいひと",   troubleIcon: "💢", troubleText: "さわいでいるよ！",    warningText: "ダメ！ どうぶつさんがびっくりしてるよ！", resolveText: "ごめんなさい…もうしません。",       penalty: { type: "block", blockArea: "savanna" },        resolveDelta: 8  },
];

const SPARKLE_COLORS = ["#fbbf24","#f472b6","#34d399","#60a5fa","#a78bfa","#fb923c","#4ade80"];
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

/* ============================================================
   SYNERGY ENGINE
   ============================================================ */
function evaluateSynergies(slots: (string | null)[]): SlotSynergy[] {
  const animals = slots.map(id => id ? (ANIMALS.find(a => a.id === id) ?? null) : null);
  return animals.map((animal, i) => {
    if (!animal) return { stress: false, synergy: false, stressTooltip: "", modifier: 1.0 };
    const neighbors = [
      i > 0 ? animals[i - 1] : null,
      i < animals.length - 1 ? animals[i + 1] : null,
    ].filter(Boolean) as Animal[];

    const carnivoreNeighbor = animal.diet === "HERBIVORE"
      ? neighbors.find(n => n.diet === "CARNIVORE")
      : undefined;
    if (carnivoreNeighbor) {
      return { stress: true, synergy: false, stressTooltip: `${animal.name} が ${carnivoreNeighbor.name} を こわがっているよ！`, modifier: 0.5 };
    }

    const synergyNeighbor = animal.diet === "HERBIVORE"
      ? neighbors.find(n => n.diet === "HERBIVORE" && n.habitat === animal.habitat)
      : undefined;
    if (synergyNeighbor) {
      return { stress: false, synergy: true, stressTooltip: "", modifier: 1.2 };
    }
    return { stress: false, synergy: false, stressTooltip: "", modifier: 1.0 };
  });
}

function calcAreaIncome(
  areaId: Habitat,
  slots: (string | null)[],
  unlocked: number,
  blocked: boolean,
  fever: boolean,
  cleanliness: number,
): number {
  if (blocked) return 0;
  const visible = slots.slice(0, unlocked);
  const syns = evaluateSynergies(slots);
  const cleanMod = cleanliness >= 70 ? 1 : cleanliness >= 40 ? 0.65 : 0.35;

  let total = 0;
  visible.forEach((id, i) => {
    if (!id) return;
    const a = ANIMALS.find(x => x.id === id);
    if (!a) return;
    let inc = a.incomePerTick * syns[i].modifier;
    if (fever) inc *= 2;
    inc *= cleanMod;
    total += Math.floor(inc);
  });

  if (unlocked === 3) {
    const filled = visible.filter(Boolean) as string[];
    if (filled.length === 3 && filled.every(id => ANIMALS.find(a => a.id === id)?.habitat === areaId)) {
      total = Math.floor(total * 1.5);
    }
  }
  return total;
}

/* Decay interval shrinks as more animals are placed → must clean more often */
function decayInterval(totalAnimals: number): number {
  return Math.max(900, 3500 - totalAnimals * 280);
}

/* ============================================================
   SUBCOMPONENTS
   ============================================================ */
function SparklesBurst({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: `${rnd(5, 95)}%`, top: `${rnd(5, 90)}%`, fontSize: rnd(14, 32), color: SPARKLE_COLORS[i % SPARKLE_COLORS.length], animation: `sparklePop 1.2s ease-out ${i * 45}ms both` }}>{"✦★◆✿"[i % 4]}</div>
      ))}
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "rgba(15,23,42,.9)", color: "#fff", padding: "10px 22px", borderRadius: 99, fontSize: 14, fontWeight: 700, zIndex: 8000, whiteSpace: "nowrap", boxShadow: "0 6px 24px rgba(0,0,0,.35)", animation: "toastIn .3s cubic-bezier(.34,1.56,.64,1)" }}>{msg}</div>
  );
}

function FeverHearts() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }}>
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: `${rnd(5, 90)}%`, top: `${rnd(20, 80)}%`, fontSize: rnd(18, 36), animation: `heartFloat 1.8s ease-out ${i * 80}ms both`, opacity: 0 }}>💗</div>
      ))}
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div style={{ position: "absolute", bottom: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", fontSize: 10, borderRadius: 8, padding: "4px 9px", whiteSpace: "nowrap", zIndex: 40, boxShadow: "0 2px 8px rgba(0,0,0,.35)", pointerEvents: "none" }}>
      ⚠️ {text}
      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", border: "4px solid transparent", borderTopColor: "#1e293b" }} />
    </div>
  );
}

/* ============================================================
   MAIN
   ============================================================ */
export default function ZooClient() {
  const [gs, setGs] = useState<GameState>({
    inventory: { coins: 720, specialFood: 2, woodBranch: 3, ironFragment: 1 },
    cleanliness: 78,
    pendingCoins: 0,
    placedAnimals: { savanna: ["lion", "zebra", null], forest: ["rabbit", null, null], glacier: [null, null, null] },
    unlockedSlots: { savanna: 2, forest: 2, glacier: 2 },
    blockedAreas: new Set(),
    isFeverTime: false, feverSecondsLeft: 0, feverHeartsVisible: false,
  });

  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);
  const [popup, setPopup] = useState<PopupState>(null);
  const [sparkles, setSparkles] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [resolvingUid, setResolvingUid] = useState<number | null>(null);
  const [hoveredStress, setHoveredStress] = useState<{ areaId: Habitat; slot: number } | null>(null);
  const uidRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const totalPlaced = (state: GameState) =>
    Object.values(state.placedAnimals).flat().filter(Boolean).length;

  /* ── Income tick ── */
  useEffect(() => {
    const t = setInterval(() => {
      setGs(prev => {
        let inc = 0;
        for (const a of EXHIBIT_AREAS) {
          inc += calcAreaIncome(a.id, prev.placedAnimals[a.id], prev.unlockedSlots[a.id], prev.blockedAreas.has(a.id), prev.isFeverTime, prev.cleanliness);
        }
        return { ...prev, pendingCoins: prev.pendingCoins + inc };
      });
    }, 2500);
    return () => clearInterval(t);
  }, []);

  /* ── Cleanliness decay — speed scales with # animals ── */
  useEffect(() => {
    const interval = decayInterval(totalPlaced(gs));
    const t = setInterval(() => {
      setGs(prev => ({ ...prev, cleanliness: Math.max(0, prev.cleanliness - 1) }));
    }, interval);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPlaced(gs)]);

  /* ── Fever countdown ── */
  useEffect(() => {
    if (!gs.isFeverTime) return;
    const t = setInterval(() => {
      setGs(prev => {
        if (prev.feverSecondsLeft <= 1) return { ...prev, isFeverTime: false, feverSecondsLeft: 0, feverHeartsVisible: false };
        return { ...prev, feverSecondsLeft: prev.feverSecondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [gs.isFeverTime]);

  /* ── Visitor spawner ── */
  useEffect(() => {
    const t = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.20) spawnVisitor("bad",  BAD_VISITORS[rnd(0, BAD_VISITORS.length - 1)]);
      else if (roll < 0.42) {
        const pool = GOOD_VISITORS.filter(v => !v.requiresHighCleanliness || gs.cleanliness >= 65);
        spawnVisitor("good", pool[rnd(0, pool.length - 1)]);
      }
    }, 2200);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.cleanliness]);

  function spawnVisitor(kind: "good" | "bad", template: VisitorTemplate) {
    const uid = ++uidRef.current;
    const v: ActiveVisitor = { uid, template, x: rnd(8, 75), y: kind === "bad" ? rnd(30, 55) : rnd(35, 65), dir: Math.random() > 0.5 ? 1 : -1, phase: "walking" };
    setActiveVisitors(prev => [...prev.slice(-10), v]);
    setTimeout(() => setActiveVisitors(p => p.filter(x => x.uid !== uid)), 12000);
  }

  function handleVisitorTap(v: ActiveVisitor) {
    if (popup) return;
    setActiveVisitors(prev => prev.filter(x => x.uid !== v.uid));
    if (v.template.kind === "good") setPopup({ kind: "good", visitor: v, template: v.template as GoodVisitor });
    else setPopup({ kind: "bad", visitor: v, template: v.template as BadVisitor });
  }

  function resolveGood() {
    if (popup?.kind !== "good") return;
    const { template } = popup;
    setPopup(null); setSparkles(true);
    if (template.reward.type === "coins") setGs(p => ({ ...p, inventory: { ...p.inventory, coins: p.inventory.coins + template.reward.amount } }));
    showToast(`✨ ${template.rewardLabel}`);
  }

  function resolveBad() {
    if (popup?.kind !== "bad") return;
    const { template, visitor } = popup;
    setResolvingUid(visitor.uid); setSparkles(true);
    setGs(prev => {
      const next = { ...prev, cleanliness: Math.min(100, prev.cleanliness + template.resolveDelta) };
      if (template.penalty.type === "block" && template.penalty.blockArea) {
        const nb = new Set(prev.blockedAreas); nb.delete(template.penalty.blockArea); next.blockedAreas = nb;
      }
      return next;
    });
    showToast("💪 えらい！ゆうきをだしたね！");
    setTimeout(() => { setResolvingUid(null); setPopup(null); }, 1200);
  }

  function collectCoins() {
    if (gs.pendingCoins === 0) return;
    setGs(p => ({ ...p, inventory: { ...p.inventory, coins: p.inventory.coins + p.pendingCoins }, pendingCoins: 0 }));
    setSparkles(true);
    showToast(`🪙 ${gs.pendingCoins} コイン うけとった！`);
  }

  function activateFever() {
    if (gs.inventory.specialFood <= 0 || gs.isFeverTime) return;
    setGs(p => ({ ...p, inventory: { ...p.inventory, specialFood: p.inventory.specialFood - 1 }, isFeverTime: true, feverSecondsLeft: 120, feverHeartsVisible: true }));
    showToast("🍎 エサやりショー かいし！2倍コイン！");
    setTimeout(() => setGs(p => ({ ...p, feverHeartsVisible: false })), 2800);
  }

  function placeAnimalFromModal(areaId: Habitat, slot: number, animalId: string) {
    setGs(p => { const c = { ...p, placedAnimals: { ...p.placedAnimals, [areaId]: [...p.placedAnimals[areaId]] } }; c.placedAnimals[areaId][slot] = animalId; return c; });
    setPopup(null);
    showToast("🐾 どうぶつをてんじしたよ！");
  }

  function removeAnimal(areaId: Habitat, slot: number) {
    setGs(p => { const c = { ...p, placedAnimals: { ...p.placedAnimals, [areaId]: [...p.placedAnimals[areaId]] } }; c.placedAnimals[areaId][slot] = null; return c; });
  }

  function unlockSlot(areaId: Habitat) {
    const cost = EXHIBIT_AREAS.find(a => a.id === areaId)!.unlockCost;
    const inv = gs.inventory;
    if (inv.coins < cost.coins || inv.woodBranch < cost.woodBranch || inv.ironFragment < cost.ironFragment) { showToast("素材またはコインがたりないよ！"); return; }
    setGs(p => ({
      ...p,
      inventory: { ...p.inventory, coins: p.inventory.coins - cost.coins, woodBranch: p.inventory.woodBranch - cost.woodBranch, ironFragment: p.inventory.ironFragment - cost.ironFragment },
      unlockedSlots: { ...p.unlockedSlots, [areaId]: p.unlockedSlots[areaId] + 1 },
    }));
    setPopup(null); setSparkles(true);
    showToast("🔓 柵がひろがったよ！");
  }

  /* ── Derived ── */
  const cleanColor = gs.cleanliness >= 70 ? "#22c55e" : gs.cleanliness >= 40 ? "#f59e0b" : "#ef4444";
  const cleanLabel = gs.cleanliness >= 70 ? "きれい！" : gs.cleanliness >= 40 ? "ふつう" : "きたない…";
  const placedIds  = Object.values(gs.placedAnimals).flat().filter(Boolean) as string[];
  const animalCount = placedIds.length;
  const badField   = activeVisitors.filter(v => v.template.kind === "bad");
  const goodField  = activeVisitors.filter(v => v.template.kind === "good");

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={{ fontFamily: "'Nunito','Kosugi Maru',sans-serif", maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(170deg,#fef3c7 0%,#d1fae5 45%,#bfdbfe 100%)", position: "relative", overflowX: "hidden", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');
        @keyframes sway       { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
        @keyframes floatY     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes walkLR     { 0%,100%{transform:translateX(0)} 50%{transform:translateX(28px)} }
        @keyframes walkRL     { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-28px)} }
        @keyframes bounceBtn  { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-10px)} 60%{transform:translateY(-5px)} }
        @keyframes popIn      { 0%{transform:scale(.2) translateY(30px);opacity:0} 60%{transform:scale(1.1) translateY(-4px)} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes slideUp    { 0%{transform:translateY(100%);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes sparklePop { 0%{transform:scale(0) rotate(0deg);opacity:1} 100%{transform:scale(1.8) rotate(270deg);opacity:0} }
        @keyframes toastIn    { 0%{transform:translateX(-50%) translateY(20px);opacity:0} 100%{transform:translateX(-50%) translateY(0);opacity:1} }
        @keyframes heartFloat { 0%{transform:translateY(0) scale(.5);opacity:1} 100%{transform:translateY(-120px) scale(1.4);opacity:0} }
        @keyframes pulseBad   { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.6)} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
        @keyframes shakeX     { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        @keyframes sorryDrop  { 0%{transform:scale(1)} 100%{transform:scale(.5) translateY(20px);opacity:0} }
        @keyframes sweatDrip  { 0%,100%{transform:translateY(0) scale(1);opacity:1} 50%{transform:translateY(5px) scale(.8);opacity:.6} }
        @keyframes synergyGlow{ 0%,100%{box-shadow:0 0 0 0 #86efac55} 50%{box-shadow:0 0 0 8px #86efac00} }
        @keyframes lockPulse  { 0%,100%{opacity:.65} 50%{opacity:1} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(90deg,#f59e0b,#f97316,#ef4444)", padding: "14px 16px 12px", borderRadius: "0 0 28px 28px", boxShadow: "0 6px 20px rgba(249,115,22,.35)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -10, top: -10, fontSize: 80, opacity: .13 }}>🦁</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.25)" }}>🦁 どうぶつえん</div>
            <div style={{ fontSize: 11, color: "#fffc", marginTop: 2 }}>おてつだいサファリ</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>🪙 {gs.inventory.coins.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#fffc", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <span>🍎×{gs.inventory.specialFood}</span>
              <span>🪵×{gs.inventory.woodBranch}</span>
              <span>⚙️×{gs.inventory.ironFragment}</span>
            </div>
          </div>
        </div>
        {/* Cleanliness */}
        <div style={{ marginTop: 10, background: "rgba(255,255,255,.2)", borderRadius: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>🧹</span>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,.3)", borderRadius: 99 }}>
              <div style={{ width: `${gs.cleanliness}%`, height: "100%", background: cleanColor, borderRadius: 99, transition: "width .6s,background .6s", boxShadow: `0 0 8px ${cleanColor}` }} />
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: cleanColor, background: "rgba(255,255,255,.9)", padding: "1px 7px", borderRadius: 99 }}>{gs.cleanliness}% {cleanLabel}</span>
        </div>
        {/* Decay warning */}
        {animalCount >= 4 && (
          <div style={{ marginTop: 5, fontSize: 10, color: "#ffdf9f", textAlign: "right" }}>
            ⚡ どうぶつ{animalCount}ひき → きれいさが はやくさがるよ！({Math.round(decayInterval(animalCount) / 100) / 10}秒/1pt)
          </div>
        )}
      </div>

      {/* ── COLLECT ── */}
      <div style={{ margin: "14px 16px 0" }}>
        <button onClick={collectCoins} disabled={gs.pendingCoins === 0} style={{ width: "100%", padding: "12px 16px", borderRadius: 18, border: "none", background: gs.pendingCoins > 0 ? "linear-gradient(90deg,#fbbf24,#f97316)" : "#e5e7eb", color: gs.pendingCoins > 0 ? "#fff" : "#9ca3af", fontWeight: 900, fontSize: 15, cursor: gs.pendingCoins > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "space-between", animation: gs.pendingCoins > 0 ? "bounceBtn 1.2s ease infinite" : "none", boxShadow: gs.pendingCoins > 0 ? "0 4px 18px rgba(249,115,22,.45)" : "none", transition: "background .3s,box-shadow .3s" }}>
          <span>💰 コインをうけとる！</span>
          <span style={{ background: "rgba(255,255,255,.3)", borderRadius: 99, padding: "2px 10px", fontSize: 13 }}>＋{gs.pendingCoins}</span>
        </button>
      </div>

      {/* ── TROUBLE BOARD ── */}
      {badField.length > 0 && (
        <div style={{ margin: "12px 16px 0", borderRadius: 18, overflow: "hidden", border: "2.5px solid #fca5a5", background: "#fff1f1", boxShadow: "0 2px 12px rgba(239,68,68,.18)" }}>
          <div style={{ background: "linear-gradient(90deg,#ef4444,#dc2626)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>🚨</span>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>こまったことが おきてるよ！</span>
          </div>
          {badField.map(v => {
            const tmpl = v.template as BadVisitor;
            return (
              <div key={v.uid} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #fecaca" }}>
                <div style={{ fontSize: 28, animation: "pulseBad 1s infinite" }}>{tmpl.troubleIcon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626" }}>{tmpl.troubleText}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{tmpl.emoji} {tmpl.name}が！</div>
                </div>
                <button onClick={() => handleVisitorTap(v)} style={{ padding: "8px 14px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#ef4444,#dc2626)", color: "#fff", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                  🚨 ちゅういする！
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PLAZA ── */}
      <div style={{ margin: "12px 16px 0", borderRadius: 20, overflow: "hidden", border: "2px solid #d1fae5", background: "linear-gradient(180deg,#ecfdf5,#f0fdf4)", position: "relative", minHeight: 110 }}>
        <div style={{ padding: "7px 12px", fontSize: 12, color: "#4b5563", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
          <span>🎪 どうぶつえんのひろば</span>
          <span style={{ color: "#9ca3af" }}>{goodField.length > 0 ? `${goodField.length}人 きてるよ！✨` : ""}</span>
        </div>
        <div style={{ position: "relative", height: 80 }}>
          {[...Array(5)].map((_, i) => (
            <div key={`npc-${i}`} style={{ position: "absolute", left: `${15 + i * 16}%`, top: `${30 + (i % 3) * 15}%`, fontSize: 20, opacity: .6, animation: `${i % 2 === 0 ? "walkLR" : "walkRL"} ${2.5 + i * .4}s ease-in-out infinite` }}>👤</div>
          ))}
          {goodField.map(v => {
            const tmpl = v.template as GoodVisitor;
            return (
              <div key={v.uid} onClick={() => handleVisitorTap(v)} style={{ position: "absolute", left: `${v.x}%`, top: `${v.y}%`, cursor: "pointer", animation: `${v.dir > 0 ? "walkLR" : "walkRL"} 3s ease-in-out infinite`, zIndex: 5 }}>
                <div style={{ position: "relative", textAlign: "center" }}>
                  <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", background: "#fbbf24", color: "#fff", fontSize: 9, borderRadius: 8, padding: "1px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>！タップ</div>
                  <div style={{ fontSize: 26 }}>{tmpl.emoji}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── EXHIBIT AREAS ── */}
      {EXHIBIT_AREAS.map(area => {
        const allSlots  = gs.placedAnimals[area.id];
        const unlocked  = gs.unlockedSlots[area.id];
        const isBlocked = gs.blockedAreas.has(area.id);
        const syns      = evaluateSynergies(allSlots);
        const visible   = allSlots.slice(0, unlocked);
        const hasSynergy = syns.slice(0, unlocked).some(s => s.synergy);
        const hasStress  = syns.slice(0, unlocked).some(s => s.stress);
        const filledVis  = visible.filter(Boolean).length;
        const comboActive = unlocked === 3 && filledVis === 3 && visible.every(id => id && ANIMALS.find(a => a.id === id)?.habitat === area.id);
        const canUnlock = unlocked < 3;
        const cost = area.unlockCost;
        const canAfford = gs.inventory.coins >= cost.coins && gs.inventory.woodBranch >= cost.woodBranch && gs.inventory.ironFragment >= cost.ironFragment;

        return (
          <div key={area.id} style={{ margin: "12px 16px 0", borderRadius: 22, overflow: "hidden", border: `3px solid ${isBlocked ? "#fca5a5" : hasStress ? "#fde68a" : area.accentColor}55`, boxShadow: `0 4px 16px ${area.accentColor}22`, background: "#fff" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(90deg,${area.accentColor}22,${area.accentColor}08)`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${area.accentColor}22` }}>
              <span style={{ fontWeight: 900, color: area.accentColor, fontSize: 15 }}>{area.emoji} {area.name}</span>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {comboActive  && <span style={{ fontSize: 10, background: "#fef3c7", color: "#d97706",  borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #fde68a"  }}>🔥 コンボ×1.5</span>}
                {hasSynergy   && <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a",  borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #bbf7d0"  }}>✨ 群れ×1.2</span>}
                {hasStress    && <span style={{ fontSize: 10, background: "#fffbeb", color: "#d97706",  borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #fde68a"  }}>💦 ストレス</span>}
                {isBlocked    && <span style={{ fontSize: 10, background: "#fef2f2", color: "#ef4444",  borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #fca5a5"  }}>⚠️ 停止</span>}
                {gs.isFeverTime&&<span style={{ fontSize: 10, background: "#fdf4ff", color: "#a855f7",  borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #e9d5ff"  }}>💗 ×2</span>}
              </div>
            </div>

            {/* Enclosure ground */}
            <div style={{ background: area.groundColor, padding: "10px 12px 12px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: .22, fontSize: 12, letterSpacing: 6, lineHeight: "22px", pointerEvents: "none" }}>{area.grassEmoji.repeat(60)}</div>
              {/* Fence pickets */}
              <div style={{ display: "flex", gap: 4, marginBottom: 8, position: "relative" }}>
                {[...Array(12)].map((_, i) => <div key={i} style={{ width: 6, height: 14, background: area.fenceColor, borderRadius: "3px 3px 0 0", opacity: .7 }} />)}
                <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 3, background: area.fenceColor, opacity: .5, borderRadius: 2 }} />
              </div>

              {/* Slots row */}
              <div style={{ display: "flex", gap: 8, position: "relative" }}>
                {/* Unlocked animal slots */}
                {visible.map((animalId, slot) => {
                  const animal = animalId ? ANIMALS.find(a => a.id === animalId) : null;
                  const syn = syns[slot];
                  const isHov = hoveredStress?.areaId === area.id && hoveredStress?.slot === slot;
                  return (
                    <div key={slot} style={{ flex: 1, position: "relative" }}>
                      {isHov && syn.stress && <Tooltip text={syn.stressTooltip} />}
                      {animal ? (
                        <div
                          onClick={() => removeAnimal(area.id, slot)}
                          onMouseEnter={() => syn.stress && setHoveredStress({ areaId: area.id, slot })}
                          onMouseLeave={() => setHoveredStress(null)}
                          style={{ height: 98, borderRadius: 14, cursor: "pointer", position: "relative", background: syn.stress ? "#fffbeb" : syn.synergy ? "#f0fdf4" : `${area.accentColor}18`, border: `2px solid ${syn.stress ? "#fde68a" : syn.synergy ? "#86efac" : area.accentColor}99`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: syn.synergy ? "synergyGlow 2s ease-in-out infinite" : "none" }}
                        >
                          {syn.stress  && <div style={{ position: "absolute", top: 5, right: 6, fontSize: 13, animation: "sweatDrip 1s ease-in-out infinite" }}>💦</div>}
                          {syn.synergy && <div style={{ position: "absolute", top: 4, left: 5, fontSize: 12, animation: "floatY 1.5s ease-in-out infinite" }}>✨</div>}
                          {gs.isFeverTime && <div style={{ position: "absolute", top: -10, right: -6, fontSize: 16, animation: "floatY 1s ease-in-out infinite" }}>💗</div>}
                          <div style={{ fontSize: 36, animation: gs.isFeverTime ? "sway .5s ease-in-out infinite" : "floatY 2.2s ease-in-out infinite" }}>{animal.emoji}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: area.accentColor, marginTop: 2 }}>{animal.name}</div>
                          <div style={{ fontSize: 10, color: syn.stress ? "#d97706" : syn.synergy ? "#16a34a" : "#6b7280" }}>
                            {syn.stress ? "×0.5 ストレス" : syn.synergy ? "×1.2 群れ！" : `+${animal.incomePerTick}/tick`}
                          </div>
                          <div style={{ position: "absolute", top: 3, left: 5, fontSize: 9, color: "#9ca3af" }}>✕</div>
                        </div>
                      ) : (
                        <button onClick={() => setPopup({ kind: "place", areaId: area.id, slot })} style={{ width: "100%", height: 98, borderRadius: 14, border: `2px dashed ${area.accentColor}99`, background: `${area.accentColor}08`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4 }}>
                          <span style={{ fontSize: 22 }}>🐾</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: area.accentColor, textAlign: "center", lineHeight: 1.3 }}>どうぶつを<br/>てんじする</span>
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Locked slot */}
                {canUnlock && (
                  <div style={{ flex: 1 }}>
                    <button onClick={() => setPopup({ kind: "unlock", areaId: area.id })} style={{ width: "100%", height: 98, borderRadius: 14, border: "2px dashed #94a3b8", background: "rgba(148,163,184,.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 3, animation: "lockPulse 2s ease-in-out infinite" }}>
                      <span style={{ fontSize: 28 }}>🔒</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textAlign: "center", lineHeight: 1.4 }}>柵を ひろげる</span>
                      <span style={{ fontSize: 8, color: canAfford ? "#16a34a" : "#ef4444", fontWeight: 700 }}>🪙{cost.coins} 🪵{cost.woodBranch} ⚙️{cost.ironFragment}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Fever button (savanna only) */}
            <div style={{ padding: "8px 12px 10px", background: "#fafafa", borderTop: `1px solid ${area.accentColor}20` }}>
              {area.id === "savanna" && (
                <button onClick={activateFever} disabled={gs.inventory.specialFood === 0 || gs.isFeverTime} style={{ width: "100%", padding: "9px", borderRadius: 14, border: "none", background: gs.isFeverTime ? "linear-gradient(90deg,#a855f7,#ec4899)" : gs.inventory.specialFood > 0 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "#d1d5db", color: "#fff", fontWeight: 900, fontSize: 13, cursor: gs.inventory.specialFood > 0 && !gs.isFeverTime ? "pointer" : "not-allowed", boxShadow: gs.inventory.specialFood > 0 && !gs.isFeverTime ? "0 3px 12px rgba(34,197,94,.4)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {gs.isFeverTime ? `💗 エサやりショー中！ あと${gs.feverSecondsLeft}秒` : `🍎 エサやりショー（コイン2倍！） エサ×${gs.inventory.specialFood}`}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* ── INVENTORY ── */}
      <div style={{ margin: "14px 16px 0", background: "#fff", borderRadius: 20, padding: "12px 14px", boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight: 900, fontSize: 14, color: "#374151", marginBottom: 8 }}>🎒 もっているどうぶつ</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ANIMALS.map(a => {
            const isPlaced = placedIds.includes(a.id);
            const ac = EXHIBIT_AREAS.find(x => x.id === a.habitat)!.accentColor;
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 5, background: isPlaced ? "#f3f4f6" : `${ac}18`, border: `1.5px solid ${isPlaced ? "#e5e7eb" : ac}`, borderRadius: 12, padding: "5px 9px", opacity: isPlaced ? .55 : 1 }}>
                <span style={{ fontSize: 20 }}>{a.emoji}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: "#9ca3af" }}>
                    {isPlaced ? "てんじ中" : `${a.diet === "CARNIVORE" ? "🥩" : a.diet === "HERBIVORE" ? "🌿" : "🐟"} +${a.incomePerTick}/tick`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── POPUP: Good visitor ── */}
      {popup?.kind === "good" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.52)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: 28, maxWidth: 340, width: "100%", animation: "popIn .5s cubic-bezier(.34,1.56,.64,1)", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: 72 }}>{popup.template.emoji}</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#374151", margin: "8px 0 6px" }}>{popup.template.name}</div>
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.75, background: "#fffbeb", borderRadius: 16, padding: "12px 16px", marginBottom: 20, border: "2px solid #fde68a" }}>
              💬 {popup.template.message}
            </div>
            <button onClick={resolveGood} style={{ width: "100%", padding: 14, borderRadius: 99, border: "none", background: "linear-gradient(90deg,#fbbf24,#f97316)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 16px rgba(249,115,22,.4)" }}>ありがとう！✨</button>
          </div>
        </div>
      )}

      {/* ── POPUP: Bad visitor ── */}
      {popup?.kind === "bad" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.58)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 28, padding: 28, maxWidth: 340, width: "100%", animation: resolvingUid ? "sorryDrop .5s ease forwards" : "popIn .4s cubic-bezier(.34,1.56,.64,1),shakeX .5s ease .4s", textAlign: "center", boxShadow: "0 24px 60px rgba(239,68,68,.25)" }}>
            <div style={{ fontSize: 64 }}>{popup.template.troubleIcon}</div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#ef4444", margin: "8px 0 4px" }}>{popup.template.troubleText}</div>
            <div style={{ fontSize: 13, color: "#6b7280", background: "#fef2f2", borderRadius: 14, padding: "10px 14px", marginBottom: 6, border: "2px solid #fca5a5" }}>
              {popup.template.emoji} {popup.template.name}
            </div>
            {resolvingUid ? (
              <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", padding: "14px 0", animation: "popIn .4s ease" }}>😔 {popup.template.resolveText}</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>ほうちするときれいさがさがるよ！</div>
                <button onClick={resolveBad} style={{ width: "100%", padding: 14, borderRadius: 99, border: "none", background: "linear-gradient(90deg,#ef4444,#dc2626)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 16px rgba(239,68,68,.4)" }}>{popup.template.warningText}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── POPUP: Place animal ── */}
      {popup?.kind === "place" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "20px 16px 32px", width: "100%", maxWidth: 480, animation: "slideUp .35s ease", boxShadow: "0 -8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 900, fontSize: 16, color: "#374151" }}>🐾 どうぶつをえらぶ</span>
              <button onClick={() => setPopup(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 99, padding: "4px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>とじる</button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", background: "#f8fafc", borderRadius: 10, padding: "6px 10px", marginBottom: 10, lineHeight: 1.7 }}>
              🌿 草食どうし → <b style={{ color: "#16a34a" }}>群れボーナス ×1.2</b>　　🥩＋🌿 となりあう → <b style={{ color: "#d97706" }}>ストレス ×0.5</b>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ANIMALS.filter(a => a.habitat === popup.areaId && !placedIds.includes(a.id)).map(a => {
                const ac = EXHIBIT_AREAS.find(x => x.id === a.habitat)!.accentColor;
                return (
                  <button key={a.id} onClick={() => placeAnimalFromModal(popup.areaId, popup.slot, a.id)} style={{ flex: "1 1 28%", minWidth: 88, padding: "12px 6px", borderRadius: 16, border: `2px solid ${ac}44`, background: `${ac}11`, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 34 }}>{a.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{a.diet === "CARNIVORE" ? "🥩肉食" : a.diet === "HERBIVORE" ? "🌿草食" : "🐟魚食"}</div>
                    <div style={{ fontSize: 10, color: ac }}>+{a.incomePerTick}/tick</div>
                  </button>
                );
              })}
              {ANIMALS.filter(a => a.habitat === popup.areaId && !placedIds.includes(a.id)).length === 0 && (
                <div style={{ width: "100%", textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>てんじできるどうぶつがいないよ</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP: Unlock slot ── */}
      {popup?.kind === "unlock" && (() => {
        const area = EXHIBIT_AREAS.find(a => a.id === popup.areaId)!;
        const c = area.unlockCost;
        const ok = gs.inventory.coins >= c.coins && gs.inventory.woodBranch >= c.woodBranch && gs.inventory.ironFragment >= c.ironFragment;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 28, padding: 28, maxWidth: 340, width: "100%", animation: "popIn .45s cubic-bezier(.34,1.56,.64,1)", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
              <div style={{ fontSize: 64 }}>🔒</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#374151", marginBottom: 6 }}>柵を ひろげよう！</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>{area.emoji} {area.name} の 3マス目を アンロック</div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: "12px 16px", marginBottom: 20 }}>
                {[
                  { icon: "🪙", label: "コイン",       have: gs.inventory.coins,         need: c.coins },
                  { icon: "🪵", label: "きのえだ",     have: gs.inventory.woodBranch,    need: c.woodBranch },
                  { icon: "⚙️", label: "てつのかけら", have: gs.inventory.ironFragment,  need: c.ironFragment },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{row.icon} {row.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: row.have >= row.need ? "#16a34a" : "#ef4444" }}>
                      {row.have} / {row.need} {row.have >= row.need ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setPopup(null)} style={{ flex: 1, padding: 12, borderRadius: 99, border: "2px solid #e5e7eb", background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>キャンセル</button>
                <button onClick={() => unlockSlot(popup.areaId)} disabled={!ok} style={{ flex: 2, padding: 12, borderRadius: 99, border: "none", background: ok ? "linear-gradient(90deg,#f59e0b,#f97316)" : "#d1d5db", color: "#fff", fontWeight: 900, fontSize: 15, cursor: ok ? "pointer" : "not-allowed", boxShadow: ok ? "0 4px 16px rgba(249,115,22,.4)" : "none" }}>🔓 アンロック！</button>
              </div>
            </div>
          </div>
        );
      })()}

      {sparkles && <SparklesBurst onDone={() => setSparkles(false)} />}
      {gs.feverHeartsVisible && <FeverHearts />}
      {toastMsg && <Toast msg={toastMsg} />}
    </div>
  );
}
