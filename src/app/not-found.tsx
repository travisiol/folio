import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap flex min-h-[60svh] flex-col items-center justify-center text-center">
      <p className="label">404</p>
      <h1 className="display mt-3 text-[clamp(44px,7vw,88px)]">Nothing in this basket.</h1>
      <Link href="/" className="btn btn-cream mt-8">
        Back to the start
      </Link>
    </div>
  );
}
