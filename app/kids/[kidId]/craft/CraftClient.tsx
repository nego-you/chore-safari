"use client";

import { useState, useRef } from "react";
import { useSafariStore } from "@/store/useSafariStore";

// ── 型定義 ──────────────────────────────────────────────
type MaterialId = "wood" | "stone" | "iron" | "thread" | "gunpowder";
type EffectType = "success" | "fail" | "failBonus" | null;

interface Material {
  id: MaterialId;
  name: string;
  emoji: string;
}

interface ResultItem {
  id: string;
  name: string;
  emoji: string;
  hint: string;
}

interface Recipe {
  ingredients: MaterialId[];
  result: ResultItem;
}

// ★ DELETED: type Inventory = Record<MaterialId, number>; (ストア InventoryMap に統一)
type SlotState = (MaterialId | null)[];
type DiscoveredState = Record<string, boolean>;

// ── 定数 ────────────────────────────────────────────────
const RECIPES: Recipe[] = [
  { ingredients: ["wood", "thread"],     result: { id: "bow",   name: "ながゆみ",   emoji: "🏹", hint: "きのえだ と いと をつかうみたいだ…" } },
  { ingredients: ["wood", "stone"],      result: { id: "spear", name: "いしのやり", emoji: "🗡️", hint: "きのえだ と いし をつかうみたいだ…" } },
  { ingredients: ["iron", "gunpowder"],  result: { id: "bomb",  name: "ばくだん",   emoji: "💣", hint: "てつ と かやく をつかうみたいだ…" } },
  { ingredients: ["iron", "thread"],     result: { id: "trap",  name: "トラバサミ", emoji: "🪤", hint: "てつ と いと をつかうみたいだ…" } },
];

const ALL_ITEMS: ResultItem[] = RECIPES.map(r => r.result);

const MATERIALS: Material[] = [
  { id: "wood",      name: "きのえだ", emoji: "🪵" },
  { id: "stone",     name: "いし",     emoji: "🪨" },
  { id: "iron",      name: "てつ",     emoji: "⚙️" },
  { id: "thread",    name: "いと",     emoji: "🧵" },
  { id: "gunpowder", name: "かやく",   emoji: "💥" },
];

// ★ DELETED: INIT_INVENTORY（ハードコードのモックデータ → ストアの inventory に統一）

