"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSafariStore } from "@/store/useSafariStore";

// ══════════════════════════════════════════════════════
//  定数
// ══════════════════════════════════════════════════════
const CROPS = [
  { id:"wheat",  icon:"🌾", label:"むぎ",        growHours:4,  yieldBase:2 },
  { id:"carrot", icon:"🥕", label:"にんじん",    growHours:6,  yieldBase:2 },
  { id:"potato", icon:"🥔", label:"じゃがいも",  growHours:8,  yieldBase:3 },
  { id:"tomato", icon:"🍅", label:"トマト",      growHours:10, yieldBase:3 },
  { id:"corn",   icon:"🌽", label:"とうもろこし", growHours:12, yieldBase:4 },
  { id:"cotton", icon:"🌸", label:"わた",        growHours:8,  yieldBase:2 },
];

const S = {
  WEED:"WEED", HARD_SOIL:"HARD_SOIL", TILLED:"TILLED",
  SEED_READY:"SEED_READY",       // 種が浮いてスワイプ待ち
  PLANTED:"PLANTED", NEEDS_WATER:"NEEDS_WATER",
  GROWING:"GROWING", TYPHOON_DANGER:"TYPHOON_DANGER", READY:"READY",
};

// ══════════════════════════════════════════════════════
//  SeedReadyCell — 種が浮いてスワイプ待ちのUI
// ══════════════════════════════════════════════════════
function SeedReadyCell({ crop, onSwipeDown }) {
  const [dragY, setDragY] = useState(0);
  const [planted, setPlanted] = useState(false);
  const startY = useRef(null);
  const THRESHOLD = 38;

  const onTouchStart = e => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = e => {
    if (startY.current == null) return;
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    setDragY(Math.min(dy, THRESHOLD + 10));
    e.preventDefault();
  };
  const onTouchEnd = () => {
    if (dragY >= THRESHOLD && !planted) {
      setPlanted(true);
      setTimeout(onSwipeDown, 250);
    }
    setDragY(0);
    startY.current = null;
  };
  // マウス対応
  const onPointerDown = e => { startY.current = e.clientY; };
  const onPointerMove = e => {
    if (startY.current == null || !(e.buttons & 1)) return;
    const dy = Math.max(0, e.clientY - startY.current);
    setDragY(Math.min(dy, THRESHOLD + 10));
  };
  const onPointerUp = () => {
    if (dragY >= THRESHOLD && !planted) {
      setPlanted(true);
      setTimeout(onSwipeDown, 250);
    }
    setDragY(0);
    startY.current = null;
  };

  const progress = Math.min(1, dragY / THRESHOLD);

  return (
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"flex-start",paddingTop:8,
        overflow:"hidden",touchAction:"none",userSelect:"none"}}>
      {/* 浮いている種の袋 */}
      <div style={{
        transform:`translateY(${dragY}px)`,
        transition: dragY===0 ? "transform 0.25s" : "none",
        animation: planted ? "none" : dragY>0 ? "none" : "seedFloat 1.2s ease-in-out infinite",
        filter:`drop-shadow(0 ${4+progress*8}px ${8+progress*12}px rgba(0,0,0,0.5))`,
      }}>
        <div style={{
          background:`linear-gradient(135deg,#fef9c3,#fde68a)`,
          border:"2px solid #d97706",
          borderRadius:12,padding:"5px 7px",textAlign:"center",
          boxShadow:`0 ${2+progress*6}px ${10+progress*14}px rgba(0,0,0,0.3)`,
          transform:`scale(${1+progress*0.1})`,transition:"transform 0.05s",
        }}>
          <span style={{fontSize:22}}>{crop.icon}</span>
        </div>
        {/* 矢印インジケータ */}
        {!planted && dragY<5 && (
          <div style={{textAlign:"center",marginTop:2,animation:"arrowBounce 0.7s ease-in-out infinite"}}>
            <span style={{fontSize:12,color:"rgba(255,220,100,0.9)"}}>👇</span>
          </div>
        )}
      </div>
      {/* 土の中に埋まるエフェクト */}
      {planted && (
        <div style={{position:"absolute",bottom:8,fontSize:20,animation:"buryAnim 0.3s ease-in forwards"}}>
          {crop.icon}
        </div>
      )}
      {/* 進捗ゲージ */}
      <div style={{position:"absolute",bottom:5,left:"15%",right:"15%",height:4,background:"rgba(0,0,0,0.3)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#4ade80,#16a34a)",width:`${progress*100}%`,transition:"width 0.05s"}} />
      </div>
      {/* ヒント */}
      {dragY<5&&!planted&&(
        <div style={{position:"absolute",bottom:12,fontSize:8,color:"rgba(255,220,150,0.8)",fontWeight:900}}>
          したへ スワイプ！
        </div>
      )}
    </div>
  );
}

const WEATHER  = { SUNNY:"SUNNY", RAINY:"RAINY", TYPHOON:"TYPHOON" };
const WEATHER_META = {
  [WEATHER.SUNNY]:   { icon:"☀️", label:"はれ",    bg:"linear-gradient(135deg,#fde68a,#f59e0b)" },
  [WEATHER.RAINY]:   { icon:"☔", label:"あめ",    bg:"linear-gradient(135deg,#93c5fd,#3b82f6)" },
  [WEATHER.TYPHOON]: { icon:"🌀", label:"たいふう", bg:"linear-gradient(135deg,#a78bfa,#7c3aed)" },
};

const Q_META = {
  1:{ stars:"★",     label:"ふつう",   color:"#9ca3af" },
  2:{ stars:"★★",   label:"りょうしつ",color:"#fbbf24" },
  3:{ stars:"★★★", label:"ごくじょう",color:"#a78bfa" },
};

const DEMO_SCALE       = 20/3600;
const WEED_HOLD_MS     = 3000;
const WATER_HOLD_MS    = 2500;
const TILL_STEPS       = 3;
const FATIGUE_LIMIT    = 5;
const COOLDOWN_MS      = 3*60*1000;
const WEATHER_CHANGE_MS= 45000;
const TYPHOON_GRACE_MS = 15000;
const LS_KEY           = "osafari_farm_v8";

const ACTION = { IDLE:"IDLE", PULLING:"PULLING", TILLING:"TILLING", PLANTING:"PLANTING", HARVESTING:"HARVESTING", EXHAUSTED:"EXHAUSTED", WATERING:"WATERING" };
const AVATAR_ASSETS = {
  [ACTION.IDLE]:      { emoji:"🙂", label:"待機中" },
  [ACTION.PULLING]:   { emoji:"😫", label:"草かり中" },
  [ACTION.TILLING]:   { emoji:"😠", label:"たがやし中" },
  [ACTION.PLANTING]:  { emoji:"😊", label:"たねまき中" },
  [ACTION.WATERING]:  { emoji:"😤", label:"みずやり中" },
  [ACTION.HARVESTING]:{ emoji:"🤩", label:"しゅうかく" },
  [ACTION.EXHAUSTED]: { emoji:"😪", label:"きゅうけい中" },
};

const makeCell = (id, state=S.WEED, extra={}) => ({
  id, state, crop:null, plantedAt:null, readyAt:null,
  yieldMult:1, tillProgress:0, quality:1, watered:false, fertilized:false, ...extra,
});
const initCells = () => [
  makeCell(0,S.WEED),      makeCell(1,S.HARD_SOIL), makeCell(2,S.WEED),
  makeCell(3,S.HARD_SOIL), makeCell(4,S.TILLED),    makeCell(5,S.WEED),
  makeCell(6,S.WEED),      makeCell(7,S.HARD_SOIL), makeCell(8,S.TILLED),
];

const loadSt = () => { try{ const r=localStorage.getItem(LS_KEY); return r?JSON.parse(r):null; }catch{ return null; } };
const saveSt = s => { try{ localStorage.setItem(LS_KEY,JSON.stringify(s)); }catch{} };
const humanTime = readyAt => {
  if(!readyAt) return "";
  const ms=new Date(readyAt)-Date.now();
  if(ms<=0) return "もうすぐ！";
  const s=Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
  if(h>=8)  return "☀️ あしたのあさ";
  if(h>=2)  return `🌙 あと ${h}じかん`;
  if(h>=1)  return `⏳ ${h}じかん${m}ふん`;
  if(m>=1)  return `⏳ ${m}ふん`;
  return `🌱 ${sc}びょう`;
};
const pRatio = (p,r) => (!p||!r)?0:Math.min(1,Math.max(0,(Date.now()-new Date(p))/(new Date(r)-new Date(p))));
const fmtCD  = ms => { const m=Math.floor(ms/60000),s=Math.ceil((ms%60000)/1000); return m>0?`${m}ふん${s}びょう`:`${s}びょう`; };
const calcQ  = (watered,fertilized,bonus) => !watered?1:fertilized&&bonus?3:fertilized?2:1;

