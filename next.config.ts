import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf2json'],
  },
};

export default nextConfig;
