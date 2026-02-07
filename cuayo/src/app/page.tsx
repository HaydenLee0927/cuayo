// app/page.tsx
import Link from "next/link";

function QuickCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
    >
      <div className="text-sm font-bold text-neutral-900">{title}</div>
      <div className="mt-1 text-xs text-neutral-500">{desc}</div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="w-full max-w-6xl rounded-3xl border-2 border-[var(--visa-navy)] bg-white p-8">
      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 md:col-span-8">
          <h1 className="text-2xl font-black text-neutral-900">Welcome back 👋</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Navigate using the navy top bar. Pages use a white background with a matching navy border.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/rankings"
              className="rounded-2xl bg-[var(--visa-navy)] px-5 py-3 text-sm font-bold text-white hover:opacity-95"
            >
              Go to Rankings
            </Link>
            <Link
              href="/profile"
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-900 hover:bg-neutral-50"
            >
              Open Profile
            </Link>
          </div>
        </section>

        <aside className="col-span-12 md:col-span-4">
          <div className="text-sm font-bold text-neutral-900">Quick actions</div>
          <div className="mt-4 space-y-3">
            <QuickCard title="Rankings" desc="Distribution + leaderboard" href="/rankings" />
            <QuickCard title="Advices" desc="Personalized tips" href="/advices" />
            <QuickCard title="History" desc="Recent activity" href="/history" />
          </div>
        </aside>
      </div>
    </div>
  );
}
