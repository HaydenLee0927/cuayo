"use client";

import Link from "next/link";
import { useUser } from "../lib/UserProvider";

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="
        rounded-full
        px-10 py-2.5
        text-lg font-semibold
        text-white/90
        hover:bg-white/20
        transition
      "
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-[var(--visa-navy)]">
      {/* ✅ height fixed: py-4 유지 */}
      <div className="mx-auto flex max-w-7xl items-center px-12 py-2 relative">
        {/* Logo: normal clickable area, but image is oversized via absolute overlay */}
        <Link href="/" className="relative flex items-center gap-4">
          {/* spacer so layout doesn't shift */}
          <div className="h-10 w-10" />

          {/* 🔥 oversized logo without changing navbar height */}
          <img
            src="/logo/cuayo-logo.png"
            alt="Cuayo logo"
            className="
              absolute left-0 top-1/2
              -translate-y-1/2
              h-10 w-10
            "
          />

          <span className="text-xl font-black tracking-tight text-white">
            cuayo
          </span>
        </Link>

        {/* Center navigation (spread out more) */}
        <nav className="mx-auto flex items-center gap-12">
          <NavTab href="/rankings" label="Rankings" />
          <NavTab href="/advices" label="Advices" />
          <NavTab href="/history" label="History" />
        </nav>

        {/* Profile */}
        <Link
          href="/profile"
          className="
            flex items-center gap-4
            rounded-full
            bg-white/15
            px-5 py-2
            hover:bg-white/25
            transition
          "
        >
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/20 text-lg">
            {user.anonymousMode ? (
              <img
                src="/logo/cuayo-logo.png"
                alt="Anonymous"
                className="h-full w-full object-cover"
              />
            ) : user.profileImage ? (
              <img
                src={user.profileImage}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              "👤"
            )}
          </div>

          <span className="hidden sm:block text-lg font-semibold text-white">
            {user.anonymousMode ? "Anonymous" : user.nickname}
          </span>
        </Link>
      </div>
    </header>
  );
}
