"use client";
import { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   どうぶつえん（やさしいバージョン）
   ------------------------------------------------------------
   2026-05-29 改修（Notion「流れの見える化」指示）:
   - 「放置インカム（incomePerTick 自動加算）」「2倍フィーバー」
     「コインで柵を買って拡張」という お金もうけ中心の作りを撤去。
   - どうぶつえんの目的を「どうぶつを みんなに みせて」「きれいに たもち」
     「おきゃくさんを えがおにする」ことへ。
   - お客さんは よろこんで、ときどき「ありがとう」の おれい
     （少しのコイン・タネ・レア素材）を くれる やさしいモデルに。
   - 主な手ごたえは「えがおにした おきゃくさんの かず」（お金ではない）。
   ============================================================ */

type Habitat = "savanna" | "forest" | "glacier";
type Diet = "CARNIVORE" | "HERBIVORE" | "PISCIVORE";
type GiftType = "smile" | "coins" | "material" | "seed";

interface Animal {
  id: string;
  name: string;
  emoji: string;
  habitat: Habitat;
  diet: Diet;
  rarity: 1 | 2 | 3;
}

interface ExhibitArea {
  id: Habitat;
  name: string;
  emoji: string;
  accentColor: string;
  groundColor: string;
  fenceColor: string;
  grassEmoji: string;
}

interface GoodVisitor {
  kind: "good";
  id: string;
  emoji: string;
  name: string;
  message: string;
  gift: { type: GiftType; amount: number };
  giftLabel: string;
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
  penalty: { type: "cleanliness" | "block"; cleaninessDelta?: number; blockArea?: Habitat };
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

interface SlotMood {
  scared: boolean;
  friendly: boolean;
  tooltip: string;
}

interface Inventory {
  coins: number;
  seed: number;
  material: number;
}

interface GameState {
  inventory: Inventory;
  cleanliness: number;
  smiles: number; // きょう えがおにした おきゃくさんの かず
  placedAnimals: Record<Habitat, (string | null)[]>;
  blockedAreas: Set<Habitat>;
}

type PopupState =
  | { kind: "good"; visitor: ActiveVisitor; template: GoodVisitor }
  | { kind: "bad"; visitor: ActiveVisitor; template: BadVisitor }
  | { kind: "place"; areaId: Habitat; slot: number }
  | null;

/* ============================================================
   STATIC DATA
   ============================================================ */
const ANIMALS: Animal[] = [
  { id: "lion",    name: "ライオン", emoji: "🦁",    habitat: "savanna", diet: "CARNIVORE" , rarity: 3 },
  { id: "zebra",   name: "シマウマ", emoji: "🦓",    habitat: "savanna", diet: "HERBIVORE" , rarity: 2 },
  { id: "giraffe", name: "キリン",   emoji: "🦒",    habitat: "savanna", diet: "HERBIVORE" , rarity: 2 },
  { id: "rabbit",  name: "ウサギ",   emoji: "🐰",    habitat: "forest",  diet: "HERBIVORE" , rarity: 1 },
  { id: "deer",    name: "シカ",     emoji: "🦌",    habitat: "forest",  diet: "HERBIVORE" , rarity: 2 },
  { id: "fox",     name: "キツネ",   emoji: "🦊",    habitat: "forest",  diet: "CARNIVORE" , rarity: 2 },
  { id: "penguin", name: "ペンギン", emoji: "🐧",    habitat: "glacier", diet: "PISCIVORE" , rarity: 2 },
  { id: "polar",   name: "シロクマ", emoji: "🐻‍❄️", habitat: "glacier", diet: "CARNIVORE" , rarity: 3 },
  { id: "seal",    name: "アザラシ", emoji: "🦭",    habitat: "glacier", diet: "PISCIVORE" , rarity: 1 },
];

const EXHIBIT_AREAS: ExhibitArea[] = [
  { id: "savanna", name: "サバンナ",   emoji: "🌅", accentColor: "#f97316", groundColor: "#fde68a", fenceColor: "#92400e", grassEmoji: "🌾" },
  { id: "forest",  name: "もりの中",   emoji: "🌲", accentColor: "#16a34a", groundColor: "#bbf7d0", fenceColor: "#166534", grassEmoji: "🌿" },
  { id: "glacier", name: "こおりの国", emoji: "❄️", accentColor: "#0ea5e9", groundColor: "#e0f2fe", fenceColor: "#0369a1", grassEmoji: "❄️" },
];

// お客さんの「ありがとう」。ほとんどは えがお（コインなし）。
// たまに 少しだけ おれいの しなものを くれる ── お金もうけにはならない やさしい量。
const GOOD_VISITORS: GoodVisitor[] = [
  { kind: "good", id: "child",     emoji: "🧒", name: "あそびに きた こども",   message: "どうぶつさん かわいい！ また みに くるね！",                gift: { type: "smile",    amount: 0 }, giftLabel: "えがおに なった！" },
  { kind: "good", id: "family",    emoji: "👨‍👩‍👧", name: "かぞくの おきゃくさん",  message: "たのしい いちにちだったね。ありがとう！",                    gift: { type: "smile",    amount: 0 }, giftLabel: "えがおに なった！" },
  { kind: "good", id: "grandma",   emoji: "👵", name: "えがおの おばあちゃん",   message: "どうぶつたちが しあわせそうで、げんきを もらえたわ。おれいね！", gift: { type: "coins",    amount: 10 }, giftLabel: "おれいに コイン10まい！" },
  { kind: "good", id: "professor", emoji: "🎓", name: "どうぶつハカセ",          message: "あいじょう たっぷりの どうぶつえんだね！ これ あげよう。",      gift: { type: "material",  amount: 1 }, giftLabel: "レアそざいを もらった！", requiresHighCleanliness: true },
  { kind: "good", id: "ranger",    emoji: "🌳", name: "しぜんほご レンジャー",   message: "ゴミひとつ なくて、とっても きれいな どうぶつえんだね！",        gift: { type: "seed",     amount: 1 }, giftLabel: "のうじょうの タネを もらった！", requiresHighCleanliness: true },
];

const BAD_VISITORS: BadVisitor[] = [
  { kind: "bad", id: "litterer", emoji: "😤", name: "ポイ捨てする人", troubleIcon: "🍌", troubleText: "ポイすてしてるよ！",  warningText: "ダメ！ ゴミはゴミばこにすててね！",         resolveText: "ごめんなさい…ゴミを拾います。",   penalty: { type: "cleanliness", cleaninessDelta: -18 }, resolveDelta: 14 },
  { kind: "bad", id: "noisy",    emoji: "😠", name: "うるさいひと",   troubleIcon: "💢", troubleText: "さわいでいるよ！",    warningText: "ダメ！ どうぶつさんがびっくりしてるよ！", resolveText: "ごめんなさい…もうしません。",       penalty: { type: "block", blockArea: "savanna" },        resolveDelta: 10 },
];

const SPARKLE_COLORS = ["#fbbf24","#f472b6","#34d399","#60a5fa","#a78bfa","#fb923c","#4ade80"];
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

/* ============================================================
   どうぶつの きもち（となりに だれが いるか）
   - 草食のとなりに 肉食 → こわがる（しあわせメーターが さがる演出）
   - 草食どうしが となり → なかよし
   ※ お金（インカム）とは つながっていない。どうぶつの しあわせのため。
   ============================================================ */
function evaluateMoods(slots: (string | null)[]): SlotMood[] {
  const animals = slots.map(id => id ? (ANIMALS.find(a => a.id === id) ?? null) : null);
  return animals.map((animal, i) => {
    if (!animal) return { scared: false, friendly: false, tooltip: "" };
    const neighbors = [
      i > 0 ? animals[i - 1] : null,
      i < animals.length - 1 ? animals[i + 1] : null,
    ].filter(Boolean) as Animal[];

    const predator = animal.diet === "HERBIVORE"
      ? neighbors.find(n => n.diet === "CARNIVORE")
      : undefined;
    if (predator) {
      return { scared: true, friendly: false, tooltip: `${animal.name} が ${predator.name} を こわがっているよ！` };
    }

    const friend = animal.diet === "HERBIVORE"
      ? neighbors.find(n => n.diet === "HERBIVORE" && n.habitat === animal.habitat)
      : undefined;
    if (friend) {
      return { scared: false, friendly: true, tooltip: "" };
    }
    return { scared: false, friendly: false, tooltip: "" };
  });
}

/* よごれが すすむ はやさ ── どうぶつが おおいほど はやく よごれる（おせわが たいせつ） */
function decayInterval(totalAnimals: number): number {
  return Math.max(1400, 4200 - totalAnimals * 280);
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
    inventory: { coins: 120, seed: 0, material: 0 },
    cleanliness: 80,
    smiles: 0,
    placedAnimals: { savanna: ["lion", "zebra", null], forest: ["rabbit", null, null], glacier: [null, null, null] },
    blockedAreas: new Set(),
  });

  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);
  const [popup, setPopup] = useState<PopupState>(null);
  const [sparkles, setSparkles] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [resolvingUid, setResolvingUid] = useState<number | null>(null);
  const [hoveredScared, setHoveredScared] = useState<{ areaId: Habitat; slot: number } | null>(null);
  const uidRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const totalPlaced = (state: GameState) =>
    Object.values(state.placedAnimals).flat().filter(Boolean).length;

  /* ── よごれ（おせわ）── どうぶつが おおいほど はやく よごれる ── */
  useEffect(() => {
    const interval = decayInterval(totalPlaced(gs));
    const t = setInterval(() => {
      setGs(prev => ({ ...prev, cleanliness: Math.max(0, prev.cleanliness - 1) }));
    }, interval);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPlaced(gs)]);

  /* ── おきゃくさんが やってくる ── きれいだと いいお客さんが ふえる ── */
  useEffect(() => {
    const t = setInterval(() => {
      // どうぶつが いないと だれも こない
      if (totalPlaced(gs) === 0) return;
      const roll = Math.random();
      // よごれていると こまった人の わりあいが ふえる
      const badChance = gs.cleanliness >= 60 ? 0.16 : 0.30;
      if (roll < badChance) {
        spawnVisitor("bad", BAD_VISITORS[rnd(0, BAD_VISITORS.length - 1)]);
      } else if (roll < badChance + 0.32) {
        const pool = GOOD_VISITORS.filter(v => !v.requiresHighCleanliness || gs.cleanliness >= 65);
        spawnVisitor("good", pool[rnd(0, pool.length - 1)]);
      }
    }, 2400);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.cleanliness, gs.placedAnimals]);

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
    setGs(p => {
      const inv = { ...p.inventory };
      if (template.gift.type === "coins")    inv.coins    += template.gift.amount;
      if (template.gift.type === "seed")     inv.seed     += template.gift.amount;
      if (template.gift.type === "material") inv.material += template.gift.amount;
      return { ...p, inventory: inv, smiles: p.smiles + 1 };
    });
    showToast(`💗 ${template.giftLabel}`);
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
    showToast("💪 えらい！ ゆうきを だしたね！");
    setTimeout(() => { setResolvingUid(null); setPopup(null); }, 1200);
  }

  function placeAnimalFromModal(areaId: Habitat, slot: number, animalId: string) {
    setGs(p => { const c = { ...p, placedAnimals: { ...p.placedAnimals, [areaId]: [...p.placedAnimals[areaId]] } }; c.placedAnimals[areaId][slot] = animalId; return c; });
    setPopup(null);
    showToast("🐾 どうぶつを てんじしたよ！");
  }

  function removeAnimal(areaId: Habitat, slot: number) {
    setGs(p => { const c = { ...p, placedAnimals: { ...p.placedAnimals, [areaId]: [...p.placedAnimals[areaId]] } }; c.placedAnimals[areaId][slot] = null; return c; });
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
        @keyframes popIn      { 0%{transform:scale(.2) translateY(30px);opacity:0} 60%{transform:scale(1.1) translateY(-4px)} 100%{transform:scale(1) translateY(0);opacity:1} }
        @keyframes slideUp    { 0%{transform:translateY(100%);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes sparklePop { 0%{transform:scale(0) rotate(0deg);opacity:1} 100%{transform:scale(1.8) rotate(270deg);opacity:0} }
        @keyframes toastIn    { 0%{transform:translateX(-50%) translateY(20px);opacity:0} 100%{transform:translateX(-50%) translateY(0);opacity:1} }
        @keyframes pulseBad   { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.6)} 50%{box-shadow:0 0 0 10px rgba(239,68,68,0)} }
        @keyframes shakeX     { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        @keyframes sorryDrop  { 0%{transform:scale(1)} 100%{transform:scale(.5) translateY(20px);opacity:0} }
        @keyframes sweatDrip  { 0%,100%{transform:translateY(0) scale(1);opacity:1} 50%{transform:translateY(5px) scale(.8);opacity:.6} }
        @keyframes friendGlow { 0%,100%{box-shadow:0 0 0 0 #86efac55} 50%{box-shadow:0 0 0 8px #86efac00} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(90deg,#f59e0b,#f97316,#ef4444)", padding: "14px 16px 12px", borderRadius: "0 0 28px 28px", boxShadow: "0 6px 20px rgba(249,115,22,.35)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -10, top: -10, fontSize: 80, opacity: .13 }}>🦁</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.25)" }}>🦁 どうぶつえん</div>
            <div style={{ fontSize: 11, color: "#fffc", marginTop: 2 }}>みんなに みせて、えがおを とどけよう</div>
          </div>
          {/* えがおカウンター（このどうぶつえんの いちばん だいじな すうじ） */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>😊 {gs.smiles}</div>
            <div style={{ fontSize: 10, color: "#fffc" }}>えがおに したよ</div>
          </div>
        </div>

        {/* もらった おれい（コイン・タネ・そざい） */}
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          {[
            { icon: "🪙", v: gs.inventory.coins },
            { icon: "🌱", v: gs.inventory.seed },
            { icon: "⭐", v: gs.inventory.material },
          ].map((it, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.22)", borderRadius: 99, padding: "2px 10px" }}>
              {it.icon} {it.v.toLocaleString()}
            </span>
          ))}
        </div>

        {/* きれいさ（おせわメーター） */}
        <div style={{ marginTop: 10, background: "rgba(255,255,255,.2)", borderRadius: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>🧹</span>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: "rgba(255,255,255,.3)", borderRadius: 99 }}>
              <div style={{ width: `${gs.cleanliness}%`, height: "100%", background: cleanColor, borderRadius: 99, transition: "width .6s,background .6s", boxShadow: `0 0 8px ${cleanColor}` }} />
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: cleanColor, background: "rgba(255,255,255,.9)", padding: "1px 7px", borderRadius: 99 }}>{gs.cleanliness}% {cleanLabel}</span>
        </div>
        {gs.cleanliness < 60 && (
          <div style={{ marginTop: 5, fontSize: 10, color: "#fff", textAlign: "right" }}>
            ⚠️ よごれてると いいお客さんが へっちゃう。きれいに しよう！
          </div>
        )}
      </div>

      {/* ── あんない（やくわり せつめい）── */}
      <div style={{ margin: "12px 16px 0", background: "#fff", borderRadius: 18, padding: "10px 14px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
        🐾 どうぶつを <b>てんじ</b>して、🧹 <b>きれいに たもつ</b>と、おきゃくさんが <b>えがお</b>に なるよ。
        よろこんだ おきゃくさんが、ときどき <b>ありがとう</b>を くれるよ！
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
          <span>🎪 どうぶつえんの ひろば</span>
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
          {animalCount === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af", fontWeight: 700, textAlign: "center", padding: 12 }}>
              どうぶつを てんじすると、おきゃくさんが あそびに くるよ！
            </div>
          )}
        </div>
      </div>

      {/* ── EXHIBIT AREAS ── */}
      {EXHIBIT_AREAS.map(area => {
        const slots     = gs.placedAnimals[area.id];
        const isBlocked = gs.blockedAreas.has(area.id);
        const moods     = evaluateMoods(slots);
        const hasFriend = moods.some(m => m.friendly);
        const hasScared = moods.some(m => m.scared);

        return (
          <div key={area.id} style={{ margin: "12px 16px 0", borderRadius: 22, overflow: "hidden", border: `3px solid ${isBlocked ? "#fca5a5" : hasScared ? "#fde68a" : area.accentColor}55`, boxShadow: `0 4px 16px ${area.accentColor}22`, background: "#fff" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(90deg,${area.accentColor}22,${area.accentColor}08)`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${area.accentColor}22` }}>
              <span style={{ fontWeight: 900, color: area.accentColor, fontSize: 15 }}>{area.emoji} {area.name}</span>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {hasFriend && <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #bbf7d0" }}>✨ なかよし</span>}
                {hasScared && <span style={{ fontSize: 10, background: "#fffbeb", color: "#d97706", borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #fde68a" }}>💦 こわがってる</span>}
                {isBlocked && <span style={{ fontSize: 10, background: "#fef2f2", color: "#ef4444", borderRadius: 8, padding: "2px 7px", fontWeight: 700, border: "1px solid #fca5a5" }}>⚠️ びっくり中</span>}
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

              {/* Slots row（3マス すべて さいしょから つかえる） */}
              <div style={{ display: "flex", gap: 8, position: "relative" }}>
                {slots.map((animalId, slot) => {
                  const animal = animalId ? ANIMALS.find(a => a.id === animalId) : null;
                  const mood = moods[slot];
                  const isHov = hoveredScared?.areaId === area.id && hoveredScared?.slot === slot;
                  return (
                    <div key={slot} style={{ flex: 1, position: "relative" }}>
                      {isHov && mood.scared && <Tooltip text={mood.tooltip} />}
                      {animal ? (
                        <div
                          onClick={() => removeAnimal(area.id, slot)}
                          onMouseEnter={() => mood.scared && setHoveredScared({ areaId: area.id, slot })}
                          onMouseLeave={() => setHoveredScared(null)}
                          style={{ height: 98, borderRadius: 14, cursor: "pointer", position: "relative", background: mood.scared ? "#fffbeb" : mood.friendly ? "#f0fdf4" : `${area.accentColor}18`, border: `2px solid ${mood.scared ? "#fde68a" : mood.friendly ? "#86efac" : area.accentColor}99`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: mood.friendly ? "friendGlow 2s ease-in-out infinite" : "none" }}
                        >
                          {mood.scared  && <div style={{ position: "absolute", top: 5, right: 6, fontSize: 13, animation: "sweatDrip 1s ease-in-out infinite" }}>💦</div>}
                          {mood.friendly && <div style={{ position: "absolute", top: 4, left: 5, fontSize: 12, animation: "floatY 1.5s ease-in-out infinite" }}>✨</div>}
                          <div style={{ fontSize: 36, animation: "floatY 2.2s ease-in-out infinite" }}>{animal.emoji}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: area.accentColor, marginTop: 2 }}>{animal.name}</div>
                          <div style={{ fontSize: 10, color: mood.scared ? "#d97706" : mood.friendly ? "#16a34a" : "#9ca3af" }}>
                            {mood.scared ? "こわいよ…" : mood.friendly ? "なかよし！" : "げんき"}
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
              </div>
            </div>
          </div>
        );
      })}

      {/* ── INVENTORY ── */}
      <div style={{ margin: "14px 16px 0", background: "#fff", borderRadius: 20, padding: "12px 14px", boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight: 900, fontSize: 14, color: "#374151", marginBottom: 8 }}>🎒 もっている どうぶつ</div>
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
                    {isPlaced ? "てんじ中" : `${a.diet === "CARNIVORE" ? "🥩 にくしょく" : a.diet === "HERBIVORE" ? "🌿 そうしょく" : "🐟 ぎょしょく"}`}
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
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.75, background: "#fffbeb", borderRadius: 16, padding: "12px 16px", marginBottom: 14, border: "2px solid #fde68a" }}>
              💬 {popup.template.message}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#f59e0b", marginBottom: 18 }}>
              {popup.template.gift.type === "smile" ? "😊 えがおに なった！" : `🎁 ${popup.template.giftLabel}`}
            </div>
            <button onClick={resolveGood} style={{ width: "100%", padding: 14, borderRadius: 99, border: "none", background: "linear-gradient(90deg,#fbbf24,#f97316)", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 16px rgba(249,115,22,.4)" }}>どういたしまして！✨</button>
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
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>ほうちすると きれいさが さがるよ！</div>
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
              <span style={{ fontWeight: 900, fontSize: 16, color: "#374151" }}>🐾 どうぶつを えらぶ</span>
              <button onClick={() => setPopup(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: 99, padding: "4px 12px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>とじる</button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", background: "#f8fafc", borderRadius: 10, padding: "6px 10px", marginBottom: 10, lineHeight: 1.7 }}>
              🌿 そうしょくどうし → <b style={{ color: "#16a34a" }}>なかよし</b>　　🥩＋🌿 となりあう → <b style={{ color: "#d97706" }}>こわがる</b>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ANIMALS.filter(a => a.habitat === popup.areaId && !placedIds.includes(a.id)).map(a => {
                const ac = EXHIBIT_AREAS.find(x => x.id === a.habitat)!.accentColor;
                return (
                  <button key={a.id} onClick={() => placeAnimalFromModal(popup.areaId, popup.slot, a.id)} style={{ flex: "1 1 28%", minWidth: 88, padding: "12px 6px", borderRadius: 16, border: `2px solid ${ac}44`, background: `${ac}11`, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 34 }}>{a.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>{a.diet === "CARNIVORE" ? "🥩 にくしょく" : a.diet === "HERBIVORE" ? "🌿 そうしょく" : "🐟 ぎょしょく"}</div>
                  </button>
                );
              })}
              {ANIMALS.filter(a => a.habitat === popup.areaId && !placedIds.includes(a.id)).length === 0 && (
                <div style={{ width: "100%", textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>てんじできる どうぶつが いないよ</div>
              )}
            </div>
          </div>
        </div>
      )}

      {sparkles && <SparklesBurst onDone={() => setSparkles(false)} />}
      {toastMsg && <Toast msg={toastMsg} />}
    </div>
  );
}
