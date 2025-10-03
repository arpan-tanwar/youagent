import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'YouAgent',
  description: 'Local-first personal AI agent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

