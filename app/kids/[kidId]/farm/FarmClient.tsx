"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSafariStore } from "@/store/useSafariStore";

const CROPS = {
  wheat:  { icon:"🌾", label:"むぎ",        hours:4  },
  carrot: { icon:"🥕", label:"にんじん",    hours:6  },
  potato: { icon:"🥔", label:"じゃがいも",  hours:8  },
  tomato: { icon:"🍅", label:"トマト",      hours:10 },
  corn:   { icon:"🌽", label:"とうもろこし",hours:12 },
  cotton: { icon:"🌸", label:"わた",        hours:8  },
};

const Q_COLOR = { 1:"#5a6a5e", 2:"#e8bb30", 3:"#bb6fff" };
const Q_STARS = { 1:"★", 2:"★★", 3:"★★★" };

const LS_KEY = "osafari_farm_v9";

// 作業の重さ設定
const WEED_HOLD_MS = 3500;   // 草刈り：長押し時間
const TILL_TAPS    = 12;     // 耕す：必要連打数
const WATER_TAPS   = 10;     // 水やり：必要連打数
const STAMINA_MAX  = 5;
const COOLDOWN_MS  = 20000;  // 休憩時間（デモ用に20秒）

const initCells = () => [
  { id:0, state:"weed" },
  { id:1, state:"hard", tillProg:0 },
  { id:2, state:"growing", crop:"wheat", pct:0.65, q:2, fertilized:true },
  { id:3, state:"tilled" },
  { id:4, state:"ready", crop:"tomato", q:3 },
  { id:5, state:"needs-water", crop:"carrot", q:1, waterProg:0 },
  { id:6, state:"weed" },
  { id:7, state:"danger", crop:"corn", q:2 },
  { id:8, state:"planted", crop:"potato", q:1 },
];

const loadCells = () => {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : initCells(); } catch { return initCells(); }
};

const WEATHER_META = {
  sunny:  { icon:"☀️", label:"はれ",    accent:"#2adf60" },
  rainy:  { icon:"☔",  label:"あめ",    accent:"#60a8f0" },
  typhoon:{ icon:"🌀", label:"たいふう", accent:"#9060ef" },
};

const ACTION_META = {
  idle:      { emoji:"🙂", label:"待機中",      color:"#2adf60" },
  pulling:   { emoji:"😣", label:"草かり中…！", color:"#ef6030" },
  tilling:   { emoji:"😤", label:"たがやし中…！",color:"#e0a020" },
  watering:  { emoji:"😦", label:"みずやり中…", color:"#60c0f0" },
  harvesting:{ emoji:"🤩", label:"しゅうかく！", color:"#ffe030" },
  exhausted: { emoji:"😵", label:"バテた…",     color:"#9060ef" },
};

const INV_ITEMS = [
  {k:"coins",e:"🪙"},{k:"poop",e:"💩"},{k:"grass",e:"🌿"},{k:"iron",e:"🔩"},
  {k:"wood",e:"🪵"},{k:"stone",e:"🪨"},{k:"thread",e:"🧵"},
  {k:"wheat",e:"🌾"},{k:"carrot",e:"🥕"},{k:"potato",e:"🥔"},
  {k:"tomato",e:"🍅"},{k:"corn",e:"🌽"},{k:"cotton",e:"🌸"},
];

