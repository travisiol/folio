import Image from "next/image";
import Link from "next/link";
import { FACTORY_ADDRESS, explorer } from "@/config/network";
import { site } from "@/config/site";
import { ConnectButton } from "./wallet/ConnectButton";

export function Logo({ size = 34 }: { size?: number }) {
  return <Image src="/logo-128.png" alt="" width={size} height={size} className="rounded-[9px]" preload />;
}

const NAV = [
  { href: "/#console", label: "Build" },
  { href: "/baskets", label: "Baskets" },
  { href: "/#how", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header className="wrap flex h-[76px] items-center justify-between gap-3 lg:h-[88px]">
      <Link href="/" className="flex items-center gap-3 font-display text-[22px] font-black tracking-tight">
        <Logo />
        {site.name}
      </Link>
      <nav className="hidden items-center gap-2 md:flex" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="pill">
            {n.label}
          </Link>
        ))}
      </nav>
      <ConnectButton />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="wrap mt-24 flex flex-col gap-4 border-t border-stroke py-10 text-[15px] text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 font-display text-lg font-black text-ink">
        <Logo size={26} />
        {site.name}
        <span className="font-sans text-[15px] font-normal text-muted">· {site.hook}</span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/baskets" className="hover:text-ink">
          Baskets
        </Link>
        <Link href="/#faq" className="hover:text-ink">
          FAQ
        </Link>
        {FACTORY_ADDRESS ? (
          <a href={explorer.address(FACTORY_ADDRESS)} target="_blank" rel="noreferrer" className="hover:text-ink">
            Factory contract
          </a>
        ) : null}
      </div>
    </footer>
  );
}
