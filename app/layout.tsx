import type { Metadata, Viewport } from "next";
import { Montserrat, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800", "900"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "Accredia",
  description: "Sistema de acreditación oficial",
  icons: {
    icon: "/VSimg/VSLogo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body
        className={`${montserrat.variable} ${barlowCondensed.variable} antialiased font-sans`}
        style={{ fontFamily: 'var(--font-barlow-condensed), sans-serif' }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
