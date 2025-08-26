// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // troque pela URL pública do SEU FastAPI no Render:
        destination: 'https://SEU_BACKEND_RENDER.onrender.com/:path*',
      },
    ];
  },
};

export default nextConfig;
