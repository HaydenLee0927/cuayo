"use client";

import { createContext, useContext, useEffect, useState } from "react";
import rawUser from "../profile/user.json";

export type Card = {
  id: string;
  bankName: string;
  cardName: string;
  last4: string;
  brand: "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER";
  theme: "black" | "blue" | "purple" | "green";
};

export type User = {
  id: string;
  name: string;
  tag: string;
  birthday: string;
  nickname: string;
  anonymousMode: boolean;
  notificationsEnabled: boolean;
  profileImage: string | null;
  cards: Card[];
};

type UserContextType = {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
};

const UserContext = createContext<UserContextType | null>(null);

const STORAGE_KEY = "cuayo-user";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(rawUser as User);

  // 🔹 load once (client)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setUser(JSON.parse(saved));
    }
  }, []);

  // 🔹 persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within UserProvider");
  }
  return ctx;
}
