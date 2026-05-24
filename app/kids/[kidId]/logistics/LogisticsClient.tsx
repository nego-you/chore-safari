"use client";
// ★ Zustand 統合:
//   BEFORE: InventoryContext（ローカル useState）でインベントリを管理していた
//   AFTER : useSafariStore の inventory・logisticsQueue を直接使う
//
//   主な変更点:
//   - InventoryContext / InventoryProvider を削除
//   - useContext(InventoryContext) の呼び出しを useSafariStore に置き換え
//   - FarmPanel のデモ収穫が addToInventory を呼ぶようになり、
//     農場・物流センターのインベントリが自動同期される
//   - PickingScreen 上部に "物流待機キュー"（logisticsQueue の動物）を表示
//   - LogisticsApp の export 末尾の <InventoryProvider> ラッパーを削除

import { useState, useRef } from "react";
import { useSafariStore } from "@/store/useSafariStore";

// ★ DELETED: InventoryContext / InventoryProvider（ローカル state）は完全削除済み
// function InventoryProvider({ children }) { ... }

// ============================================================
// ITEM MASTER
// ============================================================
const ITEMS = {
  carrot: {id:"carrot", label:"ニンジン",   icon:"🥕",color:"#fb923c",stars:1,shape:[[1],[1],[1]],              cat:"food"},
  apple:  {id:"apple",  label:"リンゴ",     icon:"🍎",color:"#ef4444",stars:1,shape:[[1,1],[1,0]],              cat:"food"},
  banana: {id:"banana", label:"バナナ",     icon:"🍌",color:"#eab308",stars:1,shape:[[1,1,1]],                  cat:"food"},
  meat:   {id:"meat",   label:"生肉",       icon:"🥩",color:"#dc2626",stars:2,shape:[[1,1],[1,1]],              cat:"food"},
  fish:   {id:"fish",   label:"鮮魚",       icon:"🐟",color:"#3b82f6",stars:2,shape:[[1,0],[1,1],[0,1]],        cat:"food"},
  grain:  {id:"grain",  label:"穀物",       icon:"🌾",color:"#ca8a04",stars:2,shape:[[1,1,1],[0,1,0]],          cat:"food"},
  veggie3:{id:"veggie3",label:"高品質野菜", icon:"🥬",color:"#16a34a",stars:3,shape:[[1,1,1],[1,0,0],[1,0,0]], cat:"food"},
  fruit3: {id:"fruit3", label:"高品質果実", icon:"🍇",color:"#7c3aed",stars:3,shape:[[0,1,1],[1,1,0],[0,1,0]], cat:"food"},
  stone:  {id:"stone",  label:"いし",       icon:"🪨",color:"#6b7280",stars:1,shape:[[1]],                      cat:"material"},
  wood:   {id:"wood",   label:"きのいた",   icon:"🪵",color:"#92400e",stars:1,shape:[[1,1]],                    cat:"material"},
  rope:   {id:"rope",   label:"ロープ",     icon:"🪢",color:"#78716c",stars:1,shape:[[1],[1]],                   cat:"material"},
  herb:   {id:"herb",   label:"やくそう",   icon:"🌿",color:"#059669",stars:2,shape:[[1,1],[0,1]],               cat:"material"},
  crystal:{id:"crystal",label:"クリスタル", icon:"💎",color:"#0ea5e9",stars:3,shape:[[0,1],[1,1],[1,0]],         cat:"material"},
  poop:   {id:"poop",   label:"フン",       icon:"💩",color:"#a16207",stars:1,shape:[[1]],                       cat:"byproduct"},
  compost:{id:"compost",label:"たいひ",     icon:"🟤",color:"#92400e",stars:1,shape:[[1,1]],                     cat:"byproduct"},
};

// ============================================================
// ORDER GENERATOR
// ============================================================
const TMPL = [
  {id:"zoo",    icon:"🐘",label:"動物園",       cat:"food",    mult:[1.8,2.5],grids:[[4,4],[5,5]],dl:[2,4]},
  {id:"market", icon:"🏪",label:"街の市場",     cat:"any",     mult:[0.8,1.2],grids:[[3,3],[4,4]],dl:[0,0]},
  {id:"guild",  icon:"🏰",label:"クエストギルド",cat:"material",mult:[1.3,1.8],grids:[[4,4],[5,4]],dl:[3,6]},
  {id:"special",icon:"⭐",label:"特別依頼",     cat:"stars3",  mult:[2.5,4.0],grids:[[3,3],[4,3]],dl:[1,2]},
  {id:"farm2",  icon:"🌾",label:"となりの農場", cat:"food",    mult:[1.0,1.5],grids:[[3,4],[4,4]],dl:[1,3]},
  {id:"ranch",  icon:"🐄",label:"牧場",         cat:"any",     mult:[1.2,1.6],grids:[[4,3],[5,4]],dl:[2,5]},
];
function genOrders(n=4){
  return [...TMPL].sort(()=>Math.random()-.5).slice(0,n).map(t=>{
    const m=+(t.mult[0]+Math.random()*(t.mult[1]-t.mult[0])).toFixed(1);
    const g=t.grids[Math.floor(Math.random()*t.grids.length)];
    const d=t.dl[0]===0?0:t.dl[0]+Math.floor(Math.random()*(t.dl[1]-t.dl[0]+1));
    return{...t,uid:Math.random().toString(36).slice(2),
      bonusMult:m,bonusLabel:"×"+m.toFixed(1),gridSize:g,
      deadline:d===0?"いつでも":d+"日後",
      reward:(pct)=>Math.round(pct*m*g[0]*g[1]*0.4)};
  });
}
const catName=(c)=>({food:"🍎食材",material:"🪵素材",stars3:"⭐★3のみ",byproduct:"💩副産物",any:"なんでも"})[c]||c;
const stars=(n)=>"★".repeat(n)+"☆".repeat(3-n);

