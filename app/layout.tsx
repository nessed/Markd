import type { Metadata, Viewport } from 'next';
import { Caveat, Cormorant_Garamond, Fraunces, IBM_Plex_Mono, Inter, Lora } from 'next/font/google';
import PaperDoodle from '@/components/notebook/PaperDoodle';
import { PREFS_BOOTSTRAP } from '@/lib/prefs';
import 'katex/dist/katex.min.css';
import './globals.css';
import './markdown.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-fraunces', display: 'swap' });
const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-hand', display: 'swap' });
// Only drawn when picked in Page settings (and in the monogram), so not preloaded.
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap', preload: false });
const lora = Lora({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-lora', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'Markd',
  description: 'A quiet markdown reader for study notes. A companion to Akada.',
  applicationName: 'Markd',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${plex.variable} ${caveat.variable} ${cormorant.variable} ${lora.variable}`}
    >
      <head>
        <meta name="theme-color" content="#F5F1E8" />
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOTSTRAP }} />
      </head>
      <body>
        {children}
        <PaperDoodle />
      </body>
    </html>
  );
}
