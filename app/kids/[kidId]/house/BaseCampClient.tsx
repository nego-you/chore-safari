"use client";

import { useState, useEffect, useRef } from "react";

const INITIAL_ANIMALS = [
  { id: 1, emoji: "🦕", name: "ブラキオ", rarity: "レア", count: 2 },
  { id: 2, emoji: "🦖", name: "ティラノ", rarity: "でんせつ", count: 1 },
  { id: 3, emoji: "🐘", name: "ゾウ", rarity: "ふつう", count: 3 },
  { id: 4, emoji: "🦁", name: "ライオン", rarity: "レア", count: 1 },
  { id: 5, emoji: "🐼", name: "パンダ", rarity: "レア", count: 2 },
];

const MEDALS_DEF = [
  { id: "first", emoji: "🥉", name: "はじめての おてつだい", desc: "はじめて おてつだい を した！", condition: "help1", goal: 1 },
  { id: "farm", emoji: "🥈", name: "ファーム・マスター", desc: "どうぶつを 10ぴき そだてた！", condition: "animals10", goal: 10 },
  { id: "hunter", emoji: "🥇", name: "でんせつの ハンター", desc: "でんせつの どうぶつを つかまえた！", condition: "legendary", goal: 1 },
  { id: "logistics", emoji: "🏆", name: "ぶつりゅう の ほし", desc: "ぶつりゅうセンターへ 20ひき おくった！", condition: "shipped20", goal: 20 },
];

function randomPos(max) { return Math.random() * max; }

function AnimalSprite({ animal, style }) {
  const animClass = animal.rarity === "でんせつ"
    ? "animate-legendary"
    : animal.rarity === "レア"
    ? "animate-wander"
    : "animate-float";
  return (
    <div
      className={`absolute select-none cursor-default ${animClass}`}
      style={{ fontSize: animal.rarity === "でんせつ" ? "2.8rem" : "2rem", ...style }}
      title={`${animal.name}（${animal.rarity}）`}
    >
      {animal.emoji}
    </div>
  );
}

function Confetti({ active }) {
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(i => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${10 + Math.random() * 20}px`,
            fontSize: `${1 + Math.random()}rem`,
            animationDelay: `${Math.random() * 1.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        >
          {["🎊","🎉","⭐","✨","🌟","💫"][Math.floor(Math.random() * 6)]}
        </div>
      ))}
    </div>
  );
}

function TruckAnimation({ active }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden flex items-center">
      <div className="animate-truck text-6xl">🚚</div>
    </div>
  );
}