// ============================================================
// GRID HELPERS
// ============================================================
const mkGrid=(c,r)=>Array(r).fill(null).map(()=>Array(c).fill(null));
function canPlace(g,item,r,c,rows,cols){
  for(let pr=0;pr<item.shape.length;pr++)
    for(let pc=0;pc<item.shape[pr].length;pc++){
      if(!item.shape[pr][pc])continue;
      const gr=r+pr,gc=c+pc;
      if(gr<0||gr>=rows||gc<0||gc>=cols||g[gr][gc])return false;
    }
  return true;
}
function doPlace(g,item,r,c){
  const n=g.map(row=>[...row]);
  for(let pr=0;pr<item.shape.length;pr++)
    for(let pc=0;pc<item.shape[pr].length;pc++)
      if(item.shape[pr][pc])n[r+pr][c+pc]={color:item.color,icon:item.icon};
  return n;
}

// ============================================================
// STEP INDICATOR
// ============================================================
const STEPS = ["オーダー選択","荷積み","発送結果"];
function StepIndicator({current}){
  const idx = {order:0, pack:1, result:2}[current]??0;
  return(
    <div style={{display:"flex",alignItems:"center",gap:0,padding:"0 4px"}}>
      {STEPS.map((s,i)=>(
        <div key={s} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:0}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:22,height:22,borderRadius:11,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:800,transition:"all .25s",
              background:i<idx?"rgba(255,255,255,.9)":i===idx?"#fff":"rgba(255,255,255,.3)",
              color:i<idx?"#7c3aed":i===idx?"#7c3aed":"rgba(255,255,255,.6)",
              boxShadow:i===idx?"0 2px 8px rgba(0,0,0,.2)":"none"}}>
              {i<idx?"✓":i+1}
            </div>
            <div style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap",
              color:i===idx?"#fff":"rgba(255,255,255,.5)",transition:"all .25s"}}>
              {s}
            </div>
          </div>
          {i<STEPS.length-1&&(
            <div style={{flex:1,height:2,borderRadius:1,margin:"0 4px",marginBottom:14,
              background:i<idx?"rgba(255,255,255,.8)":"rgba(255,255,255,.25)",transition:"all .3s"}}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// STEP 1 — ORDER SELECT
// ============================================================
function OrderSelect({orders,onSelect,onReroll}){
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",marginBottom:14,gap:8}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:17,color:"#111827"}}>📋 きょうの オーダー</div>
          <div style={{fontSize:11,color:"#9ca3af"}}>どこに 荷物を 送る？</div>
        </div>
        <button onClick={onReroll} style={{padding:"7px 12px",borderRadius:14,border:"2px solid #e5e7eb",
          background:"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:"#6b7280",
          display:"flex",alignItems:"center",gap:5}}>🎲 再抽選</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {orders.map(o=>(
          <button key={o.uid} onClick={()=>onSelect(o)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",
              borderRadius:20,border:"2.5px solid #e5e7eb",background:"#fff",
              cursor:"pointer",textAlign:"left",transition:"all .18s",
              boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <div style={{width:52,height:52,borderRadius:16,
              background:"linear-gradient(135deg,#f5f3ff,#ddd6fe)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
              {o.icon}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontWeight:800,fontSize:14,color:"#111827"}}>{o.label}</span>
                <span style={{fontSize:9,fontWeight:700,color:"#7c3aed",background:"#f5f3ff",
                  borderRadius:8,padding:"2px 6px"}}>{catName(o.cat)}</span>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:800,color:"#16a34a"}}>💰 {o.bonusLabel}</span>
                <span style={{fontSize:11,color:"#9ca3af"}}>📅 {o.deadline}</span>
                <span style={{fontSize:11,color:"#9ca3af"}}>📐 {o.gridSize[0]}×{o.gridSize[1]}</span>
              </div>
            </div>
            <div style={{fontSize:18,color:"#a78bfa",flexShrink:0}}>›</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// STEP 2 — PICKING (inventory selection → queue)
// MAX 荷台マス数に応じて上限を計算
// ============================================================
// ★ PickingScreen の上部に「物流待機キュー」セクションを追加し、
//    BaseCamp から sendToLogistics で送られた動物を確認できるようにした。
function PickingScreen({order,onBack,onNext}){
  // ★ BEFORE: const {inv} = useContext(InventoryContext);
  // ★ AFTER : useSafariStore から直接取得
  const inv             = useSafariStore((s) => s.inventory);
  const logisticsQueue  = useSafariStore((s) => s.logisticsQueue);
  const [queue, setQueue] = useState([]);  // [{item,uid}]
  const [catFilter, setCatFilter] = useState("all");

  const [cols,rows] = order.gridSize;
  const maxSlots = cols * rows;
  const queueBlocks = queue.reduce((s,e)=>s+e.item.shape.flat().filter(Boolean).length,0);

  const visibleItems = Object.values(ITEMS).filter(item=>{
    const qty = (inv[item.id]??0) - queue.filter(e=>e.item.id===item.id).length;
    if(qty<=0) return false;
    if(catFilter==="food")     return item.cat==="food";
    if(catFilter==="material") return item.cat==="material";
    if(catFilter==="byproduct")return item.cat==="byproduct";
    if(catFilter==="stars3")   return item.stars===3;
    return true;
  });

  const addToQueue=(item)=>{
    const itemBlocks = item.shape.flat().filter(Boolean).length;
    if(queueBlocks+itemBlocks > maxSlots) return;
    setQueue(prev=>[...prev,{item,uid:Math.random().toString(36).slice(2)}]);
  };
  const removeFromQueue=(uid)=>setQueue(prev=>prev.filter(e=>e.uid!==uid));

  const CAT=[{id:"all",l:"すべて"},{id:"food",l:"🍎食材"},{id:"material",l:"🪵素材"},{id:"byproduct",l:"💩副産物"},{id:"stars3",l:"★3"}];

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button onClick={onBack} style={{background:"#f3f4f6",border:"none",borderRadius:12,
          padding:"6px 10px",cursor:"pointer",fontSize:13,color:"#374151",fontWeight:700}}>
          ← もどる
        </button>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:14,color:"#111827"}}>🏪 ピッキング</div>
          <div style={{fontSize:10,color:"#9ca3af"}}>{order.icon} {order.label}　{catName(order.cat)} を えらぼう</div>
        </div>
      </div>

      {/* ★ 物流待機キュー（BaseCamp から sendToLogistics で送られた動物） */}
      {logisticsQueue.length > 0 && (
        <div style={{background:"linear-gradient(135deg,#fff7ed,#fef3c7)",borderRadius:18,
          padding:"10px 12px",marginBottom:10,border:"2px solid #fde68a"}}>
          <div style={{fontWeight:800,fontSize:13,color:"#b45309",marginBottom:6}}>
            🚚 物流センター待機中 ({logisticsQueue.reduce((s,a)=>s+a.count,0)}ひき)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {logisticsQueue.map(a=>(
              <div key={a.id} style={{display:"flex",flexDirection:"column",alignItems:"center",
                padding:"6px 8px",borderRadius:12,border:"2px solid #fcd34d",
                background:"#fffbeb",minWidth:50,textAlign:"center"}}>
                <span style={{fontSize:22}}>{a.emoji}</span>
                <span style={{fontSize:9,fontWeight:700,color:"#374151",marginTop:1}}>{a.name}</span>
                <span style={{fontSize:8,color:"#d97706"}}>×{a.count}</span>
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:"#92400e",marginTop:6}}>
            ↑ 自分の家から送られた動物だよ。下のアイテムと一緒にトラックに積もう！
          </div>
        </div>
      )}

      {/* Queue display */}
      <div style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",borderRadius:18,padding:"10px 12px",
        marginBottom:10,border:"2px solid #ddd6fe",minHeight:72}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontWeight:800,fontSize:13,color:"#7c3aed"}}>
            🎒 もちもの ({queue.length}個 / {queueBlocks}/{maxSlots}マス)
          </div>
          {queue.length>0&&(
            <div style={{height:6,width:80,background:"#ddd6fe",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:4,background:"#7c3aed",
                width:Math.min(100,Math.round(queueBlocks/maxSlots*100))+"%",transition:"width .3s"}}/>
            </div>
          )}
        </div>
        {queue.length===0
          ?<div style={{textAlign:"center",color:"#a78bfa",fontSize:12,padding:"6px 0"}}>
             したの倉庫から アイテムをえらんでね
           </div>
          :<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {queue.map(e=>(
              <button key={e.uid} onClick={()=>removeFromQueue(e.uid)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",
                  padding:"7px 8px",borderRadius:13,border:"2px solid "+e.item.color,
                  background:"#fff",cursor:"pointer",position:"relative",minWidth:50}}>
                <span style={{fontSize:18}}>{e.item.icon}</span>
                <span style={{fontSize:8,fontWeight:700,color:"#374151",marginTop:1}}>{e.item.label}</span>
                {/* shape */}
                <div style={{display:"inline-grid",
                  gridTemplateColumns:"repeat("+e.item.shape[0].length+",8px)",gap:1,marginTop:2}}>
                  {e.item.shape.map((row,pr)=>row.map((cell,pc)=>(
                    <div key={pr+"-"+pc} style={{width:8,height:8,borderRadius:1.5,
                      background:cell?e.item.color:"transparent",
                      border:cell?"1px solid rgba(0,0,0,.1)":"none"}}/>
                  )))}
                </div>
                <div style={{position:"absolute",top:-6,right:-6,width:16,height:16,borderRadius:8,
                  background:"#ef4444",color:"#fff",fontSize:9,fontWeight:800,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>✕</div>
              </button>
            ))}
          </div>
        }
      </div>

      {/* Inventory */}
      <div style={{background:"rgba(255,255,255,.93)",borderRadius:18,padding:"10px 12px",
        marginBottom:10,border:"2px solid #e5e7eb"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#374151",marginBottom:7}}>🏪 共有倉庫</div>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:5,marginBottom:8}}>
          {CAT.map(t=>(
            <button key={t.id} onClick={()=>setCatFilter(t.id)}
              style={{flexShrink:0,padding:"3px 9px",borderRadius:20,border:"none",fontSize:10,
                fontWeight:700,cursor:"pointer",transition:"all .15s",
                background:catFilter===t.id?"#7c3aed":"#f3f4f6",
                color:catFilter===t.id?"#fff":"#6b7280"}}>
              {t.l}
            </button>
          ))}
        </div>
        {visibleItems.length===0
          ?<div style={{textAlign:"center",color:"#9ca3af",fontSize:12,padding:"8px 0"}}>アイテムなし</div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {visibleItems.map(item=>{
              const realQty=(inv[item.id]??0)-queue.filter(e=>e.item.id===item.id).length;
              const itemBlocks=item.shape.flat().filter(Boolean).length;
              const disabled=queueBlocks+itemBlocks>maxSlots||realQty<=0;
              return(
                <button key={item.id} onClick={()=>!disabled&&addToQueue(item)}
                  style={{padding:"9px 6px",borderRadius:14,
                    border:"2px solid "+(disabled?"#e5e7eb":item.color+"66"),
                    background:disabled?"#f9fafb":"#fff",
                    cursor:disabled?"not-allowed":"pointer",textAlign:"center",
                    opacity:disabled?.45:1,transition:"all .15s",
                    boxShadow:disabled?"none":"0 2px 8px "+item.color+"22"}}>
                  <div style={{fontSize:22}}>{item.icon}</div>
                  <div style={{fontSize:9,fontWeight:700,color:"#374151",marginTop:2}}>{item.label}</div>
                  {/* ★ 形状を常時表示（=ピッキング画面のみ） */}
                  <div style={{display:"inline-grid",marginTop:3,
                    gridTemplateColumns:"repeat("+item.shape[0].length+",10px)",gap:1.5}}>
                    {item.shape.map((row,pr)=>row.map((cell,pc)=>(
                      <div key={pr+"-"+pc} style={{width:10,height:10,borderRadius:2,
                        background:cell?item.color:"transparent",
                        border:cell?"1px solid rgba(0,0,0,.1)":"none"}}/>
                    )))}
                  </div>
                  <div style={{fontSize:8,color:"#f59e0b",marginTop:2}}>{stars(item.stars)}</div>
                  <div style={{fontSize:9,fontWeight:800,color:"#374151",marginTop:1}}>×{realQty}</div>
                  <div style={{fontSize:8,color:"#9ca3af"}}>{itemBlocks}マス</div>
                </button>
              );
            })}
          </div>
        }
      </div>

      <button onClick={()=>queue.length>0&&onNext(queue)} disabled={queue.length===0}
        style={{width:"100%",padding:"13px 0",borderRadius:18,border:"none",
          fontWeight:900,fontSize:15,color:"#fff",
          cursor:queue.length>0?"pointer":"not-allowed",
          background:queue.length>0?"linear-gradient(135deg,#7c3aed,#a78bfa)":"linear-gradient(135deg,#9ca3af,#6b7280)",
          boxShadow:queue.length>0?"0 4px 0 rgba(124,58,237,.3)":"none"}}>
        {queue.length===0?"アイテムをえらんでね":"📦 "+queue.length+"個で 荷積みへ →"}
      </button>
    </div>
  );
}

// ============================================================
// STEP 3 — PACKING (grid + drag ghost preview)
// ============================================================
function PackingScreen({order,queue,onBack,onShip}){
  // ★ BEFORE: const {consume} = useContext(InventoryContext);
  // ★ AFTER : useSafariStore の consumeInventory を使う
  const consumeInventory = useSafariStore((s) => s.consumeInventory);
  // 後方互換シム: PackingScreen 内の consume(id, qty) 呼び出しをそのまま使えるようにする
  const consume = (id: string, qty = 1) => consumeInventory(id, qty);
  const [cols,rows] = order.gridSize;
  const [grid,setGrid] = useState(()=>mkGrid(cols,rows));
  const [hand,setHand] = useState(()=>queue.map(e=>({...e}))); // [{item,uid}]
  const [selected,setSelected] = useState(null); // uid of selected piece
  const [hoverCell,setHoverCell] = useState(null);
  const [ghostCells,setGhostCells] = useState({cells:new Set(),valid:false});
  const [flash,setFlash] = useState(null);
  const ghostRef = useRef(null);
  const draggingUid = useRef(null);

  // consume on mount
  const consumed = useRef(false);
  if(!consumed.current){
    consumed.current=true;
    queue.forEach(e=>consume(e.item.id,1));
  }

  const filled=grid.flat().filter(Boolean).length;
  const total=cols*rows;
  const pct=Math.round((filled/total)*100);

  const calcGhost=(item,r,c)=>{
    const cells=new Set();
    const valid=canPlace(grid,item,r,c,rows,cols);
    for(let pr=0;pr<item.shape.length;pr++)
      for(let pc=0;pc<item.shape[pr].length;pc++)
        if(item.shape[pr][pc])cells.add((r+pr)+"-"+(c+pc));
    return{cells,valid};
  };

  const placeItem=(uid,r,c)=>{
    const entry=hand.find(e=>e.uid===uid);
    if(!entry)return;
    if(!canPlace(grid,entry.item,r,c,rows,cols)){
      setFlash(r+"-"+c); setTimeout(()=>setFlash(null),350); return;
    }
    setGrid(prev=>doPlace(prev,entry.item,r,c));
    setHand(prev=>prev.filter(e=>e.uid!==uid));
    setSelected(null); setHoverCell(null); setGhostCells({cells:new Set(),valid:false});
  };

  // ── PointerEvents D&D ──
  const handlePointerDown=(e,uid)=>{
    const entry=hand.find(h=>h.uid===uid);
    if(!entry)return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingUid.current=uid;
    setSelected(null);

    const item=entry.item;
    // shape 表示付きゴースト
    const shapeRows=item.shape.map(row=>
      '<div style="display:flex;gap:2px">'+
      row.map(cell=>'<div style="width:12px;height:12px;border-radius:3px;background:'+(cell?item.color+"cc":"transparent")+';border:'+(cell?"1px solid rgba(0,0,0,.15)":"none")+'"></div>').join("")+
      '</div>'
    ).join("");
    const ghost=document.createElement("div");
    ghost.style.cssText=[
      "position:fixed","zIndex:9999","pointerEvents:none",
      "background:rgba(255,255,255,.97)","border:2.5px solid "+item.color,
      "borderRadius:16px","padding:8px 12px",
      "boxShadow:0 10px 32px rgba(0,0,0,.28)",
      "transform:translate(-50%,-60%)",
      "display:flex","flexDirection:column","alignItems:center","gap:4px",
    ].join(";");
    ghost.innerHTML='<span style="font-size:26px">'+item.icon+'</span>'+
      '<div style="display:flex;flex-direction:column;gap:2px;align-items:center">'+shapeRows+'</div>'+
      '<span style="font-size:9px;font-weight:700;color:#374151">'+item.label+'</span>';
    ghost.style.left=e.clientX+"px";
    ghost.style.top=e.clientY+"px";
    document.body.appendChild(ghost);
    ghostRef.current=ghost;
  };

  const handlePointerMove=(e)=>{
    if(!ghostRef.current||!draggingUid.current)return;
    ghostRef.current.style.left=e.clientX+"px";
    ghostRef.current.style.top=e.clientY+"px";
    const el=document.elementFromPoint(e.clientX,e.clientY);
    if(el&&el.dataset.cell){
      const[r,c]=el.dataset.cell.split("-").map(Number);
      setHoverCell({r,c});
      const entry=hand.find(h=>h.uid===draggingUid.current);
      if(entry) setGhostCells(calcGhost(entry.item,r,c));
    } else {
      setHoverCell(null);
      setGhostCells({cells:new Set(),valid:false});
    }
  };

  const handlePointerUp=(e)=>{
    if(!draggingUid.current)return;
    const uid=draggingUid.current;
    draggingUid.current=null;
    if(ghostRef.current){ghostRef.current.remove();ghostRef.current=null;}
    const el=document.elementFromPoint(e.clientX,e.clientY);
    if(el&&el.dataset.cell){
      const[r,c]=el.dataset.cell.split("-").map(Number);
      placeItem(uid,r,c);
    }
    setHoverCell(null);
    setGhostCells({cells:new Set(),valid:false});
  };

  // タップ選択
  const handlePieceClick=(uid)=>setSelected(prev=>prev===uid?null:uid);
  const handleCellClick=(r,c)=>{
    if(!selected)return;
    placeItem(selected,r,c);
  };
  const handleCellEnter=(r,c)=>{
    if(!selected&&!draggingUid.current)return;
    setHoverCell({r,c});
    const uid=selected||draggingUid.current;
    const entry=hand.find(h=>h.uid===uid);
    if(entry) setGhostCells(calcGhost(entry.item,r,c));
  };

  const CELL=Math.min(46,Math.floor(225/cols));

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <button onClick={onBack} style={{background:"#f3f4f6",border:"none",borderRadius:12,
          padding:"6px 10px",cursor:"pointer",fontSize:13,color:"#374151",fontWeight:700}}>
          ← もどる
        </button>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:14,color:"#111827"}}>🚛 荷積み</div>
          <div style={{fontSize:10,color:"#9ca3af"}}>{order.icon} {order.label}　{cols}×{rows}グリッド</div>
        </div>
      </div>

      {/* ── HAND ── */}
      <div style={{background:"rgba(255,255,255,.93)",borderRadius:18,padding:"10px 12px",
        marginBottom:10,border:"2px solid #e5e7eb"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#374151",marginBottom:7}}>
          🎒 てもと ({hand.length}個残り)
          <span style={{fontSize:10,color:"#9ca3af",fontWeight:400,marginLeft:6}}>
            ドラッグ or タップして グリッドへ
          </span>
        </div>
        {hand.length===0
          ?<div style={{textAlign:"center",color:"#9ca3af",fontSize:12,padding:"6px 0"}}>すべて 積み込み済み！</div>
          :<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {hand.map(e=>{
              const isSel=selected===e.uid;
              return(
                <div key={e.uid}
                  onClick={()=>handlePieceClick(e.uid)}
                  onPointerDown={(ev)=>handlePointerDown(ev,e.uid)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{padding:"8px 10px",borderRadius:14,
                    border:"2.5px solid "+(isSel?e.item.color:"#e5e7eb"),
                    background:isSel?e.item.color+"18":"#fff",
                    cursor:"grab",userSelect:"none",touchAction:"none",
                    boxShadow:isSel?"0 3px 10px "+e.item.color+"44":"none",
                    transition:"all .18s",textAlign:"center"}}>
                  <div style={{fontSize:22}}>{e.item.icon}</div>
                  <div style={{fontSize:9,fontWeight:700,color:"#374151",marginTop:1}}>{e.item.label}</div>
                  <div style={{display:"inline-grid",marginTop:3,
                    gridTemplateColumns:"repeat("+e.item.shape[0].length+",11px)",gap:2}}>
                    {e.item.shape.map((row,pr)=>row.map((cell,pc)=>(
                      <div key={pr+"-"+pc} style={{width:11,height:11,borderRadius:2.5,
                        background:cell?e.item.color:"transparent",
                        border:cell?"1px solid rgba(0,0,0,.1)":"none",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:7}}>
                        {cell?e.item.icon:""}
                      </div>
                    )))}
                  </div>
                  {isSel&&<div style={{fontSize:8,color:e.item.color,fontWeight:700,marginTop:3}}>✓ えらびちゅう</div>}
                </div>
              );
            })}
          </div>
        }
      </div>

      {/* ── GRID ── */}
      <div style={{background:"rgba(255,255,255,.93)",borderRadius:18,padding:"10px 12px",
        marginBottom:10,border:"2px solid #e5e7eb"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontWeight:800,fontSize:13,color:"#374151"}}>荷台 ({cols}×{rows})</span>
          <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,color:"#fff",
            background:pct>=80?"#22c55e":pct>=50?"#f59e0b":"#ef4444"}}>
            積載率 {pct}%
          </span>
        </div>
        <div style={{height:7,background:"#f3f4f6",borderRadius:8,overflow:"hidden",marginBottom:10}}>
          <div style={{height:"100%",borderRadius:8,transition:"width .3s",width:pct+"%",
            background:pct>=80?"linear-gradient(90deg,#4ade80,#22c55e)":
              pct>=50?"linear-gradient(90deg,#fbbf24,#f59e0b)":"linear-gradient(90deg,#f87171,#ef4444)"}}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat("+cols+","+CELL+"px)",gap:3,
          background:"#f9fafb",border:"3px solid #e5e7eb",borderRadius:14,padding:6,
          boxShadow:"inset 0 2px 8px rgba(0,0,0,.04)"}}>
          {grid.map((row,r)=>row.map((cell,c)=>{
            const key=r+"-"+c;
            const isFlash=flash===key;
            const isPrev=ghostCells.cells.has(key);
            return(
              <div key={key} data-cell={key}
                onClick={()=>handleCellClick(r,c)}
                onMouseEnter={()=>handleCellEnter(r,c)}
                onMouseLeave={()=>{if(!draggingUid.current){setHoverCell(null);setGhostCells({cells:new Set(),valid:false});}}}
                style={{width:CELL,height:CELL,borderRadius:6,userSelect:"none",touchAction:"none",
                  background:cell?cell.color
                    :isFlash?"rgba(248,113,113,.5)"
                    :isPrev?(ghostCells.valid?"rgba(74,222,128,.45)":"rgba(248,113,113,.35)")
                    :selected?"rgba(167,139,250,.08)":"#fff",
                  border:"2px solid "+(cell?"rgba(0,0,0,.1)"
                    :isFlash?"#f87171"
                    :isPrev?(ghostCells.valid?"#4ade80":"#f87171")
                    :selected?"#a78bfa55":"#e5e7eb"),
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:CELL*.38,cursor:selected?"crosshair":"default",
                  transition:"background .08s,border .08s",
                  boxShadow:cell?"inset 0 -2px 0 rgba(0,0,0,.12)":"none"}}>
                {cell?cell.icon:""}
              </div>
            );
          }))}
        </div>

        {pct<50&&filled>0&&(
          <div style={{marginTop:8,background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:12,
            padding:"6px 10px",fontSize:11,fontWeight:700,color:"#dc2626"}}>
            ⚠️ 積載率が低すぎ！もっと つめよう。
          </div>
        )}
      </div>

      <button         onClick={()=>onShip(pct,grid)} disabled={filled===0}
        style={{width:"100%",padding:"14px 0",borderRadius:18,border:"none",
          fontWeight:900,fontSize:16,color:"#fff",transition:"all .2s",
          cursor:filled>0?"pointer":"not-allowed",
          background:filled===0?"linear-gradient(135deg,#9ca3af,#6b7280)":
            pct>=80?"linear-gradient(135deg,#4ade80,#22c55e)":
            pct>=50?"linear-gradient(135deg,#fbbf24,#f59e0b)":
                    "linear-gradient(135deg,#f87171,#ef4444)",
          boxShadow:filled>0?"0 4px 0 rgba(0,0,0,.15)":"none"}}>
        {filled===0?"アイテムを グリッドに おこう":
          pct>=80?"🚀 "+order.icon+" はっそう！（利益あり）":
          pct>=50?"😬 "+order.icon+" はっそう（ギリギリ）":
                  "💸 "+order.icon+" はっそう（赤字確定）"}
      </button>
    </div>
  );
}