// ── コンポーネント ───────────────────────────────────────
export default function CraftClient() {
  // ★ Zustand ストアから素材インベントリを取得
  const inventory       = useSafariStore((s) => s.inventory);
  const consumeInventory = useSafariStore((s) => s.consumeInventory);
  const addToInventory   = useSafariStore((s) => s.addToInventory);

  const [slots, setSlots]                   = useState<SlotState>([null, null, null]);
  const [inspirationFrags, setInspirationFrags] = useState<number>(0);
  const [discovered, setDiscovered]         = useState<DiscoveredState>({});
  const [hintShown, setHintShown]           = useState<DiscoveredState>({});
  const [effect, setEffect]                 = useState<EffectType>(null);
  const [resultItem, setResultItem]         = useState<ResultItem | null>(null);
  const _shakeRef = useRef<HTMLDivElement>(null);

  // ── ハンドラ ───────────────────────────────────────────
  const addToSlot = (materialId: MaterialId): void => {
    if ((inventory[materialId] ?? 0) <= 0) return;
    const emptyIdx = slots.findIndex(s => s === null);
    if (emptyIdx === -1) return;
    const newSlots: SlotState = [...slots];
    newSlots[emptyIdx] = materialId;
    setSlots(newSlots);
    // ★ BEFORE: setInventory(prev => ({ ...prev, [materialId]: prev[materialId] - 1 }))
    consumeInventory(materialId, 1);
  };

  const removeFromSlot = (idx: number): void => {
    const mat = slots[idx];
    if (!mat) return;
    const newSlots: SlotState = [...slots];
    newSlots[idx] = null;
    setSlots(newSlots);
    // ★ BEFORE: setInventory(prev => ({ ...prev, [mat]: prev[mat] + 1 }))
    addToInventory(mat, 1);
  };

  const tryCraft = (): void => {
    const used = slots.filter((s): s is MaterialId => s !== null);
    if (used.length === 0) return;

    const sorted = [...used].sort();
    const match = RECIPES.find(r => {
      const rs = [...r.ingredients].sort();
      return rs.length === sorted.length && rs.every((v, i) => v === sorted[i]);
    });

    if (match) {
      setEffect("success");
      setResultItem(match.result);
      setDiscovered(prev => ({ ...prev, [match.result.id]: true }));
      setSlots([null, null, null]);
      setTimeout(() => { setEffect(null); setResultItem(null); }, 3200);
    } else {
      setEffect("fail");
      // ★ BEFORE: used.forEach(mat => setInventory(prev => ({ ...prev, [mat]: prev[mat] + 1 })))
      used.forEach(mat => addToInventory(mat, 1));
      setSlots([null, null, null]);
      setTimeout(() => {
        setEffect("failBonus");
        setInspirationFrags(p => p + 1);
        setTimeout(() => { setEffect(null); }, 2200);
      }, 1600);
    }
  };

  const showHint = (itemId: string): void => {
    if (inspirationFrags < 1) return;
    setInspirationFrags(p => p - 1);
    setHintShown(prev => ({ ...prev, [itemId]: true }));
  };

  const getMaterialEmoji = (id: MaterialId): string =>
    MATERIALS.find(m => m.id === id)?.emoji ?? "❓";

  // ── JSX ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a0e06 0%, #2d1a0a 40%, #1c1008 100%)",
      display: "flex",
      justifyContent: "center",
      padding: "16px 0 40px",
      fontFamily: "'Zen Maru Gothic', 'Noto Sans JP', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap');

        @keyframes shake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px) rotate(-2deg)}
          30%{transform:translateX(8px) rotate(2deg)}
          45%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
        @keyframes puff {
          0%{opacity:1;transform:scale(0.8)}
          40%{opacity:0.9;transform:scale(1.3)}
          100%{opacity:0;transform:scale(2.2)}
        }
        @keyframes sparkle {
          0%{opacity:0;transform:scale(0.5) rotate(0deg)}
          30%{opacity:1;transform:scale(1.2) rotate(20deg)}
          60%{opacity:1;transform:scale(1.0) rotate(-10deg)}
          100%{opacity:0;transform:scale(1.5) rotate(30deg)}
        }
        @keyframes bounceIn {
          0%{transform:scale(0);opacity:0}
          50%{transform:scale(1.3);opacity:1}
          70%{transform:scale(0.9)}
          100%{transform:scale(1)}
        }
        @keyframes glow {
          0%,100%{box-shadow:0 0 10px #ffd700,0 0 20px #ffd700}
          50%{box-shadow:0 0 25px #ffe066,0 0 50px #ffa500}
        }
        .btn-craft {
          background: linear-gradient(135deg, #c8860a 0%, #e8a020 50%, #c8860a 100%);
          border: 2px solid #ffd700;
          color: #fff7e0;
          font-weight: 900;
          font-family: inherit;
          font-size: 17px;
          padding: 14px 28px;
          border-radius: 12px;
          cursor: pointer;
          letter-spacing: 1px;
          transition: transform 0.1s, box-shadow 0.2s;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          box-shadow: 0 4px 16px rgba(200,134,10,0.5);
          width: 100%;
        }
        .btn-craft:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(200,134,10,0.7); }
        .btn-craft:active { transform: scale(0.97); }
        .btn-craft:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .mat-btn {
          background: linear-gradient(135deg, #3d2510 0%, #5a3818 100%);
          border: 1.5px solid #8b5e2f;
          border-radius: 10px;
          padding: 8px 4px;
          cursor: pointer;
          transition: transform 0.1s, border-color 0.2s;
          color: #f0dbb0;
          font-family: inherit;
          font-size: 13px;
          text-align: center;
        }
        .mat-btn:hover:not(:disabled) { transform: scale(1.05); border-color: #d4a055; }
        .mat-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .slot-box {
          background: radial-gradient(circle, #2e1b0a 0%, #1a0f05 100%);
          border: 2px dashed #7a5230;
          border-radius: 12px;
          width: 72px; height: 72px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          font-size: 28px;
          position: relative;
        }
        .slot-box.filled {
          border: 2px solid #d4a055;
          background: radial-gradient(circle, #3d2510 0%, #2a1508 100%);
          box-shadow: inset 0 0 8px rgba(212,160,85,0.2);
        }
        .slot-box.filled:hover { border-color: #ff9944; background: radial-gradient(circle, #4a2d14 0%, #2a1508 100%); }
        .notebook-item {
          background: linear-gradient(135deg, #2a1c0c 0%, #3a260f 100%);
          border: 1px solid #6b4820;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hint-btn {
          background: linear-gradient(135deg, #1a3a5c, #1e4a70);
          border: 1.5px solid #4a8fc0;
          color: #a0d4ff;
          font-family: inherit;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .hint-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* ── ヘッダー ── */}
        <div style={{
          background: "linear-gradient(135deg, #3d1f05 0%, #5a2d08 50%, #3d1f05 100%)",
          border: "2px solid #a06020",
          borderRadius: "0 0 16px 16px",
          padding: "16px 20px 12px",
          textAlign: "center",
          marginBottom: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 11, color: "#c49050", letterSpacing: 3, marginBottom: 4 }}>⚗️ CRAFT WORKSHOP ⚗️</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#ffd880", textShadow: "0 0 20px rgba(255,200,50,0.5)" }}>
            はつめい工房
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <div style={{ background: "#1a0e06", border: "1px solid #7a5230", borderRadius: 8, padding: "4px 14px", fontSize: 14, color: "#ffd060" }}>
              💡 ひらめきのカケラ: <strong>{inspirationFrags}</strong>
            </div>
          </div>
        </div>

        {/* ── エフェクト：失敗（煙） ── */}
        {effect === "fail" && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 999, pointerEvents: "none",
          }}>
            <div style={{ fontSize: 100, animation: "puff 1.5s ease-out forwards" }}>💨</div>
          </div>
        )}

        {/* ── エフェクト：大成功 ── */}
        {effect === "success" && resultItem && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 999, pointerEvents: "none",
          }}>
            <div style={{ fontSize: 90, animation: "sparkle 2s ease-out" }}>{resultItem.emoji}</div>
            <div style={{
              marginTop: 16, fontSize: 22, fontWeight: 900, color: "#ffd060",
              textShadow: "0 0 20px rgba(255,200,50,0.8)",
              animation: "bounceIn 0.6s 0.3s both",
              textAlign: "center", padding: "0 20px",
            }}>
              ✨ だいせいこう！<br />「{resultItem.emoji} {resultItem.name}」を はつめいした！
            </div>
          </div>
        )}

        {/* ── エフェクト：ひらめきボーナス ── */}
        {effect === "failBonus" && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: "#1e3a5c", border: "2px solid #4a8fc0", borderRadius: 12,
            padding: "12px 20px", color: "#a0d4ff", fontSize: 15, fontWeight: 700,
            animation: "bounceIn 0.5s ease-out", zIndex: 999,
            textAlign: "center", pointerEvents: "none",
          }}>
            あ！かわりに「💡 ひらめきのカケラ」を てにいれた！
          </div>
        )}

        {/* ── 作業台エリア ── */}
        <div style={{
          margin: "0 12px",
          background: "linear-gradient(180deg, #2a1608 0%, #1e1005 100%)",
          border: "2px solid #7a5230",
          borderRadius: 16,
          padding: 16,
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
          animation: effect === "fail" ? "shake 0.5s ease-in-out" : undefined,
        }}>

          {/* 失敗メッセージ */}
          {effect === "fail" && (
            <div style={{
              textAlign: "center", color: "#ff9966", fontWeight: 700,
              fontSize: 16, marginBottom: 10, animation: "bounceIn 0.4s ease-out",
            }}>
              ボフッ！💨 ガラクタになっちゃった…
            </div>
          )}

          {/* ざいりょう */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "#c49050", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>📦 ざいりょう</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {MATERIALS.map((mat: Material) => {
                const count = inventory[mat.id] ?? 0;
                const slotsFull = slots.filter(Boolean).length >= 3;
                return (
                  <button
                    key={mat.id}
                    className="mat-btn"
                    onClick={() => addToSlot(mat.id)}
                    disabled={count <= 0 || slotsFull}
                  >
                    <div style={{ fontSize: 26 }}>{mat.emoji}</div>
                    <div style={{ fontSize: 10, marginTop: 2, color: "#d4a055" }}>{mat.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: count <= 0 ? "#6b3820" : "#ffd060", marginTop: 1 }}>
                      ×{count}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* スロット */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "#c49050", fontSize: 12, letterSpacing: 2, marginBottom: 8 }}>🔧 さぎょうだい（タップでもどせるよ）</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              {slots.map((slot: MaterialId | null, idx: number) => (
                <div
                  key={idx}
                  className={`slot-box${slot ? " filled" : ""}`}
                  onClick={() => slot && removeFromSlot(idx)}
                  title={slot ? "タップでもどす" : ""}
                >
                  {slot ? (
                    <>
                      <div style={{ fontSize: 32 }}>{getMaterialEmoji(slot)}</div>
                      <div style={{ fontSize: 9, color: "#d4a055", marginTop: 2 }}>
                        {MATERIALS.find(m => m.id === slot)?.name}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 28, opacity: 0.25 }}>＋</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 合成ボタン */}
          <button
            className="btn-craft"
            onClick={tryCraft}
            disabled={slots.every(s => s === null) || !!effect}
          >
            💡 これで つくってみる！
          </button>
        </div>

        {/* ── はつめいノート ── */}
        <div style={{
          margin: "16px 12px 0",
          background: "linear-gradient(180deg, #1a1205 0%, #120d03 100%)",
          border: "2px solid #6b4820",
          borderRadius: 16,
          padding: 16,
        }}>
          <div style={{
            color: "#e8c060", fontSize: 16, fontWeight: 900,
            marginBottom: 12, letterSpacing: 1,
            borderBottom: "1px solid #4a3010", paddingBottom: 8,
          }}>
            📖 はつめいノート
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ALL_ITEMS.map((item: ResultItem) => {
              const found: boolean = !!discovered[item.id];
              const hinted: boolean = !!hintShown[item.id];
              return (
                <div key={item.id} className="notebook-item">
                  <div style={{
                    fontSize: 36, width: 44, textAlign: "center",
                    filter: found ? "none" : "brightness(0) opacity(0.5)",
                    flexShrink: 0,
                  }}>
                    {found ? item.emoji : "⬛"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: found ? "#ffd060" : "#555" }}>
                      {found ? item.name : "？？？"}
                    </div>
                    {found ? (
                      <div style={{ fontSize: 11, color: "#8b6030", marginTop: 2 }}>✅ はつめいずみ</div>
                    ) : hinted ? (
                      <div style={{ fontSize: 12, color: "#80c4e8", marginTop: 3 }}>
                        💭 {item.hint}
                      </div>
                    ) : (
                      <button
                        className="hint-btn"
                        onClick={() => showHint(item.id)}
                        disabled={inspirationFrags < 1}
                        style={{ marginTop: 4 }}
                      >
                        💡 ヒントをみる（カケラ×1）
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: 12, fontSize: 11, color: "#5a3a1a",
            textAlign: "center", borderTop: "1px solid #3a2010", paddingTop: 8,
          }}>
            ごうせいに しっぱいするたびに「ひらめきのカケラ」がもらえるよ！
          </div>
        </div>

      </div>
    </div>
  );
}
