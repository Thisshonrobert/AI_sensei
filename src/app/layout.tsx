import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: { default: 'AI Sensei · Daily study', template: '%s · AI Sensei' }, description: 'Private source-aware Japanese N2 study', robots: { index: false, follow: false } };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><a className="skip" href="#content">Skip to content</a>
    <header className="site-header"><Link href="/" className="brand"><span lang="ja">日本語</span><span>AI Sensei<small>PRIVATE N2 STUDY</small></span></Link>
      <nav aria-label="Main"><Link href="/review">Daily recall</Link>{['Vocabulary','Kanji','Grammar','Sources'].map(t => <Link key={t} href={`/${t.toLowerCase()}`}>{t}</Link>)}</nav>
    </header><main id="content" tabIndex={-1}>{children}</main>
    <footer>Private Japanese study · JLPT N2</footer>
  </body></html>;
}
