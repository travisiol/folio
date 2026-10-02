import type { Metadata } from "next";
import { BasketList } from "@/components/BasketList";

export const metadata: Metadata = { title: "Baskets" };

export default function BasketsPage() {
  return (
    <div className="wrap pb-10 pt-6">
      <h1 className="display text-[clamp(44px,6vw,80px)]">Baskets</h1>
      <p className="mt-3 max-w-2xl text-[19px] text-ink-2">Every basket created on FOLIO, newest first. Open one to see its vault, mint it or redeem it.</p>
      <div className="mt-8">
        <BasketList />
      </div>
    </div>
  );
}
