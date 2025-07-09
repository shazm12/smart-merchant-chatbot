'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const routes = [
  {
    href: '/',
    label: 'Home',
  }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex space-x-6">
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-[#00b14e]',
            pathname === route.href
              ? 'text-[#00b14e]'
              : 'text-muted-foreground'
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
}