# backend/main.py
# VOICEVOX TTS ブリッジ。
# Next.js（web コンテナ）からテキストを受け取り、同一 Docker ネットワーク内の
# VOICEVOX エンジンで音声合成して WAV バイナリをそのまま返す。
#
#   POST /synthesize  { "text": "..." }  → audio/wav
#   GET  /health                         → { "ok": true }

import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="VOICEVOX TTS Bridge")

# Docker コンテナ間通信は同一 compose ネットワーク内のサービス名で解決する。
# docker-compose.yml の environment で上書き可能。
VOICEVOX_URL = os.getenv("VOICEVOX_URL", "http://voicevox_engine:50021")

# ずんだもん ノーマル = スピーカーID 3
SPEAKER_ID = int(os.getenv("VOICEVOX_SPEAKER_ID", "3"))

# CORS: Next.js の開発サーバー (3000) と本番 (3001) からのアクセスを許可。
# プロキシ経由のサーバーサイド呼び出しなら CORS は不要だが念のため設定。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://web:3000", "http://web-prod:3000"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class SynthesizeRequest(BaseModel):
    text: str


@app.get("/health")
async def health():
    return {"ok": True, "voicevox_url": VOICEVOX_URL, "speaker_id": SPEAKER_ID}


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """
    テキストを受け取り VOICEVOX で音声合成して WAV を返す。
    Step 1: POST /audio_query?text=...&speaker=3  → AudioQuery JSON
    Step 2: POST /synthesis?speaker=3  body=AudioQuery JSON  → WAV binary
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text は空にできません")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Step 1: audio_query ──────────────────────────────────
        try:
            query_res = await client.post(
                f"{VOICEVOX_URL}/audio_query",
                params={"text": text, "speaker": SPEAKER_ID},
            )
        except httpx.ConnectError as e:
            raise HTTPException(
                status_code=503,
                detail=f"VOICEVOX エンジンに接続できません: {e}",
            )

        if query_res.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"audio_query 失敗: status={query_res.status_code} body={query_res.text[:200]}",
            )

        audio_query = query_res.json()

        # ── Step 2: synthesis ────────────────────────────────────
        synth_res = await client.post(
            f"{VOICEVOX_URL}/synthesis",
            params={"speaker": SPEAKER_ID},
            json=audio_query,
            headers={"Content-Type": "application/json"},
        )

        if synth_res.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"synthesis 失敗: status={synth_res.status_code} body={synth_res.text[:200]}",
            )

        return Response(
            content=synth_res.content,
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )
