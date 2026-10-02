import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { BasketView } from "@/components/BasketView";

export const metadata: Metadata = { title: "Basket" };

export default async function BasketPage(props: PageProps<"/b/[address]">) {
  const { address } = await props.params;
  if (!isAddress(address)) notFound();
  return <BasketView address={getAddress(address)} />;
}
