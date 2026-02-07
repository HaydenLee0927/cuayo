"use client";

import Link from "next/link";
import { useUser } from "../lib/UserProvider";

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-10 py-2.5 text-lg font-semibold text-white/90 hover:bg-white/20 transition"
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-[var(--visa-navy)]">
      <div className="mx-auto flex max-w-7xl items-center px-12 py-2 relative">
        <Link href="/" className="relative flex items-center gap-4">
          <div className="h-10 w-10" />
          <img
            src="/logo/cuayo-logo.png"
            alt="Cuayo logo"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10"
          />
          <span className="text-xl font-black tracking-tight text-white">
            cuayo
          </span>
        </Link>

        <nav className="mx-auto flex items-center gap-12">
          <NavTab href="/rankings" label="Rankings" />
          <NavTab href="/analytics" label="Analytics" />
          <NavTab href="/history" label="History" />
        </nav>

        <Link
          href="/profile"
          className="flex items-center gap-4 rounded-full bg-white/15 px-5 py-2 hover:bg-white/25 transition"
        >
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>

          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-lg font-semibold text-white">
              {user.nickname}
            </span>

            {/* 선택: 익명 모드임을 UI에 ‘표시만’ 하고 싶다면 유지 */}
            {user.anonymousMode && (
              <span className="text-xs text-white/70">Anonymous mode</span>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
