import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com", // For the stock images
      },
      {
        protocol: "https",
        hostname: "doorbsmpxbsgansndlvn.supabase.co", // <--- YOUR SUPABASE URL
      },
    ],
  },
};

export default nextConfig;