// ════════════════════════════════════════════════
//  汗パーティクル
// ════════════════════════════════════════════════
function Sweat({ emoji="💦", count=4, top=2 }: { emoji?: string; count?: number; top?: number }) {
  return (
    <>
      {Array.from({length:count}).map((_,i) => (
        <span key={i} style={{
          position:"absolute", top, left:`${20+i*18}%`, fontSize:11,
          animation:`sweatFly 0.7s ease-out infinite`, animationDelay:`${i*0.18}s`,
          pointerEvents:"none", zIndex:5,
        }}>{emoji}</span>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════
//  Cell
// ════════════════════════════════════════════════
function Cell({ cell, onTap, onWeedDone, onTillTap, onWaterTap, tired }: {
  cell: any;
  onTap: (id: number) => void;
  onWeedDone: (id: number) => void;
  onTillTap: (id: number) => void;
  onWaterTap: (id: number) => void;
  tired: boolean;
}) {
  const crop = cell.crop ? CROPS[cell.crop as keyof typeof CROPS] : null;
  const [holdProg, setHoldProg] = useState(0);
  const [shake, setShake] = useState(false);
  const holdStart = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHold = () => {
    if(holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null; holdStart.current = null;
    setHoldProg(0);
  };

  // 草刈り：長押し踏ん張り
  const startHold = (e: React.PointerEvent) => {
    if(cell.state !== "weed" || tired) return;
    e.preventDefault();
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const prog = Math.min(1, (Date.now() - holdStart.current!) / WEED_HOLD_MS);
      setHoldProg(prog);
      if(prog >= 1) { clearHold(); onWeedDone(cell.id); }
    }, 40);
  };
  const endHold = () => { if(cell.state === "weed") clearHold(); };

  // タップ系（耕す・水やり＝連打）
  const handleClick = () => {
    if(tired && cell.state === "hard") { onTap(cell.id); return; }
    if(cell.state === "weed") return;
    if(cell.state === "hard") {
      setShake(true); setTimeout(() => setShake(false), 180);
      onTillTap(cell.id); return;
    }
    if(cell.state === "needs-water") {
      setShake(true); setTimeout(() => setShake(false), 120);
      onWaterTap(cell.id); return;
    }
    onTap(cell.id);
  };

  const bgMap: Record<string, string> = {
    weed:"#0e1f0c", hard:"#1a130a", tilled:"#14100a", planted:"#12100a",
    "needs-water":"#0a1018", growing:"#0a1a0c", ready:"#0e1a0a", danger:"#18081a",
  };
  const borderMap: Record<string, string> = {
    weed:"#1e3a1a", hard:"#2e1e0e", tilled:"#2a1c0e", planted:"#2a200e",
    "needs-water":"#1a3040", growing:"#2adf60", ready:"#f0d020", danger:"#8040df",
  };
  const glowMap: Record<string, string> = {
    ready:"0 0 14px rgba(240,208,32,0.35)",
    danger:"0 0 14px rgba(128,64,224,0.35)",
    growing:"0 0 8px rgba(42,223,96,0.15)",
  };

  const bg     = bgMap[cell.state]     || "#0e1f0c";
  const border = borderMap[cell.state] || "#1e3a1a";
  const shadow = glowMap[cell.state]   || "none";

  const isHolding = cell.state === "weed" && holdProg > 0;
  const tillP  = (cell.tillProg  || 0) / TILL_TAPS;
  const waterP = (cell.waterProg || 0) / WATER_TAPS;

  const icon = crop
    ? crop.icon
    : (cell.state === "weed" ? ["🌿","🍃","🌱"][cell.id % 3] : cell.state === "hard" ? "🪨" : "🌰");

  const subLabel: Record<string, React.ReactNode> = {
    weed:          <span style={{color:isHolding?"#ffb060":"#3a7a40",fontSize:8,fontWeight:700}}>{isHolding?"ぬけない…！":"長押しで草刈り"}</span>,
    hard:          <span style={{color:"#c08020",fontSize:8,fontWeight:700}}>連打で耕す！</span>,
    tilled:        <span style={{color:"#7a5a30",fontSize:8,fontWeight:700}}>タップ→種まき</span>,
    planted:       <span style={{color:"#6a8a60",fontSize:8,fontWeight:700}}>タップ→水やり</span>,
    "needs-water": <span style={{color:"#60b0e0",fontSize:8,fontWeight:700}}>連打で水やり！</span>,
    growing:       null,
    ready:         <span style={{color:"#c0a010",fontSize:8,fontWeight:700}}>タップ→収穫！</span>,
    danger:        <span style={{color:"#a070e0",fontSize:8,fontWeight:700}}>⚠️ タップ！</span>,
  };

  const anim = isHolding ? "weedShake 0.12s ease-in-out infinite"
    : shake && cell.state === "hard"        ? "tillShake 0.18s ease-out"
    : shake && cell.state === "needs-water" ? "waterShake 0.12s ease-out"
    : cell.state === "ready"  ? "readyGlow 1.6s ease-in-out infinite"
    : cell.state === "danger" ? "dangerGlow 0.5s ease-in-out infinite"
    : "none";

  return (
    <div
      onClick={handleClick}
      onPointerDown={startHold}
      onPointerUp={endHold}
      onPointerLeave={endHold}
      onPointerCancel={endHold}
      style={{
        aspectRatio:"1", borderRadius:12, background:bg,
        border:`1px solid ${border}`, boxShadow:shadow,
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        cursor:"pointer", position:"relative", overflow:"hidden",
        userSelect:"none", WebkitTapHighlightColor:"transparent", touchAction:"none",
        transition:"border-color 0.2s, box-shadow 0.2s",
        animation: anim,
        opacity: tired && (cell.state==="weed"||cell.state==="hard"||cell.state==="needs-water") ? 0.55 : 1,
      }}
    >
      {/* furrow lines */}
      {["tilled","planted","needs-water","growing","ready","danger"].includes(cell.state) && (
        <div style={{position:"absolute",inset:0,pointerEvents:"none",borderRadius:12,
          backgroundImage:"repeating-linear-gradient(0deg,transparent 0,transparent 5px,rgba(255,255,255,0.03) 5px,rgba(255,255,255,0.03) 6px)"}} />
      )}

      {/* 汗エフェクト（草刈り中） */}
      {isHolding && holdProg > 0.3 && <Sweat count={Math.ceil(holdProg * 4)} />}

      <span style={{
        fontSize:cell.state === "growing" ? 22 : 24, lineHeight:1,
        filter: isHolding ? "drop-shadow(0 0 6px rgba(255,160,60,0.6))" : "none",
        transform: isHolding ? `scale(${1 + holdProg * 0.18})` : "none",
        transition:"transform 0.04s",
      }}>{icon}</span>
      {subLabel[cell.state] && <div style={{marginTop:3}}>{subLabel[cell.state]}</div>}

      {/* 草刈り：踏ん張りゲージ */}
      {isHolding && (
        <div style={{position:"absolute",bottom:5,left:"12%",right:"12%",height:6,background:"rgba(0,0,0,0.5)",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:99,
            background:holdProg>0.7?"linear-gradient(90deg,#ff6030,#ff3030)":"linear-gradient(90deg,#e0a020,#ef6030)",
            width:`${holdProg*100}%`,transition:"width 0.04s"}} />
        </div>
      )}

      {/* 耕す：連打ゲージ＋残り回数 */}
      {cell.state === "hard" && (
        <>
          <span style={{position:"absolute",top:4,fontSize:9,color:"#e0a020",fontWeight:700}}>
            あと{Math.max(0, TILL_TAPS - (cell.tillProg||0))}回
          </span>
          <div style={{position:"absolute",bottom:5,left:"12%",right:"12%",height:5,background:"rgba(0,0,0,0.5)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#fb923c,#ea580c)",width:`${tillP*100}%`,transition:"width 0.1s"}} />
          </div>
        </>
      )}

      {/* 水やり：連打ゲージ＋残り回数 */}
      {cell.state === "needs-water" && (
        <>
          <span style={{position:"absolute",top:4,fontSize:9,color:"#60b0e0",fontWeight:700}}>
            あと{Math.max(0, WATER_TAPS - (cell.waterProg||0))}回
          </span>
          <div style={{position:"absolute",bottom:5,left:"12%",right:"12%",height:5,background:"rgba(0,0,0,0.5)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#38bdf8,#0ea5e9)",width:`${waterP*100}%`,transition:"width 0.1s"}} />
          </div>
        </>
      )}

      {/* growing progress */}
      {cell.state === "growing" && (
        <>
          <div style={{position:"absolute",bottom:5,left:"10%",right:"10%",height:3,background:"rgba(0,0,0,0.5)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:cell.fertilized?"linear-gradient(90deg,#a8ff78,#2adf60)":"#2adf60",width:`${(cell.pct||0)*100}%`}} />
          </div>
          <span style={{position:"absolute",bottom:10,fontSize:8,color:"#2adf60",fontWeight:700}}>{Math.round((cell.pct||0)*100)}%</span>
        </>
      )}

      {/* quality badge */}
      {cell.q && !["weed","hard","tilled"].includes(cell.state) && (
        <span style={{position:"absolute",top:4,right:5,fontSize:9,fontWeight:700,color:Q_COLOR[cell.q as keyof typeof Q_COLOR]}}>{Q_STARS[cell.q as keyof typeof Q_STARS]}</span>
      )}
      {cell.fertilized && cell.state === "growing" && (
        <span style={{position:"absolute",top:4,left:4,fontSize:9}}>💩</span>
      )}
      {cell.state === "ready" && (
        <span style={{position:"absolute",top:4,left:4,fontSize:10,animation:"spin 2s linear infinite"}}>✨</span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
//  SeedPicker
// ════════════════════════════════════════════════
function SeedPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",zIndex:30,borderRadius:16}}>
      <div style={{width:"100%",background:"#0d1f10",borderRadius:"16px 16px 0 0",borderTop:"1px solid #2adf60",padding:"16px 14px 24px"}}>
        <div style={{width:32,height:3,background:"#2a5a30",borderRadius:99,margin:"0 auto 12px"}} />
        <div style={{fontSize:13,fontWeight:700,color:"#a8f0b0",textAlign:"center",marginBottom:12}}>🌰 たねを えらんでね</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
          {Object.entries(CROPS).map(([id,c]) => (
            <button key={id} onClick={() => onPick(id)}
              style={{background:"#122018",border:"1px solid #1e3d22",borderRadius:12,padding:"10px 4px",cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}>
              <div style={{fontSize:20}}>{c.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#a8f0b0",marginTop:3}}>{c.label}</div>
              <div style={{fontSize:9,color:"#4a7a52",marginTop:1}}>🕐{c.hours}h</div>
            </button>
          ))}
        </div>
        <button onClick={onClose}
          style={{width:"100%",padding:10,borderRadius:12,border:"1px solid #2a4a2e",background:"#122018",color:"#4a9a54",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
//  Main
// ════════════════════════════════════════════════
export default function FarmUI() {
  // ── ストア連携
  const inventory        = useSafariStore((s) => s.inventory);
  const coins            = useSafariStore((s) => s.coins);
  const addToInventory   = useSafariStore((s) => s.addToInventory);
  const consumeInventory = useSafariStore((s) => s.consumeInventory);

  const [cells, setCells]               = useState(loadCells);
  const [weather]                       = useState("sunny");
  const [action, setAction]             = useState("idle");
  const [stamina, setStamina]           = useState(STAMINA_MAX);
  const [cooldownEnd, setCooldownEnd]   = useState<number | null>(null);
  const [cooldownMs, setCooldownMs]     = useState(0);
  const [picker, setPicker]             = useState<number | null>(null);
  const [manureTarget, setManureTarget] = useState<number | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [screenShake, setScreenShake]   = useState(false);
  const toastRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tired = !!(cooldownEnd && Date.now() < cooldownEnd);

  // localStorage 保存
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cells)); } catch {}
  }, [cells]);

  const showToast = (msg: string) => {
    setToast(msg);
    if(toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  };

  const triggerAction = (a: string, ms = 600) => {
    if(actionTimer.current) clearTimeout(actionTimer.current);
    setAction(a);
    if(ms > 0) actionTimer.current = setTimeout(() => setAction("idle"), ms);
  };

  // スタミナ消費＋疲労判定
  const consumeStamina = useCallback(() => {
    setStamina(prev => {
      const next = prev - 1;
      if(next <= 0) {
        setCooldownEnd(Date.now() + COOLDOWN_MS);
        triggerAction("exhausted", 0);
        showToast("😵 もうヘトヘト…！ ちょっと休もう…");
        return 0;
      }
      return next;
    });
  }, []);

  // クールダウン監視
  useEffect(() => {
    if(!cooldownEnd) { setCooldownMs(0); return; }
    const t = setInterval(() => {
      const rem = cooldownEnd - Date.now();
      if(rem <= 0) {
        setCooldownEnd(null); setCooldownMs(0); setStamina(STAMINA_MAX);
        setAction("idle"); showToast("💪 よし、回復した！ もうひとがんばり！");
      } else setCooldownMs(rem);
    }, 200);
    return () => clearInterval(t);
  }, [cooldownEnd]);

  // 成長タイマー（30分で100%、肥料で2倍速）
  const GROW_STEP = 1 / 2250; // 800ms × 2250 ≒ 30分
  useEffect(() => {
    const t = setInterval(() => {
      setCells((prev: any[]) => {
        let changed = false;
        const next = prev.map((c: any) => {
          if(c.state !== "growing") return c;
          const step = c.fertilized ? GROW_STEP * 2 : GROW_STEP;
          const np = Math.min(1, (c.pct || 0) + step);
          changed = true;
          if(np >= 1) return {...c, state:"ready", pct:1};
          return {...c, pct:np};
        });
        return changed ? next : prev;
      });
    }, 800);
    return () => clearInterval(t);
  }, []);

  // 草刈り完了（長押し）
  const handleWeedDone = (id: number) => {
    if(tired) return;
    setCells((prev: any[]) => prev.map((c: any) => c.id === id ? {...c, state:"hard", tillProg:0} : c));
    triggerAction("pulling", 800);
    addToInventory("grass", 1);
    setScreenShake(true); setTimeout(() => setScreenShake(false), 250);
    consumeStamina();
    showToast("✨ スポーン！ 草を抜いた！ 🌿+1");
  };

  // 耕す（連打）
  const handleTillTap = (id: number) => {
    if(tired) { showToast(`😴 つかれてる… あと${Math.ceil(cooldownMs / 1000)}秒`); return; }
    triggerAction("tilling", 350);
    setScreenShake(true); setTimeout(() => setScreenShake(false), 120);
    setCells((prev: any[]) => prev.map((c: any) => {
      if(c.id !== id) return c;
      const next = (c.tillProg || 0) + 1;
      if(next >= TILL_TAPS) {
        if(Math.random() < 0.3) { addToInventory("stone", 1); showToast("💎 石をみつけた！ 畝の完成！"); }
        else showToast("✅ ふかふか！ 畝の完成！");
        consumeStamina();
        return {...c, state:"tilled", tillProg:0};
      }
      return {...c, tillProg:next};
    }));
  };

  // 水やり（連打）
  const handleWaterTap = (id: number) => {
    triggerAction("watering", 300);
    setCells((prev: any[]) => prev.map((c: any) => {
      if(c.id !== id) return c;
      const next = (c.waterProg || 0) + 1;
      if(next >= WATER_TAPS) {
        showToast("💧 みずやり完了！ 育ち始めた！");
        return {...c, state:"growing", pct:0.02, waterProg:0};
      }
      return {...c, waterProg:next};
    }));
  };

  // その他タップ
  const handleTap = (id: number) => {
    setCells((prev: any[]) => {
      const cs = prev.map((c: any) => ({...c}));
      const c  = cs.find((x: any) => x.id === id);
      if(!c) return prev;

      if(c.state === "tilled") {
        setPicker(id); return prev;
      } else if(c.state === "planted") {
        c.state = "needs-water"; c.waterProg = 0;
        showToast("💧 連打で水をあげよう！");
      } else if(c.state === "growing") {
        setManureTarget(id); return prev;
      } else if(c.state === "ready") {
        const crop = CROPS[c.crop as keyof typeof CROPS];
        const qty  = c.q === 3 ? 6 : c.q === 2 ? 4 : 2;
        addToInventory(c.crop, qty);
        c.state = "hard"; c.crop = null; c.q = null; c.pct = 0; c.fertilized = false; c.tillProg = 0;
        triggerAction("harvesting", 1200);
        showToast(`${crop?.icon} しゅうかく！ +${qty}個`);
      } else if(c.state === "danger") {
        c.state = "growing"; c.pct = 0.5;
        showToast("🔨 守った！");
      }
      return cs;
    });
  };

  const handleSeedPick = (cropId: string) => {
    setCells((prev: any[]) => prev.map((c: any) => c.id === picker ? {...c, state:"planted", crop:cropId, q:1} : c));
    showToast(`🌰 ${CROPS[cropId as keyof typeof CROPS].label}をまいた！ タップして水やり 💧`);
    setPicker(null);
  };

  const wm = WEATHER_META[weather as keyof typeof WEATHER_META];
  const am = ACTION_META[action as keyof typeof ACTION_META] || ACTION_META.idle;

  return (
    <div style={{
      maxWidth:390, margin:"0 auto",
      fontFamily:"'Hiragino Maru Gothic ProN','rounded mplus 1c',sans-serif",
      background:"linear-gradient(180deg,#7ec0ee 0%,#a8d8f0 18%,#cde6c0 38%,#8fc46a 55%,#5a9a3e 72%,#3a6e28 100%)",
      minHeight:700,
      display:"flex", flexDirection:"column",
      borderRadius:16, overflow:"hidden",
      border:"1px solid #2a5a30", position:"relative",
      animation: screenShake ? "screenShake 0.12s ease-out" : "none",
    }}>

      {/* ── 自然背景レイヤー ── */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        {/* 太陽 */}
        <div style={{position:"absolute",top:24,right:30,width:54,height:54,borderRadius:"50%",
          background:"radial-gradient(circle,#fff6c0,#ffe066 60%,#ffcf33)",
          boxShadow:"0 0 30px rgba(255,224,102,0.7),0 0 60px rgba(255,224,102,0.3)",
          animation:"sunGlow 4s ease-in-out infinite"}} />
        {/* 雲 */}
        <div style={{position:"absolute",top:60,left:-60,fontSize:46,opacity:0.92,animation:"cloudDrift 38s linear infinite"}}>☁️</div>
        <div style={{position:"absolute",top:120,left:-100,fontSize:34,opacity:0.8,animation:"cloudDrift 52s linear infinite",animationDelay:"-8s"}}>☁️</div>
        <div style={{position:"absolute",top:30,left:-80,fontSize:28,opacity:0.7,animation:"cloudDrift 64s linear infinite",animationDelay:"-30s"}}>☁️</div>
        {/* 遠くの丘 */}
        <div style={{position:"absolute",top:170,left:-20,right:-20,height:120,borderRadius:"50% 50% 0 0",background:"radial-gradient(ellipse at 50% 100%,#6aa848,#5a9a3e)",opacity:0.55}} />
        <div style={{position:"absolute",top:200,left:-60,width:200,height:140,borderRadius:"50% 50% 0 0",background:"radial-gradient(ellipse at 50% 100%,#7ab050,#62a040)",opacity:0.5}} />
        {/* 鳥 */}
        <div style={{position:"absolute",top:90,left:-30,fontSize:13,opacity:0.55,animation:"birdFly 26s linear infinite"}}>🕊️</div>
        {/* 草むら（下部） */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:50,
          background:"linear-gradient(180deg,transparent,rgba(40,90,30,0.4))"}} />
        <div style={{position:"absolute",bottom:6,left:0,right:0,fontSize:18,opacity:0.5,letterSpacing:6,whiteSpace:"nowrap",textAlign:"center"}}>🌿🌱🌾🌿🌱🌾🌿🌱🌾🌿</div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes readyGlow { 0%,100%{box-shadow:0 0 10px rgba(240,208,32,0.3)} 50%{box-shadow:0 0 22px rgba(240,208,32,0.6)} }
        @keyframes dangerGlow { 0%,100%{box-shadow:0 0 10px rgba(128,64,224,0.3)} 50%{box-shadow:0 0 22px rgba(128,64,224,0.6)} }
        @keyframes weedShake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-2px,1px)} 50%{transform:translate(2px,-1px)} 75%{transform:translate(-1px,2px)} }
        @keyframes tillShake { 0%{transform:translateY(0) scale(1)} 30%{transform:translateY(3px) scale(1.04)} 100%{transform:translateY(0) scale(1)} }
        @keyframes waterShake { 0%,100%{transform:translate(0,0)} 50%{transform:translate(0,1px)} }
        @keyframes screenShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes sweatFly { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(16px) scale(0.6)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes avatarWork { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes sunGlow { 0%,100%{transform:scale(1);opacity:0.95} 50%{transform:scale(1.06);opacity:1} }
        @keyframes cloudDrift { from{transform:translateX(0)} to{transform:translateX(560px)} }
        @keyframes birdFly { 0%{transform:translateX(0) translateY(0)} 50%{transform:translateX(280px) translateY(-12px)} 100%{transform:translateX(560px) translateY(0)} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:"rgba(12,26,14,0.82)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",borderBottom:"1px solid rgba(46,93,42,0.6)",padding:"12px 14px 10px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:26}}>🌾</span>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:"#a8f0b0",letterSpacing:0.5}}>お手伝いサファリ</div>
            <div style={{fontSize:10,color:"#3a6a40",letterSpacing:2,marginTop:1}}>FARM</div>
          </div>
          {/* 天気バッジ */}
          <span style={{fontSize:13,background:"#122018",border:`1px solid ${wm.accent}`,borderRadius:8,padding:"3px 8px",color:wm.accent,fontWeight:700}}>{wm.icon} {wm.label}</span>
          <button
            onClick={() => { setCells(initCells()); setStamina(STAMINA_MAX); setCooldownEnd(null); showToast("🔄 リセットしました"); }}
            style={{background:"#1a3a20",border:"1px solid #2a5a30",borderRadius:8,padding:"5px 9px",color:"#4a9a54",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
            ↺
          </button>
        </div>

        {/* INVENTORY */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
          {INV_ITEMS.map(it => {
            const cnt = it.k === "coins" ? coins : (inventory[it.k] ?? 0);
            const isHighlight = it.k === "coins";
            return (
              <div key={it.k} style={{
                flexShrink:0, background:isHighlight?"#1a2a14":"#101e12",
                border:`1px solid ${isHighlight?"#2adf60":"#1e3d22"}`,
                borderRadius:10, padding:"4px 8px", textAlign:"center", minWidth:38,
              }}>
                <div style={{fontSize:14,lineHeight:1.2}}>{it.e}</div>
                <div style={{fontSize:11,fontWeight:700,color:isHighlight?"#60f080":"#4a9a54"}}>{cnt}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AVATAR / HUD ── */}
      <div style={{background:tired?"rgba(26,14,34,0.82)":"rgba(12,26,14,0.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",borderBottom:"1px solid rgba(26,58,32,0.6)",padding:"10px 14px",display:"flex",alignItems:"center",gap:12,transition:"background 0.4s",position:"relative",zIndex:5}}>
        <div style={{
          width:52,height:52,borderRadius:"50%",flexShrink:0,
          background:"#122018",border:`2px solid ${am.color}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:26,position:"relative",boxSizing:"border-box",
          transition:"border-color 0.3s",
          animation: (action==="pulling"||action==="tilling"||action==="watering") ? "avatarWork 0.3s ease-in-out infinite" : "none",
        }}>
          {am.emoji}
          {(action === "pulling" || action === "tilling") && (
            <span style={{position:"absolute",top:-2,right:0,fontSize:12,animation:"sweatFly 0.7s ease-out infinite"}}>💦</span>
          )}
          <div style={{position:"absolute",bottom:1,right:1,width:10,height:10,borderRadius:"50%",background:am.color,border:"2px solid #0c1a0e",transition:"background 0.3s"}} />
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:am.color,letterSpacing:1,marginBottom:5,transition:"color 0.3s"}}>{am.label}</div>
          {tired ? (
            <>
              <div style={{fontSize:9,color:"#9060ef",marginBottom:4,fontWeight:700}}>休憩中… あと {Math.ceil(cooldownMs/1000)}秒</div>
              <div style={{height:7,background:"rgba(255,255,255,0.1)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#a78bfa,#7c3aed)",width:`${(1-cooldownMs/COOLDOWN_MS)*100}%`,transition:"width 0.2s"}} />
              </div>
            </>
          ) : (
            <>
              <div style={{fontSize:9,color:"#3a6a40",marginBottom:4,display:"flex",justifyContent:"space-between"}}>
                <span>⚡ スタミナ</span>
                <span style={{color:stamina<=2?"#ef6030":"#2adf60",fontWeight:700}}>{stamina}/{STAMINA_MAX}</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {Array.from({length:STAMINA_MAX},(_,i) => (
                  <div key={i} style={{flex:1,height:8,borderRadius:99,
                    background:i<stamina?(stamina<=2?"#ef6030":"#2adf60"):"#1a2a1e",
                    boxShadow:i<stamina?`0 0 6px ${stamina<=2?"#ef603088":"#2adf6088"}`:"none",
                    transition:"all 0.3s"}} />
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{fontSize:9,color:"#2a4a2e",textAlign:"right",lineHeight:1.8,flexShrink:0}}>
          🌿長押し＝草刈<br/>
          ⛏️連打＝耕す<br/>
          💧連打＝水やり<br/>
          🌰タップ＝種まき
        </div>
      </div>

      {/* ── QUALITY STRIP ── */}
      <div style={{background:"rgba(9,16,8,0.7)",backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",borderBottom:"1px solid rgba(26,58,32,0.5)",padding:"4px 14px",display:"flex",gap:12,justifyContent:"center",alignItems:"center",position:"relative",zIndex:5}}>
        {([1,2,3] as const).map(q => (
          <div key={q} style={{fontSize:10,fontWeight:700,color:Q_COLOR[q],display:"flex",alignItems:"center",gap:3}}>
            <span>{Q_STARS[q]}</span>
            <span style={{color:"#2a4a2e"}}>{q===1?"ふつう":q===2?"りょうしつ":"ごくじょう"}</span>
          </div>
        ))}
        <span style={{fontSize:9,color:"#1e3a20"}}>💧＋💩＝★★★</span>
      </div>

      {/* ── GRID ── */}
      <div style={{flex:1,padding:"12px 10px 24px",display:"flex",flexDirection:"column",gap:8,position:"relative",zIndex:5}}>
        <div style={{textAlign:"center"}}>
          <span style={{display:"inline-block",background:"rgba(18,32,24,0.85)",border:"1px solid #2e6a36",borderRadius:10,padding:"4px 18px",fontSize:12,fontWeight:700,color:"#d8f8c8",letterSpacing:2,boxShadow:"0 2px 8px rgba(0,0,0,0.25)"}}>🌿 わたしの にわ 🌿</span>
        </div>
        <div style={{
          background:"linear-gradient(160deg,#6a4a28,#4a3012 50%,#5a3a1a)",
          border:"4px solid #3a2410",
          borderRadius:18, padding:12,
          boxShadow:"0 6px 0 #2a1808, 0 10px 24px rgba(0,0,0,0.4)",
          filter:tired?"brightness(0.7) saturate(0.6)":"none", transition:"filter 0.4s",
        }}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {cells.map((cell: any) => (
              <Cell key={cell.id} cell={cell} tired={tired}
                onTap={handleTap} onWeedDone={handleWeedDone}
                onTillTap={handleTillTap} onWaterTap={handleWaterTap} />
            ))}
          </div>
        </div>
      </div>

      {/* ── MANURE PANEL ── */}
      {manureTarget !== null && (() => {
        const c = cells.find((x: any) => x.id === manureTarget);
        const crop = c?.crop ? CROPS[c.crop as keyof typeof CROPS] : null;
        const pct = Math.round((c?.pct || 0) * 100);
        const poopCount = inventory.poop ?? 0;
        const hasPoop = poopCount >= 1;
        const doManure = () => {
          if(!hasPoop) { showToast("💩 フンが足りない！"); return; }
          const ok = consumeInventory("poop", 1);
          if(!ok) { showToast("💩 フンが足りない！"); return; }
          setCells((prev: any[]) => prev.map((cl: any) =>
            cl.id === manureTarget
              ? {...cl, fertilized:true, q:Math.min(3,(cl.q||1)+1), pct:Math.min(1,(cl.pct||0)+0.2)}
              : cl
          ));
          showToast("💩✨ 肥料投入！ 品質アップ＆成長+20%！");
          setManureTarget(null);
        };
        return (
          <div onClick={e => { if(e.target===e.currentTarget) setManureTarget(null); }}
            style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",zIndex:30,borderRadius:16}}>
            <div style={{width:"100%",background:"#0f1a0a",borderRadius:"16px 16px 0 0",borderTop:"1px solid #2adf60",padding:"16px 14px 24px"}}>
              <div style={{width:32,height:3,background:"#204030",borderRadius:99,margin:"0 auto 14px"}} />
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:32,marginBottom:4}}>{crop?.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#a8f0b0"}}>{crop?.label}</div>
                <div style={{fontSize:10,color:"#3a6a40",marginTop:3}}>
                  成長中… <b style={{color:"#2adf60"}}>{pct}%</b>
                  {c?.fertilized ? "　💩 肥料済み" : ""}
                </div>
                <div style={{margin:"8px auto 0",width:"70%",height:5,background:"#1a3a20",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,background:c?.fertilized?"linear-gradient(90deg,#a8ff78,#2adf60)":"#2adf60",width:`${pct}%`,transition:"width 0.3s"}} />
                </div>
                <div style={{marginTop:6,fontSize:10,color:Q_COLOR[(c?.q||1) as keyof typeof Q_COLOR],fontWeight:700}}>
                  {Q_STARS[(c?.q||1) as keyof typeof Q_STARS]} {c?.q===1?"ふつう":c?.q===2?"りょうしつ":"ごくじょう"}
                </div>
              </div>
              {!c?.fertilized ? (
                <button onClick={doManure}
                  style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",
                    background:hasPoop?"linear-gradient(135deg,#3a2800,#6a4a00)":"#1a1a1a",
                    color:hasPoop?"#fde68a":"#4a4a4a",fontSize:14,fontWeight:700,
                    cursor:hasPoop?"pointer":"not-allowed",fontFamily:"inherit",marginBottom:8}}>
                  💩 肥料をあげる {hasPoop ? `（のこり${poopCount}個）` : "（フンが足りない）"}
                </button>
              ) : (
                <div style={{textAlign:"center",padding:"12px 0 8px",fontSize:12,color:"#4a7a52",fontWeight:700}}>
                  ✅ すでに肥料をあげたよ！
                </div>
              )}
              <button onClick={() => setManureTarget(null)}
                style={{width:"100%",padding:10,borderRadius:12,border:"1px solid #1e3a20",background:"#0a1a0c",color:"#3a6a40",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                とじる
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── SEED PICKER ── */}
      {picker !== null && <SeedPicker onPick={handleSeedPick} onClose={() => setPicker(null)} />}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position:"absolute", bottom:24, left:"50%",
          transform:"translateX(-50%)", zIndex:80,
          padding:"9px 20px", borderRadius:24,
          background:"#0d2a14", border:"1px solid #2adf60",
          color:"#a8f0b0", fontWeight:700, fontSize:12,
          whiteSpace:"nowrap", pointerEvents:"none",
          animation:"toastIn 0.2s ease-out",
          maxWidth:"88%", textAlign:"center",
        }}>{toast}</div>
      )}
    </div>
  );
}
