import { Navigation } from './navigation';
import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-6 w-6 bg-[#00b14e] rounded"></div>
            <span className="font-bold text-xl">GrabInsight AI</span>
          </Link>
          <Navigation />
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Vendor:</span>
            <span className="ml-1 font-semibold text-[#00b14e]">7 Eleven Mumbai</span>
          </div>
        </div>
      </div>
    </header>
  );
}