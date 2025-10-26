"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

const links = [
  { href: "/", label: "Overview" },
  { href: "/about", label: "About" },
  { href: "/analyze", label: "Analyze" },
  { href: "/docs", label: "Docs" },
] as const;

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">
          <Image src="/logo.png" alt="blueberri logo" width={48} height={48} style={{ marginRight: '0.5rem' }} />
          blueberri
        </Link>
        <nav className="nav-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
