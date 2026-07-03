import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fronti AI Admin',
  description: 'Panel administrativo para empresas que usan Fronti AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
