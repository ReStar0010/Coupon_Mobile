/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || 'https://coupro.onrender.com';
    const base = backendUrl.replace(/\/$/, '');
    return [
      {
        source: '/collection/:path*',
        destination: `${base}/collection/:path*`,
      },
      {
        source: '/c/:path*',
        destination: `${base}/c/:path*`,
      },
      {
        source: '/.well-known/apple-app-site-association',
        destination: `${base}/.well-known/apple-app-site-association`,
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: `${base}/.well-known/assetlinks.json`,
      },
    ];
  },
};

export default nextConfig;
