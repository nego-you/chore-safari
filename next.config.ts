import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本番ビルド時の型チェック / lint を Next.js のビルダーで走らせない。
  // dev サーバ側で常時チェックされているし、Next.js 16 のコードフレーム整形が
  // 日本語混じりのソースで Rust panic（next-code-frame の UTF-8 境界バグ）を
  // 起こす既知症状を避けるためにも、ここではビルドだけを通す。
  // 型エラー自体は VS Code / dev サーバで別途検出する運用にする。
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverActions: {
      // Next.js は Server Action リクエストの Origin と Host を突き合わせて
      // 一致しない場合は CSRF として弾く。Cloudflare Tunnel 経由だと
      // Origin=外部ドメイン / Host=コンテナ側 になって不一致になるため、
      // ここで「このドメインからの Server Action は信用してよい」と宣言する。
      // 念のため apex / wildcard / ポート付き / 暗黙的なローカルもまとめて許可。
      allowedOrigins: [
        "chore-safari.negoyou.com",
        "negoyou.com",
        "*.negoyou.com",
        "chore-safari.negoyou.com:443",
        "localhost:3000",
        "127.0.0.1:3000",
      ],
    },
  },
};

export default nextConfig;
