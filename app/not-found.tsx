import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: "48px 0" }}>
      <p className="kicker">Missing</p>
      <h1>That page is not in the lab.</h1>
      <p>
        <Link href="/">Back to the catalog</Link>
      </p>
    </main>
  );
}
