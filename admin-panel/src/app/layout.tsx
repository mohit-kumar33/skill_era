import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Skill Era Admin',
  description: 'Admin Panel for Skill Era Tournament Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