// ============================================================
// RESULT HELPERS — 需要一致率・アドバイス判定
// ============================================================
function calcDemandMatch(placedItems, order) {
  // placedItems: [{item}] — グリッドに置かれた全セルのアイテム情報
  if (!placedItems || placedItems.length === 0) return 0;
  if (order.cat === "any") return 100; // なんでもOK
  const matched = placedItems.filter(cell => {
    const item = Object.values(ITEMS).find(i => i.icon === cell.icon);
    if (!item) return false;
    if (order.cat === "food")     return item.cat === "food";
    if (order.cat === "material") return item.cat === "material";
    if (order.cat === "stars3")   return item.stars === 3;
    if (order.cat === "byproduct")return item.cat === "byproduct";
    return false;
  });
  return Math.round((matched.length / placedItems.length) * 100);
}

function getAdvice(order, pct, demandPct, profit) {
  const catLabel = {
    food:"食材", material:"素材", stars3:"★3アイテム",
    byproduct:"副産物", any:"なんでも"
  }[order.cat] || order.cat;

  // パターン1: 需要不一致
  if (demandPct < 50) {
    const wrongExamples = Object.values(ITEMS)
      .filter(i => order.cat !== "any" && (
        (order.cat==="food" && i.cat!=="food") ||
        (order.cat==="material" && i.cat!=="material") ||
        (order.cat==="stars3" && i.stars!==3)
      )).slice(0,2).map(i=>i.icon+i.label).join("」「");
    return {
      type: "mismatch",
      icon: "😅",
      title: "おくるものが ちがう！",
      color: "#ef4444",
      bg: "linear-gradient(135deg,#fff1f2,#fee2e2)",
      border: "#fca5a5",
      text: order.label+"は「"+wrongExamples+"」は いらないよ！相手が ほしがっている【"+catLabel+"】を 送ってあげよう！",
    };
  }
  // パターン3: 大成功
  if (demandPct >= 80 && pct >= 80 && profit > 0) {
    return {
      type: "perfect",
      icon: "🏆",
      title: "だいせいこう！",
      color: "#16a34a",
      bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
      border: "#86efac",
      text: "大せいこう！相手も 大よろこびだし、利益も バッチリ！パズルの 天才だね！",
    };
  }
  // パターン2: 積載率不足
  if (demandPct >= 50 && pct < 60) {
    return {
      type: "loose",
      icon: "📭",
      title: "にだいが スカスカ！",
      color: "#d97706",
      bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
      border: "#fde68a",
      text: "送ったものは カンペキだけど、荷台が スカスカで 運送代の ムダづかいに なっちゃった。次は 小さいアイテムで スキマを うめよう！",
    };
  }
  // 普通（及第点）
  return {
    type: "ok",
    icon: "👍",
    title: "まあまあ！",
    color: "#7c3aed",
    bg: "linear-gradient(135deg,#f5f3ff,#ede9fe)",
    border: "#ddd6fe",
    text: "まずまずの はっそうだよ。もっと 荷台を うめて、正しいアイテムを 送ると もっと もうかるよ！",
  };
}

