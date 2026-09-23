import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import 'katex/dist/katex.min.css';
import './globals.css';
import './markdown.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex', display: 'swap' });

export const metadata: Metadata = {
  title: 'Markd — study notes, clearly',
  description: 'A calm markdown reader for study notes.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('markd:theme:v1');document.documentElement.dataset.theme=t==='paper'||t==='night'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'night':'paper')}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'night':'paper'}" }} /></head><body className={`${inter.variable} ${fraunces.variable} ${plex.variable}`}>{children}</body></html>;
}
