import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: { default: 'AI Sensei · Reference shelf', template: '%s · AI Sensei' }, description: 'Private Japanese source-aware reference shelf', robots: { index: false, follow: false } };
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><a className="skip" href="#content">Skip to content</a>
    <header className="site-header"><Link href="/" className="brand"><span lang="ja">日本語</span><span>AI Sensei<small>PRIVATE REFERENCE SHELF</small></span></Link>
      <nav aria-label="Main">{['Vocabulary','Kanji','Grammar','Sources'].map(t => <Link key={t} href={`/${t.toLowerCase()}`}>{t}</Link>)}</nav>
    </header><main id="content" tabIndex={-1}>{children}</main>
    <footer>Local reference library · Imported content does not introduce items or schedule reviews.</footer>
  </body></html>;
}
