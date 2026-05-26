"use client";
import { useState, useEffect, useRef } from "react";
import { useSafariStore } from "@/store/useSafariStore";
import { KizunaEventDialog } from "@/components/KizunaEventDialog";

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

const initCells = () => [
  { id:0, state:"weed" },
  { id:1, state:"hard", tillProg:1 },
  { id:2, state:"growing", crop:"wheat", pct:0.65, q:2, fertilized:true },
  { id:3, state:"tilled" },
  { id:4, state:"ready", crop:"tomato", q:3 },
  { id:5, state:"needs-water", crop:"carrot", q:1 },
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
  idle:      { emoji:"🙂", label:"待機中",    color:"#2adf60" },
  pulling:   { emoji:"😫", label:"草かり中",  color:"#ef6030" },
  tilling:   { emoji:"😠", label:"たがやし中",color:"#e0a020" },
  watering:  { emoji:"😤", label:"みずやり中",color:"#60c0f0" },
  harvesting:{ emoji:"🤩", label:"しゅうかく",color:"#ffe030" },
  exhausted: { emoji:"😪", label:"きゅうけい中",color:"#9060ef" },
};

const INV_ITEMS = [
  {k:"coins",e:"🪙"},{k:"poop",e:"💩"},{k:"grass",e:"🌿"},{k:"iron",e:"🔩"},
  {k:"wood",e:"🪵"},{k:"stone",e:"🪨"},{k:"thread",e:"🧵"},
  {k:"wheat",e:"🌾"},{k:"carrot",e:"🥕"},{k:"potato",e:"🥔"},
  {k:"tomato",e:"🍅"},{k:"corn",e:"🌽"},{k:"cotton",e:"🌸"},
];

