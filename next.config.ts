import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 型安全ゲート：本番ビルドでも型エラーを検出する（2026-05 に ignoreBuildErrors を撤廃）。
  // 速い検査は `npm run typecheck`（tsc --noEmit）を使う。
  // 注意: Next.js 16 の code-frame は日本語混じりソースの型エラー整形で Rust panic する
  //   既知バグがある。型エラーが出た場合は `npm run typecheck` の方が読みやすい
  //   （tsc は自前で整形するため panic しない）。コードベースは型グリーンを維持すること。
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    serverActions: {
      // Next.js は Server Action リクエストの Origin と Host を突き合わせて
      // 一致しない場合は CSRF として弾く。Cloudflare Tunnel 経由だと
      // Origin=外部ドメイン / Host=コンテナ側 になって不一致になるため、
      // ここで「このドメインからの Server Action は信用してよい」と宣言する。
      // localhost はプロトコル (http/https) を含めて許可。
      allowedOrigins: [
        "chore-safari.negoyou.com",
        "negoyou.com",
        "*.negoyou.com",
        "chore-safari.negoyou.com:443",
        "localhost:3000",
        "127.0.0.1:3000",
        "http://localhost:3000",
        "https://localhost:3000",
        "http://127.0.0.1:3000",
        "https://127.0.0.1:3000",
      ],
    },
  },
};

export default nextConfig;