// ══════════════════════════════════════════════════════
//  グローバル ドラッグ状態
// ══════════════════════════════════════════════════════
// dragState: { type:"seed"|"manure", cropId?, x, y }
let _dragState = null;

// ══════════════════════════════════════════════════════
//  パーティクルヘルパー
// ══════════════════════════════════════════════════════
function NumPop({ x, y, items, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,1400); return()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",left:x,top:y,zIndex:1000,pointerEvents:"none",
      display:"flex",flexDirection:"column",alignItems:"center",gap:3,transform:"translateX(-50%)"}}>
      {items.map((it,i)=>(
        <span key={i} style={{fontSize:it.big?18:14,fontWeight:900,color:it.color||"#fff",
          textShadow:"0 2px 6px rgba(0,0,0,0.6)",
          animation:"popUp 1.2s ease-out forwards",animationDelay:`${i*100}ms`}}>
          {it.emoji}{it.qty!=null&&it.qty>0?"+"+it.qty:""}
        </span>
      ))}
    </div>
  );
}

// 水滴が落ちる演出
function WaterDrops({ x, y }) {
  const drops = useMemo(()=>Array.from({length:5},(_,i)=>({
    i, lx:(Math.random()*32-16), dur:0.5+Math.random()*0.4, delay:i*0.15
  })),[]);
  return (
    <div style={{position:"fixed",left:x,top:y,zIndex:998,pointerEvents:"none"}}>
      {drops.map(d=>(
        <span key={d.i} style={{position:"absolute",left:d.lx,top:0,fontSize:14,
          animation:`waterFall ${d.dur}s ease-in infinite`,animationDelay:`${d.delay}s`,opacity:0}}>💧</span>
      ))}
    </div>
  );
}

// インベントリを飛び越えるエフェクト
function FlyParticle({ emoji, fromX, fromY, toX, toY, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,900); return()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",left:fromX,top:fromY,zIndex:1001,pointerEvents:"none",
      "--dx":(toX-fromX)+"px","--dy":(toY-fromY)+"px"}}>
      <span style={{display:"block",fontSize:20,animation:"flyToInv 0.85s ease-in forwards",
        transformOrigin:"center"}}>
        {emoji}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  FarmAvatar