// ── Cell component ──────────────────────────────────────
function Cell({ cell, onTap }: { cell: any; onTap: (id: number) => void }) {
  const crop = cell.crop ? CROPS[cell.crop as keyof typeof CROPS] : null;

  const bgMap: Record<string, string> = {
    weed:       "#0e1f0c",
    hard:       "#1a130a",
    tilled:     "#14100a",
    planted:    "#12100a",
    "needs-water": "#0a1018",
    growing:    "#0a1a0c",
    ready:      "#0e1a0a",
    danger:     "#18081a",
  };

  const borderMap: Record<string, string> = {
    weed:       "#1e3a1a",
    hard:       "#2e1e0e",
    tilled:     "#2a1c0e",
    planted:    "#2a200e",
    "needs-water": "#1a3040",
    growing:    "#2adf60",
    ready:      "#f0d020",
    danger:     "#8040df",
  };

  const glowMap: Record<string, string> = {
    ready:  "0 0 14px rgba(240,208,32,0.35)",
    danger: "0 0 14px rgba(128,64,224,0.35)",
    growing:"0 0 8px rgba(42,223,96,0.15)",
  };

  const bg     = bgMap[cell.state]     || "#0e1f0c";
  const border = borderMap[cell.state] || "#1e3a1a";
  const shadow = glowMap[cell.state]   || "none";

  const icon = crop
    ? crop.icon
    : (cell.state === "weed" ? "🌿" : cell.state === "hard" ? "🪨" : "🌰");

  const subLabel: Record<string, React.ReactNode> = {
    weed:          <span style={{color:"#3a7a40",fontSize:8,fontWeight:700}}>タップ→草刈り</span>,
    hard:          <span style={{color:"#6a4a20",fontSize:8,fontWeight:700}}>タップ→耕す</span>,
    tilled:        <span style={{color:"#7a5a30",fontSize:8,fontWeight:700}}>タップ→種まき</span>,
    planted:       <span style={{color:"#6a8a60",fontSize:8,fontWeight:700}}>タップ→水やり</span>,
    "needs-water": <span style={{color:"#4a90d0",fontSize:8,fontWeight:700}}>💧 タップ！</span>,
    growing:       null as any,
    ready:         <span style={{color:"#c0a010",fontSize:8,fontWeight:700}}>タップ→収穫！</span>,
    danger:        <span style={{color:"#8050cc",fontSize:8,fontWeight:700}}>⚠️ タップ！</span>,
  };

  return (
    <div
      onClick={() => onTap(cell.id)}
      style={{
        aspectRatio:"1", borderRadius:12, background:bg,
        border:`1px solid ${border}`, boxShadow:shadow,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        cursor:"pointer", position:"relative", overflow:"hidden",
        userSelect:"none", WebkitTapHighlightColor:"transparent",
        transition:"border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* furrow lines */}
      {["tilled","planted","needs-water","growing","ready","danger"].includes(cell.state) && (
        <div style={{position:"absolute",inset:0,pointerEvents:"none",borderRadius:12,
          backgroundImage:"repeating-linear-gradient(0deg,transparent 0,transparent 5px,rgba(255,255,255,0.03) 5px,rgba(255,255,255,0.03) 6px)"}} />
      )}

      <span style={{fontSize:cell.state==="growing"?22:24,lineHeight:1}}>{icon}</span>
      {subLabel[cell.state] && <div style={{marginTop:3}}>{subLabel[cell.state]}</div>}

      {/* growing progress */}
      {cell.state==="growing" && (
        <>
          <div style={{position:"absolute",bottom:5,left:"10%",right:"10%",height:3,background:"rgba(0,0,0,0.5)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:cell.fertilized?"linear-gradient(90deg,#a8ff78,#2adf60)":"#2adf60",width:`${(cell.pct||0)*100}%`}} />
          </div>
          <span style={{position:"absolute",bottom:10,fontSize:8,color:"#2adf60",fontWeight:700}}>
            {Math.round((cell.pct||0)*100)}%
          </span>
        </>
      )}

      {/* quality badge */}
      {cell.q && !["weed","hard","tilled"].includes(cell.state) && (
        <span style={{position:"absolute",top:4,right:5,fontSize:9,fontWeight:700,color:Q_COLOR[cell.q as keyof typeof Q_COLOR]}}>{Q_STARS[cell.q as keyof typeof Q_STARS]}</span>
      )}

      {/* fertilized tag */}
      {cell.fertilized && cell.state==="growing" && (
        <span style={{position:"absolute",top:4,left:4,fontSize:9}}>💩</span>
      )}

      {/* ready sparkle */}
      {cell.state==="ready" && (
        <span style={{position:"absolute",top:4,left:4,fontSize:10,animation:"spin 2s linear infinite"}}>✨</span>
      )}
    </div>
  );
}

// ── SeedPicker ──────────────────────────────────────────
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
              style={{background:"#122018",border:"1px solid #1e3d22",borderRadius:12,padding:"10px 4px",cursor:"pointer",textAlign:"center",fontFamily:"inherit",transition:"border-color 0.15s"}}>
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

// ── Main ────────────────────────────────────────────────
export default function FarmUI() {
  // ── ストア連携
  const inventory        = useSafariStore((s) => s.inventory);
  const coins            = useSafariStore((s) => s.coins);
  const addToInventory   = useSafariStore((s) => s.addToInventory);

  // ── 恩送りイベント
  const helpedGrandma      = useSafariStore((s) => s.helpedGrandma);
  const tickKizunaTurns    = useSafariStore((s) => s.tickKizunaTurns);
  const receiveKizunaBadge = useSafariStore((s) => s.receiveKizunaBadge);
  const [kizunaRescueOpen, setKizunaRescueOpen] = useState(false);

  const kizunaCheckedRef = useRef(false);
  useEffect(() => {
    if (kizunaCheckedRef.current) return;
    kizunaCheckedRef.current = true;
    if (!helpedGrandma) return;
    const turns = tickKizunaTurns();
    if (turns >= 3) {
      const t = setTimeout(() => setKizunaRescueOpen(true), 1200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cells, setCells]           = useState(loadCells);
  const [weather]                   = useState("sunny");
  const [action, setAction]         = useState("idle");
  const [stamina, setStamina]       = useState(2);
  const [picker, setPicker]         = useState<number | null>(null);
  const [waterTarget, setWaterTarget] = useState<number | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // localStorage 保存
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cells)); } catch {}
  }, [cells]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2200);
  };

  const handleTap = (id: number) => {
    setCells(prev => {
      const cs = prev.map((c: any) => ({...c}));
      const c  = cs.find((x: any) => x.id === id);
      if (!c) return prev;

      if (c.state === "weed") {
        c.state = "hard"; c.tillProg = 0;
        setAction("pulling"); setTimeout(() => setAction("idle"), 800);
        setStamina((s: number) => Math.min(s + 1, 5));
        addToInventory("grass", 1);
        showToast("✨ 草を抜いた！ +🌿");

      } else if (c.state === "hard") {
        c.state = "tilled";
        setAction("tilling"); setTimeout(() => setAction("idle"), 600);
        showToast("✅ 畑を耕した！");

      } else if (c.state === "tilled") {
        setPicker(id); return prev;

      } else if (c.state === "planted" || c.state === "needs-water") {
        setWaterTarget(id); return prev;

      } else if (c.state === "growing") {
        const np = Math.min(1, (c.pct || 0) + 0.25);
        c.pct = np;
        if (np >= 1) { c.state = "ready"; showToast("🎉 収穫できるよ！"); }
        else showToast(`${CROPS[c.crop as keyof typeof CROPS]?.icon} 育ち中… ${Math.round(np * 100)}%`);

      } else if (c.state === "ready") {
        const crop = CROPS[c.crop as keyof typeof CROPS];
        const qty  = c.q === 3 ? 6 : c.q === 2 ? 4 : 2;
        addToInventory(c.crop, qty);
        c.state = "tilled"; c.crop = null; c.q = null; c.pct = 0; c.fertilized = false;
        setAction("harvesting"); setTimeout(() => setAction("idle"), 1200);
        showToast(`${crop?.icon} しゅうかく！ +${qty}個`);

      } else if (c.state === "danger") {
        c.state = "growing"; c.pct = 0.5;
        showToast("🔨 ぼうふうネットをはった！ まもったよ！");
      }
      return cs;
    });
  };

  const handleSeedPick = (cropId: string) => {
    setCells((prev: any[]) => prev.map((c: any) => c.id === picker ? {...c, state:"planted", crop:cropId, q:1} : c));
    showToast(`🌰 ${CROPS[cropId as keyof typeof CROPS].label}をまいた！ みずやりしてね 💧`);
    setPicker(null);
  };

  const wm = WEATHER_META[weather as keyof typeof WEATHER_META];
  const am = ACTION_META[action as keyof typeof ACTION_META] || ACTION_META.idle;

  return (
    <div style={{
      maxWidth:390, margin:"0 auto",
      fontFamily:"'Hiragino Maru Gothic ProN','rounded mplus 1c',sans-serif",
      background:"#091208", minHeight:700,
      display:"flex", flexDirection:"column",
      borderRadius:16, overflow:"hidden",
      border:"1px solid #1a3a20", position:"relative",
    }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes readyGlow {
          0%,100%{box-shadow:0 0 10px rgba(240,208,32,0.3)}
          50%{box-shadow:0 0 22px rgba(240,208,32,0.6)}
        }
        @keyframes dangerGlow {
          0%,100%{box-shadow:0 0 10px rgba(128,64,224,0.3)}
          50%{box-shadow:0 0 22px rgba(128,64,224,0.6)}
        }
        @keyframes toastIn {
          from{opacity:0;transform:translateX(-50%) translateY(8px)}
          to{opacity:1;transform:translateX(-50%) translateY(0)}
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:"#0c1a0e",borderBottom:"1px solid #1e3d22",padding:"12px 14px 10px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:26}}>🌾</span>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:"#a8f0b0",letterSpacing:0.5}}>お手伝いサファリ</div>
            <div style={{fontSize:10,color:"#3a6a40",letterSpacing:2,marginTop:1}}>FARM</div>
          </div>
          {/* 天気バッジ */}
          <span style={{fontSize:13,background:"#122018",border:`1px solid ${wm.accent}`,borderRadius:8,padding:"3px 8px",color:wm.accent,fontWeight:700}}>{wm.icon} {wm.label}</span>
          <button
            onClick={() => { setCells(initCells()); showToast("🔄 リセットしました"); }}
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
      <div style={{background:"#0c1a0e",borderBottom:"1px solid #1a3a20",padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{
          width:52,height:52,borderRadius:"50%",flexShrink:0,
          background:"#122018",border:`2px solid ${am.color}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:26,position:"relative",boxSizing:"border-box",
          transition:"border-color 0.3s",
        }}>
          {am.emoji}
          <div style={{position:"absolute",bottom:1,right:1,width:10,height:10,borderRadius:"50%",background:am.color,border:"2px solid #0c1a0e",transition:"background 0.3s"}} />
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:am.color,letterSpacing:1,textTransform:"uppercase",transition:"color 0.3s"}}>{am.label}</div>
        </div>
        <div style={{fontSize:9,color:"#2a4a2e",textAlign:"right",lineHeight:1.8,flexShrink:0}}>
          🌿タップ＝草刈<br/>
          💧タップ＝水やり<br/>
          🌰タップ＝種まき<br/>
        </div>
      </div>

      {/* ── QUALITY STRIP ── */}
      <div style={{background:"#091008",borderBottom:"1px solid #1a3a20",padding:"4px 14px",display:"flex",gap:12,justifyContent:"center",alignItems:"center"}}>
        {([1,2,3] as const).map(q => (
          <div key={q} style={{fontSize:10,fontWeight:700,color:Q_COLOR[q],display:"flex",alignItems:"center",gap:3}}>
            <span>{Q_STARS[q]}</span>
            <span style={{color:"#2a4a2e"}}>{q===1?"ふつう":q===2?"りょうしつ":"ごくじょう"}</span>
          </div>
        ))}
        <span style={{fontSize:9,color:"#1e3a20"}}>💧＋💩＝★★★</span>
      </div>

      {/* ── GRID ── */}
      <div style={{flex:1,padding:"10px 10px 20px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{textAlign:"center"}}>
          <span style={{display:"inline-block",background:"#122018",border:"1px solid #1e4a24",borderRadius:10,padding:"4px 18px",fontSize:12,fontWeight:700,color:"#a8f0b0",letterSpacing:2}}>
            わたしの にわ
          </span>
        </div>
        <div style={{background:"#071008",border:"1px solid #1a3a20",borderRadius:16,padding:10}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {cells.map((cell: any) => (
              <Cell key={cell.id} cell={cell} onTap={handleTap} />
            ))}
          </div>
        </div>
      </div>

      {/* ── WATER PANEL ── */}
      {waterTarget !== null && (() => {
        const c = cells.find((x: any) => x.id === waterTarget);
        const crop = c?.crop ? CROPS[c.crop as keyof typeof CROPS] : null;
        const doWater = () => {
          setCells((prev: any[]) => prev.map((cl: any) => cl.id === waterTarget ? {...cl, state:"growing", pct:0.05, q:Math.max(cl.q||1,1)} : cl));
          setAction("watering"); setTimeout(() => setAction("idle"), 900);
          showToast("💧 みずやり完了！ ひんしつ★");
          setWaterTarget(null);
        };
        return (
          <div onClick={e => { if(e.target===e.currentTarget) setWaterTarget(null); }}
            style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",zIndex:30,borderRadius:16}}>
            <div style={{width:"100%",background:"#0a141e",borderRadius:"16px 16px 0 0",borderTop:"1px solid #4090d0",padding:"16px 14px 24px"}}>
              <div style={{width:32,height:3,background:"#204060",borderRadius:99,margin:"0 auto 14px"}} />
              <div style={{textAlign:"center",marginBottom:14}}>
                <div style={{fontSize:32,marginBottom:4}}>{crop?.icon || "🌱"}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#90d0f0"}}>{crop?.label || "なえ"} に みずやり</div>
                <div style={{fontSize:10,color:"#306080",marginTop:4}}>水をあげると 成長が始まるよ！</div>
              </div>
              <button onClick={doWater}
                style={{width:"100%",padding:"13px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1a4a70,#1060a0)",color:"#90e0ff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
                💧 みずやりする
              </button>
              <button onClick={() => setWaterTarget(null)}
                style={{width:"100%",padding:10,borderRadius:12,border:"1px solid #1a3a50",background:"#0a1a28",color:"#306080",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                やめる
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
          position:"absolute",bottom:24,left:"50%",
          transform:"translateX(-50%)",zIndex:80,
          padding:"9px 20px",borderRadius:24,
          background:"#0d2a14",border:"1px solid #2adf60",
          color:"#a8f0b0",fontWeight:700,fontSize:12,
          whiteSpace:"nowrap",pointerEvents:"none",
          animation:"toastIn 0.2s ease-out",
          maxWidth:"88%",textAlign:"center",
        }}>{toast}</div>
      )}

      {/* ── 恩送りイベント ── */}
      {kizunaRescueOpen && (
        <KizunaEventDialog
          phase="TYPHOON_RESCUE"
          onComplete={() => {
            receiveKizunaBadge();
            setKizunaRescueOpen(false);
            showToast("🏅 きずなの しょうを うけとった！ はたけも なおったよ！✨");
          }}
        />
      )}
    </div>
  );
}