export default function BaseCampClient() {
  const [animals, setAnimals] = useState(INITIAL_ANIMALS);
  const [medals, setMedals] = useState({ first: null, farm: null, hunter: null, logistics: null });
  const [stats, setStats] = useState({ helped: 1, totalAnimals: 8, legendary: 1, shipped: 5 });
  const [modal, setModal] = useState(null); // null | 'view' | 'ship' | 'rest' | 'medals' | 'medalDetail'
  const [selectedMedal, setSelectedMedal] = useState(null);
  const [selectedShip, setSelectedShip] = useState([]);
  const [stamina, setStamina] = useState(60);
  const [resting, setResting] = useState(false);
  const [truckAnim, setTruckAnim] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [newMedal, setNewMedal] = useState(null);
  const [animalPositions] = useState(() =>
    INITIAL_ANIMALS.flatMap(a =>
      Array.from({ length: a.count }, (_, i) => ({
        key: `${a.id}-${i}`,
        animal: a,
        x: 5 + Math.random() * 80,
        y: 5 + Math.random() * 70,
      }))
    )
  );

  // medal check
  const checkMedals = (newStats, newAnimals) => {
    const unlocked = [];
    const s = newStats || stats;
    const prev = medals;

    const conditions = {
      first: s.helped >= 1,
      farm: s.totalAnimals >= 10,
      hunter: s.legendary >= 1,
      logistics: s.shipped >= 20,
    };

    const next = { ...prev };
    Object.entries(conditions).forEach(([k, met]) => {
      if (met && !prev[k]) {
        next[k] = new Date().toLocaleDateString("ja-JP");
        unlocked.push(k);
      }
    });
    if (unlocked.length > 0) {
      setMedals(next);
      setNewMedal(MEDALS_DEF.find(m => m.id === unlocked[0]));
      setConfetti(true);
      setTimeout(() => setConfetti(false), 4000);
    }
  };

  useEffect(() => { checkMedals(stats, animals); }, []);

  const handleRest = () => {
    setResting(true);
    setModal("rest");
    setTimeout(() => {
      setStamina(100);
      setResting(false);
      setModal(null);
    }, 2500);
  };

  const handleShip = () => {
    if (selectedShip.length === 0) return;
    const shipped = selectedShip.reduce((acc, id) => {
      const a = animals.find(x => x.id === id);
      return acc + (a ? a.count : 0);
    }, 0);
    const newAnimals = animals.filter(a => !selectedShip.includes(a.id));
    const newStats = { ...stats, shipped: stats.shipped + shipped };
    setAnimals(newAnimals);
    setStats(newStats);
    setSelectedShip([]);
    setModal(null);
    setTruckAnim(true);
    setTimeout(() => setTruckAnim(false), 2000);
    checkMedals(newStats, newAnimals);
  };

  const staminaColor = stamina > 60 ? "bg-green-400" : stamina > 30 ? "bg-yellow-400" : "bg-red-400";

  const rarityColor = {
    "ふつう": "bg-gray-100 text-gray-700",
    "レア": "bg-blue-100 text-blue-700",
    "でんせつ": "bg-yellow-100 text-yellow-800",
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-bold select-none" style={{ fontFamily: "'Rounded Mplus 1c', 'M PLUS Rounded 1c', 'Noto Sans JP', sans-serif", background: "#87CEEB" }}>
      <style>{`
        @keyframes float {
          0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-8px) rotate(3deg)}
        }
        @keyframes wander {
          0%{transform:translate(0,0) scaleX(1)} 25%{transform:translate(8px,-4px) scaleX(1)} 50%{transform:translate(0,6px) scaleX(-1)} 75%{transform:translate(-8px,-2px) scaleX(-1)} 100%{transform:translate(0,0) scaleX(1)}
        }
        @keyframes legendary {
          0%{transform:translate(0,0) scale(1)} 20%{transform:translate(10px,-6px) scale(1.05)} 40%{transform:translate(-8px,4px) scale(0.95)} 60%{transform:translate(6px,-2px) scale(1.08)} 80%{transform:translate(-5px,5px) scale(1)} 100%{transform:translate(0,0) scale(1)}
        }
        @keyframes confetti {
          0%{transform:translateY(0) rotate(0deg); opacity:1}
          100%{transform:translateY(110vh) rotate(720deg); opacity:0}
        }
        @keyframes truck {
          0%{transform:translateX(-120px)} 100%{transform:translateX(110vw)}
        }
        @keyframes shimmer {
          0%,100%{opacity:1;filter:brightness(1)} 50%{opacity:0.7;filter:brightness(1.5)}
        }
        @keyframes popup {
          0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1}
        }
        .animate-float{animation:float 3s ease-in-out infinite;}
        .animate-wander{animation:wander 5s ease-in-out infinite;}
        .animate-legendary{animation:legendary 4s ease-in-out infinite;}
        .animate-confetti{animation:confetti linear forwards;}
        .animate-truck{animation:truck 1.8s ease-in forwards;}
        .animate-shimmer{animation:shimmer 1.5s ease-in-out infinite;}
        .animate-popup{animation:popup 0.5s ease-out forwards;}
        .medal-unlocked{filter:drop-shadow(0 0 6px gold);}
      `}</style>

      <Confetti active={confetti} />
      <TruckAnimation active={truckAnim} />

      {/* New Medal Popup */}
      {confetti && newMedal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-popup bg-yellow-400 border-4 border-yellow-600 rounded-3xl px-8 py-6 text-center shadow-2xl">
            <div className="text-5xl mb-2">{newMedal.emoji}</div>
            <div className="text-white text-xl">🎉 あたらしい くんしょう を ゲットしたよ！</div>
            <div className="text-white text-lg mt-1 font-black">{newMedal.name}</div>
          </div>
        </div>
      )}

      {/* REST OVERLAY */}
      {resting && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex flex-col items-center justify-center">
          <div className="text-6xl mb-4 animate-bounce">😴</div>
          <div className="text-white text-4xl font-black">Zzz...</div>
          <div className="text-white text-xl mt-3 opacity-70">スタミナを かいふくちゅう...</div>
        </div>
      )}

      {/* ===== TOP 60% AREA ===== */}
      <div className="relative w-full" style={{ height: "60%" }}>
        {/* Sky gradient */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#87CEEB 0%,#B0E0E6 100%)" }} />

        {/* House / Wall (Trophy Board BG) */}
        <div className="absolute" style={{ top: 0, left: "50%", transform: "translateX(-50%)", width: "94%", maxWidth: 520 }}>
          {/* Roof */}
          <div style={{ width: 0, height: 0, borderLeft: "calc(47%+10px) solid transparent", borderRight: "calc(47%+10px) solid transparent", borderBottom: "60px solid #8B4513", margin: "0 auto", position: "relative", zIndex: 2 }} />
          {/* Wall */}
          <div className="relative mx-auto rounded-b-2xl px-4 pt-2 pb-3" style={{ background: "#F5DEB3", border: "4px solid #8B4513", zIndex: 1 }}>
            {/* Trophy Board */}
            <div className="rounded-2xl px-3 py-2 mb-1" style={{ background: "linear-gradient(135deg,#8B4513,#A0522D)", border: "3px solid #6B3410" }}>
              <div className="text-center text-xs text-yellow-200 mb-1" style={{ letterSpacing: "0.08em" }}>🏅 くんしょうボード 🏅</div>
              <div className="flex justify-center gap-3">
                {MEDALS_DEF.map(m => {
                  const unlocked = !!medals[m.id];
                  return (
                    <div key={m.id} className="flex flex-col items-center cursor-pointer" onClick={() => { setSelectedMedal(m); setModal("medalDetail"); }}>
                      <span
                        className={`text-3xl transition-all duration-300 ${unlocked ? "medal-unlocked animate-shimmer" : "grayscale opacity-40"}`}
                        style={{ filter: unlocked ? "drop-shadow(0 0 5px gold)" : "grayscale(1) opacity(0.4)" }}
                      >{m.emoji}</span>
                      <span className="text-yellow-200 text-center mt-0.5" style={{ fontSize: "0.45rem", lineHeight: 1.3, maxWidth: 48 }}>{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Ground / Lawn */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: "45%", background: "linear-gradient(180deg,#4CAF50 0%,#388E3C 100%)" }} />

        {/* Fence */}
        <div className="absolute flex gap-2 px-2" style={{ bottom: "44%", left: 0, right: 0 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="rounded-t-sm" style={{ width: 16, height: 28, background: "#DEB887", border: "2px solid #A0522D", flexShrink: 0 }} />
          ))}
        </div>
        <div className="absolute" style={{ bottom: "44%", left: 0, right: 0, height: 8, background: "#DEB887", borderTop: "3px solid #A0522D" }} />

        {/* Animals in backyard */}
        <div className="absolute" style={{ bottom: 0, left: 0, right: 0, height: "44%", overflow: "hidden" }}>
          {animals.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-white bg-opacity-80 rounded-2xl px-4 py-3 text-center text-sm text-gray-600 mx-4">
                🌿 いまは うらにわ に どうぶつ が いないよ。<br />かり に でかけよう！
              </div>
            </div>
          ) : (
            animalPositions
              .filter(pos => animals.find(a => a.id === pos.animal.id))
              .map(pos => (
                <AnimalSprite
                  key={pos.key}
                  animal={pos.animal}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                />
              ))
          )}
        </div>

        {/* Stamina bar */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white bg-opacity-80 rounded-full px-2 py-1">
          <span className="text-xs">⚡</span>
          <div className="w-20 h-3 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${staminaColor}`} style={{ width: `${stamina}%` }} />
          </div>
          <span className="text-xs text-gray-700">{stamina}</span>
        </div>
      </div>

      {/* ===== BOTTOM 40% COMMAND PANEL ===== */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: "40%", background: "linear-gradient(180deg,#3E2723 0%,#5D4037 100%)", borderTop: "4px solid #8B4513" }}>
        <div className="flex items-center justify-center h-full px-3">
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {/* View Animals */}
            <button
              className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 text-white text-sm transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#2E7D32,#43A047)", border: "3px solid #1B5E20", boxShadow: "0 4px 0 #1B5E20" }}
              onClick={() => setModal("view")}
            >
              <span className="text-2xl">🔍</span>
              <span style={{ fontSize: "0.7rem", lineHeight: 1.3 }}>どうぶつを みる</span>
            </button>

            {/* Ship - highlighted */}
            <button
              className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 text-white text-sm transition-all active:scale-95 animate-shimmer"
              style={{ background: "linear-gradient(135deg,#E65100,#FF6D00)", border: "3px solid #BF360C", boxShadow: "0 4px 0 #BF360C" }}
              onClick={() => { setSelectedShip([]); setModal("ship"); }}
            >
              <span className="text-2xl">🚚</span>
              <span style={{ fontSize: "0.7rem", lineHeight: 1.3 }}>ぶつりゅうへ おくる</span>
            </button>

            {/* Rest */}
            <button
              className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 text-white text-sm transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#1565C0,#1976D2)", border: "3px solid #0D47A1", boxShadow: "0 4px 0 #0D47A1" }}
              onClick={handleRest}
            >
              <span className="text-2xl">🛏️</span>
              <span style={{ fontSize: "0.7rem", lineHeight: 1.3 }}>やすむ</span>
            </button>

            {/* Medals */}
            <button
              className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 px-2 text-white text-sm transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#7B1FA2,#9C27B0)", border: "3px solid #4A148C", boxShadow: "0 4px 0 #4A148C" }}
              onClick={() => setModal("medals")}
            >
              <span className="text-2xl">🏅</span>
              <span style={{ fontSize: "0.7rem", lineHeight: 1.3 }}>くんしょうを みる</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== MODALS ===== */}
      {modal && modal !== "rest" && (
        <div className="fixed inset-0 z-30 flex items-end justify-center pb-2 px-2" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden animate-popup" style={{ background: "#FFF8E7", border: "4px solid #8B4513" }}>
            {/* VIEW */}
            {modal === "view" && (
              <div className="p-4">
                <div className="text-center text-lg mb-3 text-amber-900">🔍 うらにわ の どうぶつ</div>
                {animals.length === 0 ? (
                  <div className="text-center text-gray-500 py-4 text-sm">どうぶつが いないよ！</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                    {animals.map(a => (
                      <div key={a.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${rarityColor[a.rarity] || "bg-gray-100"}`}>
                        <span className="text-3xl">{a.emoji}</span>
                        <div className="flex-1">
                          <div className="font-black text-sm">{a.name}</div>
                          <div className="text-xs opacity-70">{a.rarity}</div>
                        </div>
                        <div className="text-lg font-black text-gray-700">×{a.count}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button className="mt-4 w-full rounded-2xl py-2 text-white font-black" style={{ background: "#8B4513" }} onClick={() => setModal(null)}>とじる</button>
              </div>
            )}

            {/* SHIP */}
            {modal === "ship" && (
              <div className="p-4">
                <div className="text-center text-lg mb-1 text-orange-900">🚚 どの どうぶつを トラックに のせる？</div>
                <div className="text-center text-xs text-gray-500 mb-3">えらんで おくるボタンを おしてね</div>
                {animals.length === 0 ? (
                  <div className="text-center text-gray-400 py-4 text-sm">おくれる どうぶつが いないよ！</div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                    {animals.map(a => {
                      const sel = selectedShip.includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 rounded-2xl px-3 py-2 cursor-pointer transition-all ${sel ? "ring-4 ring-orange-400 bg-orange-100" : "bg-gray-100"}`}
                          onClick={() => setSelectedShip(prev => sel ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                        >
                          <span className="text-3xl">{a.emoji}</span>
                          <div className="flex-1">
                            <div className="font-black text-sm">{a.name}</div>
                            <div className="text-xs opacity-70">×{a.count}ひき</div>
                          </div>
                          {sel && <span className="text-green-500 text-xl">✅</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button className="flex-1 rounded-2xl py-2 text-white font-black" style={{ background: "#999" }} onClick={() => setModal(null)}>やめる</button>
                  <button
                    className={`flex-1 rounded-2xl py-2 text-white font-black transition-all ${selectedShip.length === 0 ? "opacity-40" : ""}`}
                    style={{ background: "#E65100" }}
                    onClick={handleShip}
                    disabled={selectedShip.length === 0}
                  >🚚 おくる！</button>
                </div>
              </div>
            )}

            {/* MEDALS LIST */}
            {modal === "medals" && (
              <div className="p-4">
                <div className="text-center text-lg mb-3 text-purple-900">🏅 くんしょうリスト</div>
                <div className="flex flex-col gap-3 max-h-60 overflow-y-auto">
                  {MEDALS_DEF.map(m => {
                    const unlocked = !!medals[m.id];
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2 cursor-pointer transition-all ${unlocked ? "bg-yellow-100 ring-2 ring-yellow-400" : "bg-gray-100 opacity-60"}`}
                        onClick={() => { setSelectedMedal(m); setModal("medalDetail"); }}
                      >
                        <span className={`text-4xl ${unlocked ? "medal-unlocked" : "grayscale opacity-50"}`}>{m.emoji}</span>
                        <div>
                          <div className={`text-sm font-black ${unlocked ? "text-yellow-800" : "text-gray-500"}`}>{m.name}</div>
                          <div className="text-xs text-gray-400">{unlocked ? `🗓 ${medals[m.id]}` : "まだ ゲットしていないよ"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="mt-4 w-full rounded-2xl py-2 text-white font-black" style={{ background: "#7B1FA2" }} onClick={() => setModal(null)}>とじる</button>
              </div>
            )}

            {/* MEDAL DETAIL */}
            {modal === "medalDetail" && selectedMedal && (
              <div className="p-5 text-center">
                <span className={`text-6xl block mb-3 ${medals[selectedMedal.id] ? "medal-unlocked animate-shimmer" : "grayscale opacity-40"}`}>
                  {selectedMedal.emoji}
                </span>
                <div className="text-xl font-black text-amber-900 mb-2">{selectedMedal.name}</div>
                <div className="text-sm text-gray-700 mb-3 leading-relaxed">{selectedMedal.desc}</div>
                {medals[selectedMedal.id] ? (
                  <div className="bg-yellow-100 rounded-2xl px-3 py-2 text-sm text-yellow-800">
                    🗓 {medals[selectedMedal.id]} に ゲット！
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-2xl px-3 py-2 text-sm text-gray-500">
                    🔒 まだ ゲットしていないよ
                  </div>
                )}
                <button className="mt-4 w-full rounded-2xl py-2 text-white font-black" style={{ background: "#8B4513" }}
                  onClick={() => setModal("medals")}>もどる</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
