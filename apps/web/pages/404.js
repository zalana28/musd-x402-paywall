import Link from "next/link";
import { NET } from "../lib/net";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-5">
      <div className="orb animate-orb left-[10%] top-[10%] h-[320px] w-[320px] bg-mezo-orange/20" />
      <div className="orb animate-orb-slow right-[8%] bottom-[5%] h-[300px] w-[300px] bg-mezo-ember/15" />
      <div className="relative text-center">
        <p className="font-display text-[7rem] font-bold leading-none grad-text sm:text-[10rem]">
          402
        </p>
        <p className="mt-2 font-display text-xl font-semibold text-white">
          Payment required — even this page.
        </p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">
          Just kidding, this one is free. The page you wanted doesn&apos;t exist,
          but the metered API does — and every call there settles in{" "}
          {NET.network === "eip155:31612" ? "MUSD" : "MUSD or BTC"} on Mezo.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">← Back home</Link>
          <Link href="/playground" className="btn-ghost">Run a paying agent</Link>
        </div>
      </div>
    </div>
  );
}
