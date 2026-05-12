import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js は Server Action リクエストの Origin と Host を突き合わせて
      // 一致しない場合は CSRF として弾く。Cloudflare Tunnel 経由だと
      // Origin=外部ドメイン / Host=コンテナ側 になって不一致になるため、
      // ここで「このドメインからの Server Action は信用してよい」と宣言する。
      allowedOrigins: [
        "chore-safari.negoyou.com",
        // 将来別サブドメインを足したくなった場合に備えて wildcard も入れておく
        "*.negoyou.com",
      ],
    },
  },
};

export default nextConfig;