// ══════════════════════════════════════════════════════
function FarmAvatar({ action, holdProgress=0, tillBounce=false }) {
  const asset = AVATAR_ASSETS[action]||AVATAR_ASSETS[ACTION.IDLE];
  const isPulling=action===ACTION.PULLING, isTilling=action===ACTION.TILLING;
  const isPlanting=action===ACTION.PLANTING, isHarvesting=action===ACTION.HARVESTING;
  const isExhausted=action===ACTION.EXHAUSTED, isWatering=action===ACTION.WATERING;
  const sweatCount = (isPulling||isWatering)?Math.floor(holdProgress*4):0;
  const bodyAnim = isExhausted?"avatarExhausted 2.5s ease-in-out infinite"
    :isWatering?"avatarWater 0.6s ease-in-out infinite"
    :(isTilling&&tillBounce)?"avatarTillBounce 0.28s ease-out"
    :isPlanting?"avatarFloat 0.5s ease-out"
    :isHarvesting?"avatarJump 0.5s ease-out"
    :isPulling?`avatarPullShake ${0.12+holdProgress*0.06}s ease-in-out infinite`
    :"avatarBreath 3s ease-in-out infinite";
  const bg = isExhausted?"radial-gradient(circle,#4c1d95,#2e1065)"
    :isWatering?`radial-gradient(circle,#1e40af ${holdProgress*80}%,#1e3a8a)`
    :isPulling?`radial-gradient(circle,#7f1d1d ${holdProgress*80}%,#451a03)`
    :isTilling?"radial-gradient(circle,#78350f,#451a03)"
    :isHarvesting?"radial-gradient(circle,#065f46,#022c22)"
    :isPlanting?"radial-gradient(circle,#164e63,#0c4a6e)"
    :"radial-gradient(circle,#1e3a5f,#0f2744)";
  const border=isExhausted?"#7c3aed":isWatering?"#60a5fa":isPulling?"#ef4444":isTilling?"#f59e0b":isHarvesting?"#10b981":"#3b82f6";
  return (
    <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",width:80,flexShrink:0}}>
      {isExhausted&&[0,1,2].map(i=>(
        <span key={i} style={{position:"absolute",top:0,left:"50%",fontSize:10+i*3,color:"#c4b5fd",fontWeight:900,animation:`zzzFloat ${1.8+i*0.4}s ease-out infinite`,animationDelay:`${i*0.55}s`,pointerEvents:"none",opacity:0}}>Zzz</span>
      ))}
      {Array.from({length:sweatCount},(_,i)=>(
        <span key={i} style={{position:"absolute",top:4,left:`${30+i*14}%`,fontSize:12,animation:"sweatDrop 0.8s ease-out infinite",animationDelay:`${i*0.2}s`,pointerEvents:"none"}}>{isWatering?"💧":"💦"}</span>
      ))}
      {isWatering&&<span style={{position:"absolute",top:-8,right:8,fontSize:18,animation:"wateringCan 0.6s ease-in-out infinite"}}>🚿</span>}
      <div style={{fontSize:isPulling||isWatering?32+holdProgress*10:36,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",width:56,height:56,borderRadius:"50%",background:bg,border:`3px solid ${border}`,boxShadow:"0 3px 10px rgba(0,0,0,0.5)",animation:bodyAnim,transition:"background 0.3s,border 0.3s,font-size 0.1s",userSelect:"none"}}>
        <span style={{filter:"drop-shadow(0 2px 3px rgba(0,0,0,0.4))"}}>{asset.emoji}</span>
      </div>
      {(isPulling||isWatering)&&(
        <div style={{width:52,height:5,marginTop:4,background:"rgba(0,0,0,0.4)",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:99,background:isWatering?"linear-gradient(90deg,#38bdf8,#0ea5e9)":"linear-gradient(90deg,#fbbf24,#ef4444)",width:`${holdProgress*100}%`,transition:"width 0.05s linear",boxShadow:isWatering?"0 0 6px #38bdf8":"0 0 6px #fbbf24"}} />
        </div>
      )}
      <div style={{marginTop:4,fontSize:9,fontWeight:900,textAlign:"center",color:isExhausted?"#c4b5fd":isWatering?"#7dd3fc":isPulling?"#fca5a5":isTilling?"#fde68a":isHarvesting?"#6ee7b7":"rgba(255,230,150,0.8)",textShadow:"0 1px 3px rgba(0,0,0,0.6)"}}>{asset.label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  ドラッグ中の「種の袋」カーソル
// ══════════════════════════════════════════════════════
function DragCursor({ dragState }) {
  if (!dragState) return null;
  const crop = CROPS.find(c=>c.id===dragState.cropId);
  return (
    <div style={{position:"fixed",left:dragState.x,top:dragState.y,zIndex:1002,pointerEvents:"none",
      transform:"translate(-50%,-50%)",transition:"none"}}>
      <div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"3px solid #d97706",
        borderRadius:16,padding:"8px 10px",textAlign:"center",
        boxShadow:"0 4px 20px rgba(0,0,0,0.4)",animation:"dragFloat 0.5s ease-in-out infinite alternate"}}>
        <div style={{fontSize:26}}>{dragState.type==="manure"?"💩":crop?.icon||"🌰"}</div>
        <div style={{fontSize:9,fontWeight:900,color:"#7c2d12",marginTop:2}}>
          {dragState.type==="manure"?"ひりょう":crop?.label}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  種選択パネル（TILLED タップ後に出る）
// ══════════════════════════════════════════════════════
function SeedPicker({ onPick, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(0,0,0,0.55)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:480,background:"linear-gradient(160deg,#fdf6e3,#f0deb8)",
        borderRadius:"28px 28px 0 0",border:"4px solid #c8a060",borderBottom:"none",
        boxShadow:"0 -8px 32px rgba(0,0,0,0.4)",padding:"18px 16px 28px",
        fontFamily:"'Hiragino Maru Gothic ProN','rounded mplus 1c',sans-serif"}}>
        <div style={{width:36,height:4,background:"#c8a060",borderRadius:99,margin:"0 auto 12px"}} />
        <div style={{fontSize:15,fontWeight:900,color:"#5a3810",marginBottom:6,textAlign:"center"}}>
          🌰 たねを えらんで <span style={{color:"#16a34a"}}>タップ</span> してね！
        </div>
        <div style={{fontSize:11,color:"#7a5030",textAlign:"center",marginBottom:12}}>
          えらんだ種がマスの上に浮くよ → そのまま<b>したへスワイプ</b>で種まき！
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
          {CROPS.map(c=>(
            <button key={c.id}
              onClick={()=>onPick(c.id)}
              style={{border:"2px solid #d4b06a",borderRadius:14,
                padding:"10px 4px",cursor:"pointer",fontFamily:"inherit",
                background:"rgba(255,255,255,0.75)",
                transition:"all 0.12s",touchAction:"manipulation",
                WebkitTapHighlightColor:"transparent"}}>
              <div style={{fontSize:22}}>{c.icon}</div>
              <div style={{fontSize:11,fontWeight:900,color:"#4a2e08",marginTop:2}}>{c.label}</div>
              <div style={{fontSize:9,color:"#7a5030",marginTop:1}}>🕐{c.growHours}h</div>
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",padding:"11px 0",borderRadius:16,border:"none",cursor:"pointer",background:"linear-gradient(180deg,#aaa,#888)",color:"#fff",fontWeight:900,fontSize:14,fontFamily:"inherit",boxShadow:"0 3px 0 #555"}}>やめる</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  Cell
// ══════════════════════════════════════════════════════
const TILL_BG=[
  "radial-gradient(ellipse at 50% 40%,#9c7a56 0%,#7a5830 60%,#6a4a22 100%)",
  "radial-gradient(ellipse at 50% 40%,#8a6840 0%,#6a4820 60%,#5a3a12 100%)",
  "radial-gradient(ellipse at 50% 40%,#7a5430 0%,#5a3610 60%,#4a2c08 100%)",
];

function Cell({ cell, now, onAction, holdingId, holdProgress, wateringId, waterProgress, shaking, dragOverId }) {
  const crop = CROPS.find(c=>c.id===cell.crop);
  const pct  = pRatio(cell.plantedAt, cell.readyAt);
  const isHolding  = holdingId===cell.id;
  const isWatering = wateringId===cell.id;
  const isDragOver = dragOverId===cell.id;
  const isShaking  = shaking===cell.id;
  const ready      = cell.state===S.READY;
  const isDanger   = cell.state===S.TYPHOON_DANGER;
  const qm         = Q_META[cell.quality||1];

  const wetFrac = isWatering ? waterProgress : 0;

  const bgMap = {
    [S.WEED]:           "radial-gradient(ellipse at 50% 40%,#5da84a 0%,#3d8230 60%,#2d6622 100%)",
    [S.HARD_SOIL]:      TILL_BG[cell.tillProgress]||TILL_BG[0],
    [S.TILLED]:         "radial-gradient(ellipse at 50% 35%,#7a4e28 0%,#5a3210 60%,#4a2800 100%)",
    [S.PLANTED]:        "radial-gradient(ellipse at 50% 35%,#7a4e28 0%,#5a3210 60%,#4a2800 100%)",
    [S.NEEDS_WATER]:    isWatering
      ? `radial-gradient(ellipse at 50% 35%,${`hsl(${200+wetFrac*40},${60+wetFrac*40}%,${30-wetFrac*15}%)`} 0%,#3a2000 100%)`
      : "radial-gradient(ellipse at 50% 35%,#8a5a28 0%,#6a3a10 60%,#5a2a00 100%)",
    [S.GROWING]:        "radial-gradient(ellipse at 50% 35%,#6a4420 0%,#4a2c08 60%,#3a2000 100%)",
    [S.TYPHOON_DANGER]: "radial-gradient(ellipse at 50% 35%,#4a1a40 0%,#2e0a28 60%,#1a0018 100%)",
    [S.READY]:          "radial-gradient(ellipse at 50% 35%,#6a4420 0%,#4a2c08 60%,#3a2000 100%)",
  };

  const cellAnim = isDanger?"typhoonCell 0.3s ease-in-out infinite"
    :ready?"cellGlow 1.6s ease-in-out infinite"
    :isShaking?"cellShake 0.35s ease-in-out"
    :isHolding?"weedShake 0.18s ease-in-out infinite"
    :"none";

  const showDragOver = isDragOver && [S.TILLED, S.GROWING, S.TYPHOON_DANGER].includes(cell.state);

  return (
    <div
      onPointerDown={e=>onAction("down", cell, e)}
      onPointerUp={e=>onAction("up", cell, e)}
      onPointerLeave={e=>onAction("leave", cell, e)}
      style={{position:"relative",borderRadius:10,background:bgMap[cell.state]||bgMap[S.WEED],
        cursor:"pointer",overflow:"hidden",aspectRatio:"1",userSelect:"none",
        WebkitTapHighlightColor:"transparent",touchAction:"none",
        boxShadow: showDragOver?"0 0 0 4px #fbbf24,0 0 20px #fbbf2488"
          :isDanger?"0 0 0 3px #a78bfa,0 0 16px #7c3aed"
          :ready?`0 0 0 3px ${cell.quality===3?"#ec4899":cell.quality===2?"#fbbf24":"#ffe066"},0 3px 8px rgba(0,0,0,0.45)`
          :"0 3px 7px rgba(0,0,0,0.4),inset 0 2px 4px rgba(255,220,150,0.07)",
        animation:cellAnim,transition:"box-shadow 0.2s,background 0.4s"}}
    >
      {/* 畝 */}
      {[S.TILLED,S.PLANTED,S.NEEDS_WATER,S.GROWING,S.TYPHOON_DANGER,S.READY].includes(cell.state)&&(
        <div style={{position:"absolute",inset:0,pointerEvents:"none",borderRadius:10,backgroundImage:"repeating-linear-gradient(0deg,transparent 0,transparent 5px,rgba(0,0,0,0.13) 5px,rgba(0,0,0,0.13) 6px)"}} />
      )}
      {/* ヒビ */}
      {cell.state===S.HARD_SOIL&&cell.tillProgress>=1&&(
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:cell.tillProgress===1?0.35:0.65,backgroundImage:cell.tillProgress===1?"linear-gradient(45deg,transparent 45%,rgba(0,0,0,0.4) 45%,rgba(0,0,0,0.4) 46%,transparent 46%),linear-gradient(-45deg,transparent 48%,rgba(0,0,0,0.3) 48%,rgba(0,0,0,0.3) 49%,transparent 49%)":"linear-gradient(30deg,transparent 30%,rgba(0,0,0,0.4) 30%,rgba(0,0,0,0.4) 31%,transparent 31%),linear-gradient(-30deg,transparent 35%,rgba(0,0,0,0.35) 35%,rgba(0,0,0,0.35) 36%,transparent 36%)"}} />
      )}
      {/* 水ゲージオーバーレイ */}
      {isWatering&&(
        <div style={{position:"absolute",inset:0,borderRadius:9,pointerEvents:"none",
          background:`linear-gradient(to top,rgba(56,189,248,${0.2+wetFrac*0.4}) 0%,transparent ${wetFrac*100}%)`,
          transition:"background 0.1s"}} />
      )}
      <div style={{position:"absolute",inset:0,borderRadius:10,pointerEvents:"none",boxShadow:"inset 0 3px 6px rgba(255,220,150,0.1),inset 0 -3px 6px rgba(0,0,0,0.3)"}} />

      {/* ドラッグオーバーハイライト */}
      {showDragOver&&(
        <div style={{position:"absolute",inset:0,borderRadius:9,
          background:"rgba(251,191,36,0.25)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:28,animation:"dragPulse 0.6s ease-in-out infinite",pointerEvents:"none"}}>
          {cell.state===S.TILLED?"🌰":"💩"}
        </div>
      )}

      {/* WEED */}
      {cell.state===S.WEED&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
          <span style={{fontSize:26,display:"block",filter:`drop-shadow(0 2px 3px rgba(0,0,0,0.4))${isHolding?" drop-shadow(0 0 8px #fff)":""}`,animation:isHolding?"weedShake 0.15s ease-in-out infinite":`weedBob 2s ease-in-out infinite`,animationDelay:isHolding?"0s":`${cell.id*0.3}s`}}>{["🌿","🍃","🌱"][cell.id%3]}</span>
          <span style={{fontSize:8,color:"rgba(255,255,200,0.75)",fontWeight:700}}>{isHolding?"ぬけそう…！":"ぐーっと おさえて！"}</span>
          {isHolding&&(
            <div style={{position:"absolute",bottom:6,left:"10%",right:"10%",height:6,background:"rgba(0,0,0,0.4)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#fbbf24,#f59e0b)",width:`${holdProgress*100}%`,transition:"width 0.05s"}} />
            </div>
          )}
        </div>
      )}

      {/* HARD_SOIL */}
      {cell.state===S.HARD_SOIL&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
          <span style={{fontSize:22,opacity:0.75}}>{["⬜","🪨","💢","✅"][Math.min(cell.tillProgress,3)]}</span>
          <span style={{fontSize:8,color:"rgba(255,220,150,0.85)",fontWeight:700}}>{cell.tillProgress===0?"ザクッ！ たがやす":cell.tillProgress===1?`あと${TILL_STEPS-cell.tillProgress}かい！`:"もう1かい！！"}</span>
          <div style={{position:"absolute",bottom:5,left:"12%",right:"12%",height:4,background:"rgba(0,0,0,0.35)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#fb923c,#ea580c)",width:`${(cell.tillProgress/TILL_STEPS)*100}%`,transition:"width 0.2s"}} />
          </div>
        </div>
      )}

      {/* TILLED */}
      {cell.state===S.TILLED&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
          <span style={{fontSize:20,opacity:0.65}}>🌰</span>
          <span style={{fontSize:8,color:"rgba(255,220,150,0.8)",fontWeight:700}}>タップ→たね選択</span>
        </div>
      )}

      {/* SEED_READY — 種が浮いていてスワイプ待ち */}
      {cell.state===S.SEED_READY&&crop&&(
        <SeedReadyCell crop={crop} onSwipeDown={()=>onAction("swipe_plant", cell, null)} />
      )}

      {/* PLANTED */}
      {cell.state===S.PLANTED&&crop&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <span style={{fontSize:22,opacity:0.65}}>{crop.icon}</span>
          <span style={{fontSize:7,color:"rgba(255,220,150,0.8)",fontWeight:900,textAlign:"center",padding:"0 4px"}}>
            長押し2秒で<br/>みずやり🚿
          </span>
        </div>
      )}

      {/* NEEDS_WATER */}
      {cell.state===S.NEEDS_WATER&&crop&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <span style={{fontSize:isWatering?28:22,opacity:isWatering?1:0.75,transition:"font-size 0.2s"}}>{crop.icon}</span>
          {isWatering?(
            <div style={{width:"80%",height:5,background:"rgba(0,0,0,0.4)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#38bdf8,#0ea5e9)",width:`${waterProgress*100}%`,transition:"width 0.05s",boxShadow:"0 0 6px #38bdf8"}} />
            </div>
          ):(
            <span style={{fontSize:7,color:"#7dd3fc",fontWeight:900,textAlign:"center",animation:"blink 1.2s infinite"}}>💧 ながおし！</span>
          )}
          {isWatering&&<span style={{fontSize:8,color:"#7dd3fc",fontWeight:900}}>チョロチョロ…</span>}
        </div>
      )}

      {/* GROWING */}
      {cell.state===S.GROWING&&crop&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"6px 4px"}}>
          <span style={{fontSize:pct<0.5?18:24,animation:"growSway 2.5s ease-in-out infinite",animationDelay:`${cell.id*0.25}s`,transition:"font-size 0.5s",filter:`drop-shadow(0 2px 4px rgba(0,0,0,0.4))${cell.fertilized?" drop-shadow(0 0 6px #a8ff78)":""}`}}>{crop.icon}</span>
          <div style={{width:"82%",height:4,background:"rgba(0,0,0,0.45)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:cell.fertilized?"linear-gradient(90deg,#a8ff78,#56ab2f)":"linear-gradient(90deg,#a8e063,#56ab2f)",width:`${pct*100}%`,transition:"width 1s"}} />
          </div>
          <span style={{fontSize:8,color:"#fde68a",fontWeight:700,textAlign:"center",lineHeight:1.3}}>{humanTime(cell.readyAt)}</span>
          <span style={{position:"absolute",top:3,right:3,fontSize:9,color:qm.color,fontWeight:900,textShadow:`0 0 6px ${qm.color}`}}>{qm.stars}</span>
          {cell.fertilized&&<span style={{position:"absolute",top:3,left:3,fontSize:10}}>💩</span>}
          <span style={{position:"absolute",bottom:3,fontSize:7,color:"rgba(255,220,100,0.5)",fontWeight:700}}>💩ドラッグ可</span>
        </div>
      )}

      {/* TYPHOON_DANGER */}
      {cell.state===S.TYPHOON_DANGER&&crop&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <span style={{fontSize:26,animation:"typhoonCrop 0.4s ease-in-out infinite",filter:"drop-shadow(0 0 8px #a78bfa)"}}>{crop.icon}</span>
          <span style={{fontSize:9,color:"#fde68a",fontWeight:900,animation:"blink 0.4s infinite",textShadow:"0 0 6px red"}}>⚠️ ピンチ！</span>
          <span style={{fontSize:7,color:"#c4b5fd",fontWeight:700}}>タップで防ぐ！🔨</span>
          <span style={{position:"absolute",top:3,right:3,fontSize:9,color:qm.color,fontWeight:900}}>{qm.stars}</span>
        </div>
      )}

      {/* READY */}
      {cell.state===S.READY&&crop&&(
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          {cell.quality===3&&<div style={{position:"absolute",inset:0,borderRadius:9,animation:"rainbowBg 2s linear infinite",opacity:0.25}} />}
          <span style={{position:"absolute",top:4,right:5,fontSize:11,animation:cell.quality===3?"spin 1s linear infinite":"spin 2s linear infinite"}}>✨</span>
          {cell.quality>=2&&<span style={{position:"absolute",bottom:7,left:4,fontSize:10,animation:"spin 2.5s linear infinite reverse"}}>⭐</span>}
          {cell.quality===3&&<span style={{position:"absolute",top:4,left:4,fontSize:10,animation:"spin 1.5s linear infinite"}}>🌈</span>}
          <span style={{fontSize:30,filter:cell.quality===3?"drop-shadow(0 0 12px #ec4899) drop-shadow(0 0 6px #a78bfa)":cell.quality===2?"drop-shadow(0 0 10px gold)":"drop-shadow(0 0 7px gold)",animation:`readyBounce ${cell.quality===3?0.6:0.9}s ease-in-out infinite alternate`}}>{crop.icon}</span>
          <span style={{fontSize:8,color:cell.quality===3?"#f9a8d4":"#fde047",fontWeight:900,letterSpacing:1,textShadow:"0 1px 4px rgba(0,0,0,0.6)"}}>タップ！しゅうかく</span>
          <span style={{fontSize:9,color:qm.color,fontWeight:900,textShadow:`0 0 6px ${qm.color}`}}>{qm.stars}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  WeatherBar
// ══════════════════════════════════════════════════════
function WeatherBar({ weather, nextChange }) {
  const [prog,setProg]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>{ setProg(Math.max(0,1-(nextChange-Date.now())/WEATHER_CHANGE_MS)); },500); return()=>clearInterval(t); },[nextChange]);
  const m=WEATHER_META[weather];
  return (
    <div style={{flexShrink:0,background:m.bg,padding:"6px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"3px solid rgba(0,0,0,0.2)"}}>
      <span style={{fontSize:26,filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.3))",animation:weather===WEATHER.TYPHOON?"typhoonSpin 1s linear infinite":weather===WEATHER.RAINY?"rainBob 1s ease-in-out infinite":"none"}}>{m.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:900,color:"rgba(0,0,0,0.7)"}}>きょうのてんき：<b>{m.label}</b>
          {weather===WEATHER.RAINY&&<span style={{fontSize:10,marginLeft:6,color:"#1e40af"}}>💧 みずやり自動！</span>}
          {weather===WEATHER.TYPHOON&&<span style={{fontSize:10,marginLeft:6,color:"#7c3aed",fontWeight:900,animation:"blink 0.5s infinite"}}>⚠️ はたけをまもれ！</span>}
        </div>
        <div style={{height:4,background:"rgba(0,0,0,0.15)",borderRadius:99,overflow:"hidden",marginTop:3}}>
          <div style={{height:"100%",background:"rgba(0,0,0,0.25)",borderRadius:99,width:`${prog*100}%`,transition:"width 0.5s"}} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  メイン
// ══════════════════════════════════════════════════════
export default function FarmUI() {
  const saved=loadSt();
  // ★ グローバルストアから inv/coins を取得
  const inventory   = useSafariStore((s) => s.inventory);
  const coins       = useSafariStore((s) => s.coins);
  const addToInventory  = useSafariStore((s) => s.addToInventory);
  const consumeInventory = useSafariStore((s) => s.consumeInventory);

  const [cells,setCells]=useState(()=>saved?.cells??initCells());
  const [now,setNow]=useState(Date.now());
  const [seedPicker,setSeedPicker]=useState(null); // cellId
  const [pops,setPops]=useState([]);
  const [toast,setToast]=useState(null);
  const [workCount,setWorkCount]=useState(saved?.workCount??0);
  const [cooldownEnd,setCooldownEnd]=useState(saved?.cooldownEnd??null);
  const [cooldownMs,setCooldownMs]=useState(0);
  const [currentAction,setCurrentAction]=useState(ACTION.IDLE);
  const [tillBounce,setTillBounce]=useState(false);
  const [weather,setWeather]=useState(saved?.weather??WEATHER.SUNNY);
  const [nextWeatherChange,setNextWeatherChange]=useState(saved?.nextWeatherChange??Date.now()+WEATHER_CHANGE_MS);
  const [flyParticles,setFlyParticles]=useState([]);

  // ── ホールド(草刈り/水やり)
  const [holdingId,setHoldingId]=useState(null);
  const [holdProgress,setHoldProgress]=useState(0);
  const [wateringId,setWateringId]=useState(null);
  const [waterProgress,setWaterProgress]=useState(0);
  const [waterDropPos,setWaterDropPos]=useState(null);
  const [shaking,setShaking]=useState(null);

  // ── ドラッグ
  const [dragState,setDragState]=useState(null);  // {type,cropId,x,y}
  const [dragOverId,setDragOverId]=useState(null);

  const actionTimerRef=useRef(null);
  const holdStart=useRef(null), holdTimer=useRef(null), dustTimer=useRef(null);
  const waterStart=useRef(null), waterTimer=useRef(null);
  const invBarRef=useRef(null);
  const cellRefs=useRef({});
  const gridRef=useRef(null);

  const triggerAction=useCallback((a,ms=0)=>{
    if(actionTimerRef.current)clearTimeout(actionTimerRef.current);
    setCurrentAction(a);
    if(ms>0)actionTimerRef.current=setTimeout(()=>setCurrentAction(ACTION.IDLE),ms);
  },[]);

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),500); return()=>clearInterval(t); },[]);
  useEffect(()=>{ setCells(cs=>cs.map(c=>c.state===S.GROWING&&c.readyAt&&Date.now()>=new Date(c.readyAt)?{...c,state:S.READY}:c)); },[now]);

  // 天気
  useEffect(()=>{
    if(Date.now()<nextWeatherChange)return;
    const ws=[WEATHER.SUNNY,WEATHER.SUNNY,WEATHER.RAINY,WEATHER.TYPHOON];
    const next=ws[Math.floor(Math.random()*ws.length)];
    setWeather(next); setNextWeatherChange(Date.now()+WEATHER_CHANGE_MS);
    if(next===WEATHER.RAINY){
      setCells(cs=>cs.map(c=>c.state===S.NEEDS_WATER?{...c,state:S.GROWING,...startGrow(c),watered:true}:c));
      showToast("☔ あめ！ みずやりが自動でできたよ！",3000);
    }
    if(next===WEATHER.TYPHOON){
      setCells(cs=>cs.map(c=>c.state===S.GROWING?{...c,state:S.TYPHOON_DANGER}:c));
      showToast("🌀 たいふう！ はたけをまもれ！",4000);
      setTimeout(()=>{ setCells(cs=>cs.map(c=>c.state===S.TYPHOON_DANGER?{...c,state:S.GROWING,quality:1}:c)); showToast("💨 たいふうがすぎた…ひんしつがさがった",3000); },TYPHOON_GRACE_MS);
    }
    if(next===WEATHER.SUNNY) setCells(cs=>cs.map(c=>c.state===S.TYPHOON_DANGER?{...c,state:S.GROWING}:c));
  },[now]);

  useEffect(()=>{
    if(!cooldownEnd){setCooldownMs(0);return;}
    const rem=new Date(cooldownEnd)-Date.now();
    if(rem<=0){setCooldownMs(0);setCooldownEnd(null);setWorkCount(0);setCurrentAction(ACTION.IDLE);}
    else{setCooldownMs(rem);setCurrentAction(ACTION.EXHAUSTED);}
  },[now,cooldownEnd]);

  useEffect(()=>{ saveSt({cells,workCount,cooldownEnd,weather,nextWeatherChange}); },[cells,workCount,cooldownEnd,weather,nextWeatherChange]);

  const showToast=(msg,dur=2400)=>{setToast(msg);setTimeout(()=>setToast(null),dur);};
  const addPop=(x,y,items)=>{const id=Date.now()+Math.random();setPops(p=>[...p,{id,x,y,items}]);setTimeout(()=>setPops(p=>p.filter(x=>x.id!==id)),1500);};
  const addFly=(emoji,fromX,fromY)=>{
    const invRect=invBarRef.current?.getBoundingClientRect();
    if(!invRect)return;
    const id=Date.now()+Math.random();
    setFlyParticles(p=>[...p,{id,emoji,fromX,fromY,toX:invRect.left+invRect.width/2,toY:invRect.top+10}]);
    setTimeout(()=>setFlyParticles(p=>p.filter(x=>x.id!==id)),950);
  };

  const isTired=()=>cooldownEnd&&Date.now()<new Date(cooldownEnd);
  const doWork=useCallback(()=>{
    setWorkCount(prev=>{
      const next=prev+1;
      if(next>=FATIGUE_LIMIT){
        const end=new Date(Date.now()+COOLDOWN_MS).toISOString();
        setCooldownEnd(end); triggerAction(ACTION.EXHAUSTED,0);
        showToast("💦 ふぅ… ちょっときゅうけいしよう！",3000); return 0;
      }
      return next;
    });
  },[triggerAction]);

  const startGrow=useCallback((c)=>{
    const crop=CROPS.find(cr=>cr.id===c.crop); if(!crop)return{};
    const demoMs=crop.growHours/DEMO_SCALE*1000;
    const plantedAt=new Date().toISOString();
    const readyAt=new Date(Date.now()+demoMs).toISOString();
    return{plantedAt,readyAt};
  },[]);

  // ── 草刈りホールドキャンセル
  const cancelWeedHold=useCallback(()=>{
    if(holdTimer.current)clearInterval(holdTimer.current);
    if(dustTimer.current)clearInterval(dustTimer.current);
    setHoldProgress(0); setHoldingId(null);
    if(currentAction===ACTION.PULLING)triggerAction(ACTION.IDLE,100);
  },[currentAction,triggerAction]);

  // ── 水やりキャンセル
  const cancelWater=useCallback(()=>{
    if(waterTimer.current)clearInterval(waterTimer.current);
    setWaterProgress(0); setWateringId(null);
    setWaterDropPos(null);
    if(currentAction===ACTION.WATERING)triggerAction(ACTION.IDLE,100);
  },[currentAction,triggerAction]);

  // ══ グローバルドラッグ追跡
  useEffect(()=>{
    const onMove=e=>{
      const pt=e.touches?e.touches[0]:e;
      if(_dragState){
        setDragState(d=>d?{...d,x:pt.clientX,y:pt.clientY}:null);
        // ドラッグオーバー検出
        const el=document.elementFromPoint(pt.clientX,pt.clientY);
        let found=null;
        Object.entries(cellRefs.current).forEach(([id,ref])=>{ if(ref&&ref.contains(el))found=Number(id); });
        setDragOverId(found);
      }
    };
    const onEnd=e=>{
      if(!_dragState){setDragState(null);return;}
      const pt=e.changedTouches?e.changedTouches[0]:e;
      const el=document.elementFromPoint(pt.clientX,pt.clientY);
      let targetCellId=null;
      Object.entries(cellRefs.current).forEach(([id,ref])=>{ if(ref&&ref.contains(el))targetCellId=Number(id); });
      if(targetCellId!=null) handleDrop(_dragState,targetCellId,pt.clientX,pt.clientY);
      _dragState=null; setDragState(null); setDragOverId(null);
    };
    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("pointerup",onEnd);
    window.addEventListener("touchmove",onMove,{passive:true});
    window.addEventListener("touchend",onEnd);
    return()=>{
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onEnd);
      window.removeEventListener("touchmove",onMove);
      window.removeEventListener("touchend",onEnd);
    };
  },[cells]);

  const handleDrop=useCallback((drag,targetId,cx,cy)=>{
    const cell=cells.find(c=>c.id===targetId); if(!cell)return;
    if(drag.type==="seed"&&cell.state===S.TILLED){
      // 種まき完了
      setCells(cs=>cs.map(c=>c.id===targetId?{...c,state:S.PLANTED,crop:drag.cropId}:c));
      setSeedPicker(null);
      triggerAction(ACTION.PLANTING,1200);
      showToast(`🌰 ${CROPS.find(c=>c.id===drag.cropId)?.label}をまいた！ みずやりしてね 💧`);
    } else if(drag.type==="manure"&&[S.GROWING,S.TYPHOON_DANGER].includes(cell.state)){
      if((useSafariStore.getState().inventory["poop"]??0)<1){showToast("💩 フンが足りない！");return;}
      consumeInventory("poop",1);
      setCells(cs=>cs.map(c=>{
        if(c.id!==targetId)return c;
        const crop=CROPS.find(cr=>cr.id===c.crop); if(!crop||!c.readyAt)return c;
        const rem=Math.max(0,new Date(c.readyAt)-Date.now());
        const newQ=Math.min(3,(c.quality||1)+1);
        return{...c,readyAt:new Date(Date.now()+rem/2).toISOString(),yieldMult:(c.yieldMult||1)*2,fertilized:true,quality:newQ};
      }));
      addFly("💩",cx,cy);
      addPop(cx,cy,[{emoji:"💩",qty:-1,color:"#fbbf24"},{emoji:"✨",qty:0,big:true,color:"#4ade80"}]);
      showToast("💩✨ 肥料投入！ 品質アップ＆成長×2！");
    }
  },[cells,triggerAction,consumeInventory]);

  // ══ セルアクション
  const handleAction=useCallback((type,cell,e)=>{
          if(type==="swipe_plant"){
        // SeedReadyCell からのスワイプ完了コールバック
        setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:S.PLANTED}:c));
        triggerAction(ACTION.PLANTING,1200);
        showToast(`🌰 ${CROPS.find(c=>c.id===cell.crop)?.label}をまいた！ 長押し2秒で みずやりしてね 💧`);
        return;
      }

      if(type==="down"){
      const rect=e.currentTarget.getBoundingClientRect();
      const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;

      if(cell.state===S.WEED){
        if(isTired()){showToast(`😴 いまは つかれているよ。${fmtCD(new Date(cooldownEnd)-Date.now())}あとで！`,3000);return;}
        e.currentTarget.setPointerCapture(e.pointerId);
        holdStart.current=Date.now(); setHoldingId(cell.id); setHoldProgress(0);
        triggerAction(ACTION.PULLING,0);
        holdTimer.current=setInterval(()=>{
          const prog=Math.min(1,(Date.now()-holdStart.current)/WEED_HOLD_MS);
          setHoldProgress(prog);
          if(prog>=1){
            clearInterval(holdTimer.current);
            setHoldingId(null); setHoldProgress(0);
            // 草刈り副産物
            const drops=[{emoji:"🌿",qty:1,color:"#4ade80"}];
            addToInventory("grass",1);
            if(Math.random()<0.3){addToInventory("thread",1);drops.push({emoji:"🧵",qty:1,color:"#f9a8d4"});}
            if(Math.random()<0.25){addToInventory("wood",1);drops.push({emoji:"🪵",qty:1,color:"#d97706"});}
            addPop(cx,cy,drops); drops.forEach(d=>addFly(d.emoji,cx,cy));
            setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:S.HARD_SOIL,tillProgress:0}:c));
            doWork(); triggerAction(ACTION.IDLE,300);
            showToast("✨ スポーン！ 雑草を抜いた！");
          }
        },50);
        return;
      }

      if(cell.state===S.NEEDS_WATER){
        e.currentTarget.setPointerCapture(e.pointerId);
        waterStart.current=Date.now(); setWateringId(cell.id); setWaterProgress(0);
        setWaterDropPos({x:cx,y:cy-40});
        triggerAction(ACTION.WATERING,0);
        waterTimer.current=setInterval(()=>{
          const prog=Math.min(1,(Date.now()-waterStart.current)/WATER_HOLD_MS);
          setWaterProgress(prog);
          if(prog>=1){
            clearInterval(waterTimer.current);
            setWateringId(null); setWaterProgress(0); setWaterDropPos(null);
            const q=calcQ(true,cell.fertilized,false);
            setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:S.GROWING,...startGrow(c),watered:true,quality:q}:c));
            triggerAction(ACTION.IDLE,300);
            showToast(`💧 みずやり完了！ ひんしつ ${Q_META[q].stars}`);
          }
        },50);
        return;
      }
    }

    if(type==="up"){
      if(cell.state===S.WEED&&holdingId===cell.id){
        if(holdProgress>0&&holdProgress<1)showToast("💨 ビターン！ もっとちからをいれて！");
        cancelWeedHold(); return;
      }
      if(cell.state===S.NEEDS_WATER&&wateringId===cell.id){
        if(waterProgress>0&&waterProgress<1)showToast("💧 やり直し！ ながおし2秒キープ！");
        cancelWater(); return;
      }
      // タップ系
      handleTap(cell,e);
    }

    if(type==="leave"){
      if(cell.state===S.WEED&&holdingId===cell.id){if(holdProgress>0&&holdProgress<1)showToast("💨 ビターン！ 指がはなれた！"); cancelWeedHold();}
      if(cell.state===S.NEEDS_WATER&&wateringId===cell.id){if(waterProgress>0&&waterProgress<1)showToast("💧 やり直し！"); cancelWater();}
    }
  },[holdingId,holdProgress,wateringId,waterProgress,cooldownEnd,doWork,triggerAction,startGrow,cancelWeedHold,cancelWater,cells]);

  const handleTap=useCallback((cell,e)=>{
    const rect=e.currentTarget?.getBoundingClientRect?.()??{left:0,top:0,width:60,height:60};
    const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;

    if(cell.state===S.HARD_SOIL){
      if(isTired()){showToast(`😴 いまは つかれているよ。${fmtCD(new Date(cooldownEnd)-Date.now())}あとで！`,3000);return;}
      const next=cell.tillProgress+1;
      setShaking(cell.id); setTimeout(()=>setShaking(s=>s===cell.id?null:s),400);
      triggerAction(ACTION.TILLING,0); setTillBounce(true); setTimeout(()=>setTillBounce(false),300);
      setTimeout(()=>triggerAction(ACTION.IDLE,500),350);
      if(next>=TILL_STEPS){
        setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:S.TILLED,tillProgress:0}:c));
        // 土中の素材
        const drops=[];
        if(Math.random()<0.2){drops.push({emoji:"🪨",qty:1,color:"#9ca3af"});addToInventory("stone",1);}
        if(Math.random()<0.15){drops.push({emoji:"🔩",qty:1,color:"#94a3b8"});addToInventory("iron",1);}
        if(drops.length>0){addPop(cx,cy,drops);drops.forEach(d=>addFly(d.emoji,cx,cy));showToast("💎 はっけん！ 土の中に素材が！");}
        else showToast("✅ ふかふか！ 畝の完成！");
        doWork();
      } else {
        setCells(cs=>cs.map(c=>c.id===cell.id?{...c,tillProgress:next}:c));
        showToast(`⛏️ ザクッ！ あと${TILL_STEPS-next}かい！`);
      }

    } else if(cell.state===S.TILLED){
      setSeedPicker(cell.id);

    } else if(cell.state===S.SEED_READY){
      // タップはヒントのみ（スワイプで植える）
      showToast("👇 したへ スワイプで 種をまこう！");

    } else if(cell.state===S.PLANTED){
      // タップ時はヒント
      showToast("💧 ながおし2秒で みずやり！ ジョウロをイメージして！");

    } else if(cell.state===S.NEEDS_WATER){
      showToast("💧 ながおしで お水をあげよう！ 指を離さないで！");

    } else if(cell.state===S.GROWING){
      // 詳細ポップアップ
      const crop=CROPS.find(cr=>cr.id===cell.crop); if(!crop)return;
      const q=Q_META[cell.quality||1];
      const rem=humanTime(cell.readyAt);
      showToast(`${crop.icon} ${crop.label} ${q.stars} | ${rem}${cell.fertilized?" 💩速成中":""}`,3500);

    } else if(cell.state===S.TYPHOON_DANGER){
      if((useSafariStore.getState().inventory["wood"]??0)<1){showToast("🪵 きのえだが足りない！");return;}
      consumeInventory("wood",1);
      const newQ=Math.min(3,(cell.quality||1)+1);
      setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:S.GROWING,quality:newQ}:c));
      addPop(cx,cy,[{emoji:"🔨",qty:0,big:true,color:"#fbbf24"},{emoji:"✅",qty:0,big:true,color:"#4ade80"}]);
      showToast("🔨 ぼうふうネットをはった！まもったよ！");

    } else if(cell.state===S.READY){
      const crop=CROPS.find(cr=>cr.id===cell.crop); if(!crop)return;
      const q=cell.quality||1;
      const qty=crop.yieldBase*(cell.yieldMult||1)*(q===3?3:q===2?2:1);
      const grassDrop=Math.random()<0.6?1:0;
      const qm=Q_META[q];
      const popItems=[{emoji:crop.icon,qty,color:qm.color,big:true},...(grassDrop?[{emoji:"🌿",qty:1,color:"#4ade80"}]:[]),{emoji:qm.stars,qty:0,color:qm.color}];
      addPop(cx,cy,popItems); addFly(crop.icon,cx,cy);
      triggerAction(ACTION.HARVESTING,1500);
      addToInventory(crop.id,qty);
      if(grassDrop>0) addToInventory("grass",grassDrop);
      setCells(cs=>cs.map(c=>c.id===cell.id?{...c,state:Math.random()<0.35?S.WEED:S.HARD_SOIL,crop:null,plantedAt:null,readyAt:null,yieldMult:1,tillProgress:0,quality:1,watered:false,fertilized:false}:c));
      if(q===3)showToast("🌈 ごくじょう！ さいこうのしゅうかく！！",3000);
      else if(q===2)showToast("⭐ りょうしつ！ いいできだよ！");
      else showToast("🌾 しゅうかくした！");
    }
  },[cooldownEnd,doWork,triggerAction,addToInventory,consumeInventory,startGrow]);

  // 種タップ選択 → SEED_READY に遷移（モーダルを閉じる）
  const handleSeedPick = useCallback((cropId) => {
    setCells(cs => cs.map(c => c.id===seedPicker ? {...c, state:S.SEED_READY, crop:cropId} : c));
    setSeedPicker(null);
    showToast("👇 種の袋を したへ スワイプしてまこう！");
  }, [seedPicker]);

  // swipe_plant アクション（SeedReadyCell からコールバック）
  useEffect(() => {
    // handleAction 内で "swipe_plant" を受け取る
  }, []);

  // インベントリ💩ドラッグ開始
  const handleManureDragStart=useCallback(e=>{
    if((useSafariStore.getState().inventory["poop"]??0)<1)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    _dragState={type:"manure",x:e.clientX,y:e.clientY};
    setDragState({type:"manure",x:e.clientX,y:e.clientY});
  },[]);

  const INV_ITEMS=[
    {k:"coins",e:"🪙"},{k:"poop",e:"💩"},{k:"grass",e:"🌿"},{k:"iron",e:"🔩"},
    {k:"wood",e:"🪵"},{k:"stone",e:"🪨"},{k:"thread",e:"🧵"},
    {k:"wheat",e:"🌾"},{k:"carrot",e:"🥕"},{k:"potato",e:"🥔"},
    {k:"tomato",e:"🍅"},{k:"corn",e:"🌽"},{k:"cotton",e:"🌸"},
  ];
  const tired=isTired();

  return (
    <div style={{maxWidth:480,margin:"0 auto",fontFamily:"'Hiragino Maru Gothic ProN','rounded mplus 1c',sans-serif",minHeight:"100vh",background:weather===WEATHER.TYPHOON?"linear-gradient(170deg,#2d1a5a,#4a1a78 25%,#8a5a90 60%,#6a3860)":weather===WEATHER.RAINY?"linear-gradient(170deg,#1a3a5a,#2a5a8a 25%,#6a8ab0 60%,#4a6a8a)":"linear-gradient(170deg,#2d5a1e,#3a7a28 25%,#c8a06a 60%,#a07830)",display:"flex",flexDirection:"column",transition:"background 2s"}}>

      {/* ヘッダー */}
      <div style={{flexShrink:0,position:"sticky",top:0,zIndex:40,background:"linear-gradient(180deg,#1a3d12,#234f18)",borderBottom:"4px solid #112a0c",boxShadow:"0 4px 14px rgba(0,0,0,0.45)",padding:"10px 12px 8px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:28,filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.5))"}}>🌾</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:15,color:"#ffe98a",textShadow:"0 2px 4px rgba(0,0,0,0.5)",letterSpacing:1}}>お手伝いサファリ</div>
            <div style={{fontSize:10,color:"#a8d88a",fontWeight:700,letterSpacing:2}}>農場（ファーム）</div>
          </div>
          <button onClick={()=>{if(confirm("リセット？")){localStorage.removeItem(LS_KEY);setCells(initCells());setWorkCount(0);setCooldownEnd(null);setCurrentAction(ACTION.IDLE);setWeather(WEATHER.SUNNY);setNextWeatherChange(Date.now()+WEATHER_CHANGE_MS);}}} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"4px 8px",color:"rgba(255,220,150,0.7)",fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>🔄</button>
        </div>
        <div ref={invBarRef} style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2}}>
          {INV_ITEMS.map(it=>{
            const cnt = it.k==="coins" ? coins : (inventory[it.k]??0);
            return (
            <div key={it.k}
              onPointerDown={it.k==="poop"&&cnt>0?handleManureDragStart:undefined}
              style={{flexShrink:0,background:it.k==="poop"&&cnt>0?"rgba(180,130,20,0.45)":"rgba(0,0,0,0.32)",
                border:it.k==="poop"&&dragState?.type==="manure"?"2px solid #fbbf24":"1px solid rgba(255,255,255,0.15)",
                borderRadius:10,padding:"3px 6px",textAlign:"center",minWidth:38,
                cursor:it.k==="poop"&&cnt>0?"grab":"default",
                touchAction:it.k==="poop"?"none":"auto",
                transition:"border 0.2s",userSelect:"none"}}>
              <div style={{fontSize:14,lineHeight:1.2}}>{it.e}</div>
              <div style={{fontSize:10,fontWeight:900,color:"#ffe98a"}}>{cnt}</div>
            </div>
            );
          })}
        </div>
      </div>

      <WeatherBar weather={weather} nextChange={nextWeatherChange} />

      {/* アバター帯 */}
      <div style={{flexShrink:0,background:tired?"linear-gradient(135deg,#2e1065,#3b0764)":"linear-gradient(135deg,#14532d,#166534)",borderBottom:"3px solid rgba(0,0,0,0.3)",padding:"10px 16px",display:"flex",alignItems:"center",gap:12,transition:"background 0.6s"}}>
        <FarmAvatar action={currentAction} holdProgress={Math.max(holdProgress,waterProgress)} tillBounce={tillBounce} />
        <div style={{flex:1}}>
          {tired?(
            <>
              <div style={{fontWeight:900,fontSize:13,color:"#e9d5ff",marginBottom:4}}>💦 きゅうけい中…</div>
              <div style={{fontSize:11,color:"#c4b5fd",marginBottom:6}}>あと <b style={{color:"#fde68a"}}>{fmtCD(cooldownMs)}</b> したら！</div>
              <div style={{height:7,background:"rgba(255,255,255,0.15)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#a78bfa,#7c3aed)",width:`${Math.max(0,(1-cooldownMs/COOLDOWN_MS))*100}%`,transition:"width 0.5s"}} />
              </div>
            </>
          ):(
            <>
              <div style={{fontSize:11,color:"rgba(255,230,150,0.8)",fontWeight:700,marginBottom:5}}>⚡ スタミナ</div>
              <div style={{display:"flex",gap:5,alignItems:"center"}}>
                {Array.from({length:FATIGUE_LIMIT},(_,i)=>(
                  <div key={i} style={{width:20,height:20,borderRadius:"50%",background:i<workCount?"rgba(255,255,255,0.1)":"#4ade80",border:i<workCount?"2px solid rgba(255,255,255,0.15)":"2px solid #16a34a",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:i<workCount?"none":"0 0 6px #4ade8088",transition:"all 0.3s"}}>{i<workCount?"":"❤️"}</div>
                ))}
                <span style={{fontSize:10,color:"rgba(255,230,150,0.65)",marginLeft:4,fontWeight:700}}>{workCount}/{FATIGUE_LIMIT}</span>
              </div>
            </>
          )}
        </div>
        {/* ジェスチャーヒント */}
        <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textAlign:"right",lineHeight:1.6}}>
          🌿長押し=草刈<br/>💧長押し=水やり<br/>🌰ドラッグ=種まき<br/>💩ドラッグ=肥料
        </div>
      </div>

      {/* 品質ガイド */}
      <div style={{background:"rgba(0,0,0,0.2)",padding:"4px 14px",display:"flex",gap:10,justifyContent:"center",alignItems:"center"}}>
        {[1,2,3].map(q=>{const qm=Q_META[q];return(<div key={q} style={{fontSize:10,fontWeight:900,color:qm.color,textShadow:`0 0 6px ${qm.color}`,display:"flex",alignItems:"center",gap:3}}><span>{qm.stars}</span><span style={{color:"rgba(255,255,255,0.6)"}}>{qm.label}</span></div>);})}
        <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginLeft:4}}>💧+💩+🍀=★★★</span>
      </div>

      {/* 本体グリッド */}
      <div style={{flex:1,padding:"10px 10px 20px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{textAlign:"center"}}>
          <span style={{display:"inline-block",background:"linear-gradient(180deg,#d4a96a,#9a6830)",border:"3px solid #6a4010",borderRadius:10,padding:"4px 18px",fontSize:12,fontWeight:900,color:"#fef3c7",boxShadow:"0 3px 0 #4a2c08,0 4px 10px rgba(0,0,0,0.35)",letterSpacing:2,textShadow:"0 1px 3px rgba(0,0,0,0.4)"}}>🌿 わたしの にわ 🌿</span>
        </div>
        <div ref={gridRef} style={{borderRadius:20,background:"linear-gradient(160deg,#7a4e28,#5a3210 50%,#6a4220)",border:`5px solid ${weather===WEATHER.TYPHOON?"#7c3aed":"#3e2008"}`,boxShadow:"0 6px 0 #2e1800,0 8px 28px rgba(0,0,0,0.5)",padding:10,filter:tired?"brightness(0.72) saturate(0.5)":"none",transition:"filter 0.5s,border 0.5s",pointerEvents:tired?"none":"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {cells.map(cell=>(
              <div key={cell.id} ref={el=>cellRefs.current[cell.id]=el}>
                <Cell cell={cell} now={now}
                  onAction={handleAction}
                  holdingId={holdingId} holdProgress={holdProgress}
                  wateringId={wateringId} waterProgress={waterProgress}
                  shaking={shaking} dragOverId={dragOverId} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 種選択モーダル */}
      {seedPicker!==null&&<SeedPicker onPick={handleSeedPick} onClose={()=>setSeedPicker(null)} />}

      {/* ドラッグカーソル */}
      <DragCursor dragState={dragState} />

      {/* 水滴演出 */}
      {waterDropPos&&<WaterDrops x={waterDropPos.x} y={waterDropPos.y} />}

      {/* パーティクル */}
      {pops.map(p=><NumPop key={p.id} x={p.x} y={p.y} items={p.items} onDone={()=>setPops(ps=>ps.filter(x=>x.id!==p.id))} />)}
      {flyParticles.map(f=><FlyParticle key={f.id} emoji={f.emoji} fromX={f.fromX} fromY={f.fromY} toX={f.toX} toY={f.toY} onDone={()=>setFlyParticles(p=>p.filter(x=>x.id!==f.id))} />)}

      {toast&&<div style={{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:80,padding:"9px 20px",borderRadius:24,background:"linear-gradient(135deg,#065f46,#047857)",border:"3px solid #064e3b",color:"#d1fae5",fontWeight:900,fontSize:13,boxShadow:"0 4px 16px rgba(0,0,0,0.45)",whiteSpace:"nowrap",fontFamily:"'Hiragino Maru Gothic ProN',sans-serif",maxWidth:"90vw",textAlign:"center"}}>{toast}</div>}

      <style>{`
        @keyframes avatarBreath{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-4px) scale(1.03);}}
        @keyframes avatarPullShake{0%,100%{transform:translate(0,0) rotate(-5deg);}25%{transform:translate(-3px,2px) rotate(4deg);}50%{transform:translate(2px,-2px) rotate(-7deg);}75%{transform:translate(-2px,3px) rotate(5deg);}}
        @keyframes avatarTillBounce{0%{transform:translateY(0) scaleY(1);}30%{transform:translateY(-14px) scaleY(1.1);}70%{transform:translateY(4px) scaleY(0.9);}100%{transform:translateY(0) scaleY(1);}}
        @keyframes avatarFloat{0%{transform:translateY(0);}40%{transform:translateY(-10px);}100%{transform:translateY(0);}}
        @keyframes avatarJump{0%{transform:translateY(0) scale(1);}35%{transform:translateY(-16px) scale(1.15);}70%{transform:translateY(3px) scale(0.92);}100%{transform:translateY(0) scale(1);}}
        @keyframes avatarExhausted{0%,100%{transform:rotate(-6deg) translateY(0);}50%{transform:rotate(6deg) translateY(3px);}}
        @keyframes avatarWater{0%,100%{transform:rotate(-8deg) translateY(0);}50%{transform:rotate(8deg) translateY(-3px);}}
        @keyframes wateringCan{0%,100%{transform:rotate(0deg);}50%{transform:rotate(-20deg) translateY(3px);}}
        @keyframes zzzFloat{0%{opacity:0;transform:translate(-50%,-10px) scale(0.8);}30%{opacity:1;}100%{opacity:0;transform:translate(-50%,-50px) scale(1.2);}}
        @keyframes sweatDrop{0%{opacity:1;transform:translateY(0);}100%{opacity:0;transform:translateY(18px);}}
        @keyframes popUp{0%{opacity:1;transform:translateY(0) scale(1.3);}60%{opacity:1;transform:translateY(-48px) scale(1);}100%{opacity:0;transform:translateY(-75px) scale(.8);}}
        @keyframes flyToInv{0%{opacity:1;transform:translate(0,0) scale(1.2);}70%{opacity:0.9;transform:translate(calc(var(--dx)*0.7),calc(var(--dy)*0.7)) scale(0.8);}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0.3);}}
        @keyframes waterFall{0%{opacity:0;transform:translateY(-10px);}20%{opacity:1;}100%{opacity:0;transform:translateY(40px);}}
        @keyframes seedFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
        @keyframes arrowBounce{0%,100%{transform:translateY(0);}50%{transform:translateY(4px);}}
        @keyframes buryAnim{0%{transform:translateY(0) scale(1);opacity:1;}100%{transform:translateY(20px) scale(0.4);opacity:0;}}
        @keyframes dragPulse{0%,100%{opacity:0.6;transform:scale(0.95);}50%{opacity:1;transform:scale(1.05);}}
        @keyframes weedBob{0%,100%{transform:scale(1) rotate(-6deg);}50%{transform:scale(1.1) rotate(6deg) translateY(-3px);}}
        @keyframes weedShake{0%,100%{transform:translate(0,0) rotate(-8deg);}25%{transform:translate(-3px,2px) rotate(6deg);}50%{transform:translate(3px,-2px) rotate(-10deg);}75%{transform:translate(-2px,3px) rotate(8deg);}}
        @keyframes cellShake{0%,100%{transform:translate(0,0);}20%{transform:translate(-4px,2px);}40%{transform:translate(4px,-2px);}60%{transform:translate(-3px,3px);}80%{transform:translate(3px,-1px);}}
        @keyframes typhoonCell{0%,100%{transform:translate(-2px,-1px) rotate(-1deg);}50%{transform:translate(3px,2px) rotate(2deg);}}
        @keyframes typhoonCrop{0%,100%{transform:rotate(-12deg) scale(1);}50%{transform:rotate(12deg) scale(1.1) translateY(-4px);}}
        @keyframes typhoonSpin{from{transform:rotate(0);}to{transform:rotate(360deg);}}
        @keyframes rainBob{0%,100%{transform:translateY(0);}50%{transform:translateY(4px);}}
        @keyframes growSway{0%,100%{transform:rotate(-4deg) scale(1);}50%{transform:rotate(4deg) scale(1.05) translateY(-2px);}}
        @keyframes readyBounce{from{transform:scale(1) translateY(0);}to{transform:scale(1.14) translateY(-5px);}}
        @keyframes cellGlow{0%,100%{box-shadow:0 0 0 3px #ffe066,0 3px 8px rgba(0,0,0,.45);}50%{box-shadow:0 0 0 5px #ffd700,0 3px 14px rgba(255,200,0,.45);}}
        @keyframes rainbowBg{0%{background:rgba(255,0,0,0.3);}33%{background:rgba(0,255,0,0.3);}66%{background:rgba(0,0,255,0.3);}100%{background:rgba(255,0,0,0.3);}}
        @keyframes spin{from{transform:rotate(0);}to{transform:rotate(360deg);}}
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        ::-webkit-scrollbar{width:0;height:0;}
      `}</style>
    </div>
  );
}
