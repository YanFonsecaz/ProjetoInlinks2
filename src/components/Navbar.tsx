"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  TrendingUp, 
  Users, 
  Sparkles, 
  Home, 
  BookOpen, 
  Settings 
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Link Building", icon: Home },
    { href: "/trends-master", label: "Google Trends", icon: TrendingUp },
    { href: "/social-agent", label: "Social Agent", icon: Sparkles },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-2 bg-[#fff5f2] rounded-lg group-hover:scale-105 transition-transform">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 60 60"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="2"
                    y="2"
                    width="56"
                    height="56"
                    stroke="#ff5f29"
                    strokeWidth="4"
                    fill="none"
                  />
                  <text
                    x="30"
                    y="42"
                    fontFamily="Arial, sans-serif"
                    fontWeight="bold"
                    fontSize="28"
                    fill="#ff5f29"
                    textAnchor="middle"
                  >
                    NP
                  </text>
                </svg>
              </div>
              <div className="hidden md:block">
                <span className="text-lg font-bold text-slate-900">
                  digital
                </span>
                <p className="text-[10px] text-slate-500">
                  AI Agent Suite
                </p>
              </div>
            </Link>

            {/* Nav Links */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#fff5f2] text-[#ff5f29]"
                        : "text-slate-500 hover:text-[#ff5f29] hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-xl transition-colors text-slate-500 hover:text-[#ff5f29] hover:bg-slate-50">
              <BookOpen className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-orange-100 text-[#ff5f29]">
              AI
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
