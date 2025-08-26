// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // troque pela URL pública do SEU FastAPI no Render:
        destination: 'https://portal-paciente-backend.onrender.com',
      },
    ];
  },
};

export default nextConfig;
