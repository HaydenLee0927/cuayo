// app/layout.tsx
import "./globals.css";
import Navbar from "./components/Navbar";
import { UserProvider } from "./lib/UserProvider";

export const metadata = {
  title: "cuayo",
  description: "Clean fintech UI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning
      className="min-h-screen text-neutral-900 bg-neutral-100">
        <UserProvider>
          <Navbar />

          <main className="relative flex justify-center px-6 py-16 overflow-hidden">
            {/* ✅ single-color LIGHT navy glass */}
            <div
              className="
                pointer-events-none
                absolute inset-0
                bg-[rgba(40,60,160,0.22)]
                backdrop-blur-[32px]
                backdrop-saturate-150
              "
            />

            <div
              className="
                pointer-events-none
                absolute inset-0
                bg-white/8
              "
            />

            {/* content */}
            <div className="relative z-10 w-full flex justify-center">
              {children}
            </div>
          </main>
        </UserProvider>
      </body>
    </html>
  );
}
