"use client";

import { useRef } from "react";
import { useUser } from "../lib/UserProvider";


type Card = {
  id: string;
  bankName: string;
  cardName: string;
  last4: string;
  brand: "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER";
  theme: "black" | "blue" | "purple" | "green";
};

export default function ProfilePage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { user, setUser } = useUser();

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUser({
        ...user,
        profileImage: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  function toggleAnonymous() {
    setUser({ ...user, anonymousMode: !user.anonymousMode });
  }

  function toggleNotifications() {
    setUser({ ...user, notificationsEnabled: !user.notificationsEnabled });
  }

  function updateNickname(value: string) {
    setUser({ ...user, nickname: value });
  }

  function disconnectCard(id: string) {
    setUser({
      ...user,
      cards: user.cards.filter((c) => c.id !== id),
    });
  }

  function connectDemoCard() {
    const newCard: Card = {
      id: `c${Date.now()}`,
      bankName: "Demo Bank",
      cardName: "Rewards Card",
      last4: String(Math.floor(1000 + Math.random() * 9000)),
      brand: "VISA",
      theme: "blue",
    };

    setUser({
      ...user,
      cards: [newCard, ...user.cards],
    });
  }

  return (
    <div className="w-full max-w-4xl rounded-3xl border-2 border-[var(--visa-navy)] bg-white p-10">
      {/* Header */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative"
          aria-label="Upload profile photo"
        >
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-white text-4xl">
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
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
            <span className="text-xs font-semibold text-white">Upload</span>
          </div>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onUpload}
        />

        <div className="mt-6 text-center">
          <div className="text-2xl font-black text-neutral-900">
            {user.name} <span className="text-neutral-500">{user.tag}</span>
          </div>
          <div className="mt-1 text-sm text-neutral-600">
            Birthday: {user.birthday}
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="mx-auto mt-10 max-w-2xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ToggleCard
            title="Anonymous mode"
            description="Hide your identity in leaderboards."
            enabled={user.anonymousMode}
            onToggle={toggleAnonymous}
          />
          <ToggleCard
            title="Notifications"
            description="Receive weekly summaries and milestones."
            enabled={user.notificationsEnabled}
            onToggle={toggleNotifications}
          />
        </div>
      </div>

      {/* Nickname */}
      <div className="mx-auto mt-8 max-w-md">
        <div className="mb-1 text-xs font-semibold text-neutral-600">
          Nickname
        </div>
        <input
          value={user.nickname}
          onChange={(e) => updateNickname(e.target.value)}
          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm"
        />
        <div className="mt-2 text-xs text-neutral-500">
          {user.anonymousMode
            ? "Anonymous mode is ON. Your nickname will be hidden."
            : "Anonymous mode is OFF. Your nickname may appear."}
        </div>
      </div>

      {/* Connected cards */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-neutral-900">
            Connected Cards
          </div>
          <button
            onClick={connectDemoCard}
            className="rounded-full bg-[var(--visa-navy)] px-4 py-2 text-xs font-semibold text-white hover:opacity-95"
          >
            + Connect new card
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {user.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onDisconnect={disconnectCard}
            />
          ))}
        </div>

        {user.cards.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            No cards connected yet.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function ToggleCard({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-neutral-900">{title}</div>
          <div className="mt-1 text-xs text-neutral-500">{description}</div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={`relative h-7 w-12 rounded-full border transition ${
            enabled
              ? "border-[var(--visa-navy)] bg-[var(--visa-navy)]/20"
              : "border-neutral-300 bg-neutral-100"
          }`}
          aria-pressed={enabled}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition ${
              enabled
                ? "left-[26px] bg-[var(--visa-navy)]"
                : "left-[3px] bg-neutral-500"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function CardTile({
  card,
  onDisconnect,
}: {
  card: Card;
  onDisconnect: (id: string) => void;
}) {
  return (
    <div className="group relative">
      <div className="relative overflow-hidden rounded-3xl border border-neutral-300 bg-gradient-to-br from-neutral-700 via-neutral-900 to-[var(--visa-navy)] p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold">{card.bankName}</div>
            <div className="mt-1 text-sm font-black">{card.cardName}</div>
          </div>
          <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">
            {card.brand}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="h-10 w-14 rounded-lg bg-white/20" />
          <div className="text-sm font-semibold tracking-widest">
            •••• {card.last4}
          </div>
        </div>
      </div>

      <button
        onClick={() => onDisconnect(card.id)}
        className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
      >
        Disconnect
      </button>
    </div>
  );
}
