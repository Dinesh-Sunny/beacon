import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Beacon</h1>
      <Link href="/check">Start</Link>
    </main>
  );
}