// ============================================================
// STEP 4 — RESULT
// ============================================================
function ResultScreen({order, pct, grid, onDone}){
  // グリッドから配置済みアイテムを収集
  const placedCells = grid.flat().filter(Boolean);
  const demandPct   = calcDemandMatch(placedCells, order);
  const coins       = order.reward(pct);
  const cost        = Math.round((1 - pct/100) * order.gridSize[0] * order.gridSize[1] * 3);
  const profit      = coins - cost;
  const advice      = getAdvice(order, pct, demandPct, profit);

  // スコアバー用ヘルパー
  const Bar = ({label, value, color, suffix="%"}) => (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{label}</span>
        <span style={{fontSize:13,fontWeight:900,color}}>{value}{suffix}</span>
      </div>
      <div style={{height:10,background:"#f3f4f6",borderRadius:8,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:8,transition:"width .6s ease",
          width:Math.min(100,value)+"%",background:color}}/>
      </div>
    </div>
  );

  return(
    <div style={{padding:"8px 0"}}>

      {/* ── アドバイスキャラクター ── */}
      <div style={{background:advice.bg, border:"2.5px solid "+advice.border,
        borderRadius:22, padding:"16px 18px", marginBottom:16, position:"relative"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:52,height:52,borderRadius:26,flexShrink:0,
            background:"linear-gradient(135deg,#fff,#f3f4f6)",
            border:"3px solid "+advice.border,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,
            boxShadow:"0 3px 10px rgba(0,0,0,.1)"}}>
            {advice.icon}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:15,color:advice.color,marginBottom:5}}>
              {advice.title}
            </div>
            <div style={{fontSize:12,color:"#374151",lineHeight:1.7,fontWeight:500}}>
              {advice.text}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3軸スコア ── */}
      <div style={{background:"rgba(255,255,255,.93)",borderRadius:18,padding:"14px 16px",
        marginBottom:14,border:"2px solid #e5e7eb"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#374151",marginBottom:12}}>
          📊 せいせきひょう
        </div>
        <Bar label="🎯 オーダー達成度（需要一致率）" value={demandPct}
          color={demandPct>=80?"#22c55e":demandPct>=50?"#f59e0b":"#ef4444"}/>
        <Bar label="📦 積載率（荷台のムダのなさ）" value={pct}
          color={pct>=80?"#3b82f6":pct>=50?"#8b5cf6":"#ef4444"}/>
        <Bar label="💰 黒字率（利益の出やすさ）"
          value={Math.max(0,Math.min(100,Math.round(profit/(coins||1)*100)))}
          color={profit>0?"#d97706":"#ef4444"}/>
      </div>

      {/* ── 4つの数値カード ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[
          ["🎯 オーダー達成度", demandPct+"%",
            demandPct>=80?"#16a34a":demandPct>=50?"#d97706":"#dc2626",
            demandPct>=80?"#f0fdf4":demandPct>=50?"#fffbeb":"#fff1f2",
            demandPct>=80?"#86efac":demandPct>=50?"#fde68a":"#fca5a5"],
          ["📦 積載率",          pct+"%",
            pct>=80?"#1d4ed8":pct>=50?"#7c3aed":"#dc2626",
            "#eff6ff","#bfdbfe"],
          ["💰 ほうしゅう",      "+"+coins+"コイン",
            "#d97706","#fffbeb","#fde68a"],
          ["📈 利益",            (profit>=0?"+":"")+profit+"コイン",
            profit>=0?"#16a34a":"#dc2626",
            profit>=0?"#f0fdf4":"#fff1f2",
            profit>=0?"#86efac":"#fca5a5"],
        ].map(([k,v,tc,bg,border])=>(
          <div key={k} style={{background:bg,borderRadius:14,padding:"12px 10px",
            border:"2px solid "+border,textAlign:"center"}}>
            <div style={{fontSize:10,color:"#6b7280",marginBottom:3,fontWeight:600}}>{k}</div>
            <div style={{fontSize:17,fontWeight:900,color:tc}}>{v}</div>
          </div>
        ))}
      </div>

      <button onClick={onDone}
        style={{width:"100%",padding:"13px 0",borderRadius:16,border:"none",
          fontWeight:900,fontSize:15,color:"#fff",cursor:"pointer",
          background:"linear-gradient(135deg,#7c3aed,#a78bfa)",
          boxShadow:"0 4px 0 rgba(124,58,237,.3)"}}>
        📋 つぎの オーダーへ
      </button>
    </div>
  );
}

// ============================================================
// FARM DEMO
// ============================================================
function FarmPanel(){
  // ★ BEFORE: const {harvest, inv} = useContext(InventoryContext);
  // ★ AFTER : addToInventory / inventory を useSafariStore から取得
  //           → FarmPanel で収穫すると即座にグローバルインベントリに反映される
  const addToInventory = useSafariStore((s) => s.addToInventory);
  const inv            = useSafariStore((s) => s.inventory);
  // 後方互換シム
  const harvest = (id: string, qty: number) => addToInventory(id, qty);
  const items=[{id:"carrot",q:3},{id:"apple",q:2},{id:"grain",q:4},{id:"veggie3",q:1},{id:"wood",q:2},{id:"poop",q:3}];
  return(
    <div style={{background:"rgba(255,255,255,.88)",borderRadius:18,padding:12,
      border:"2px solid #bbf7d0",marginBottom:10}}>
      <div style={{fontWeight:800,fontSize:13,color:"#15803d",marginBottom:8}}>
        🌾 農場デモ <span style={{fontSize:10,color:"#9ca3af",fontWeight:400}}>→ 物流在庫に即反映</span>
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {items.map(h=>{
          const item=ITEMS[h.id];
          return(
            <button key={h.id} onClick={()=>harvest(h.id,h.q)}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 9px",borderRadius:12,
                border:"2px solid #bbf7d0",background:"#f0fdf4",cursor:"pointer",
                fontSize:12,fontWeight:700,color:"#15803d"}}>
              {item.icon} +{h.q}
              <span style={{fontSize:9,color:"#9ca3af"}}>({inv[h.id]??0})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
function LogisticsApp(){
  const [step,setStep] = useState("order");
  const [orders,setOrders] = useState(()=>genOrders(4));
  const [order,setOrder] = useState(null);
  const [pickedQueue,setPickedQueue] = useState([]);
  const [pct,setPct]       = useState(0);
  const [finalGrid,setFinalGrid] = useState([]);
  const [showFarm,setShowFarm] = useState(false);

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f0f9ff,#e0f2fe 40%,#dbeafe)",
      fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{maxWidth:480,margin:"0 auto",paddingBottom:32}}>

        <div style={{background:"linear-gradient(135deg,#3b82f6,#6366f1)",
          padding:"14px 16px 16px",marginBottom:14,boxShadow:"0 2px 16px rgba(59,130,246,.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:26}}>📦</span>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontWeight:900,fontSize:19}}>物流センター</div>
            </div>
          </div>
          <StepIndicator current={step}/>
        </div>

        <div style={{padding:"0 14px"}}>
          <button onClick={()=>setShowFarm(v=>!v)}
            style={{marginBottom:10,padding:"5px 12px",borderRadius:12,
              border:"2px solid #bbf7d0",background:showFarm?"#f0fdf4":"#fff",
              cursor:"pointer",fontSize:11,fontWeight:700,color:"#15803d"}}>
            🌾 農場との連動デモ {showFarm?"▲":"▼"}
          </button>
          {showFarm&&<FarmPanel/>}

          {step==="order"&&(
            <OrderSelect orders={orders}
              onSelect={o=>{setOrder(o);setStep("pick");}}
              onReroll={()=>setOrders(genOrders(4))}/>
          )}
          {step==="pick"&&order&&(
            <PickingScreen order={order}
              onBack={()=>setStep("order")}
              onNext={q=>{setPickedQueue(q);setStep("pack");}}/>
          )}
          {step==="pack"&&order&&(
            <PackingScreen order={order} queue={pickedQueue}
              onBack={()=>setStep("pick")}
              onShip={(p,g)=>{setPct(p);setFinalGrid(g);setStep("result");}}/>
          )}
          {step==="result"&&order&&(
            <ResultScreen order={order} pct={pct} grid={finalGrid}
              onDone={()=>{setOrders(genOrders(4));setOrder(null);setPickedQueue([]);setStep("order");}}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ★ InventoryProvider を削除。ストアは Zustand の useSafariStore で一元管理される。
export default function LogisticsClient(){
  return <LogisticsApp/>;
}
