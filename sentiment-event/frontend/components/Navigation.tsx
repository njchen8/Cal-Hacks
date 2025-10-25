"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/about", label: "About" },
  { href: "/analyze", label: "Analyze" },
] as const;

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand">
          Bluberri
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
