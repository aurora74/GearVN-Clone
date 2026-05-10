/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
          protocol: 'https',
          hostname: 'res.cloudinary.com',
          pathname: '**'
      },
      {
          protocol: 'https',
          hostname: 'lh3.googleusercontent.com',
          pathname: '**'
      },
      {
        protocol: 'https',
        hostname: 'cdn2.cellphones.com.vn',
        pathname: '**',
      },
    ]
  },
};

export default nextConfig;
