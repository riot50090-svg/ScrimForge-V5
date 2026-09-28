import Link from "next/link";
import Form from "./form";

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const initialCode = String(params.code || "").trim().toUpperCase();

  return (
    <main>
      <nav className="nav">
        <Link href="/" className="brand"><span className="mark">SF</span>ScrimForge</Link>
      </nav>
      <section className="wrap page narrow">
        <span className="eyebrow">REGISTRATION STATUS</span>
        <h1>Check Status</h1>
        <p className="muted">Enter the reference code you received after registering your Free Fire squad.</p>
        <Form initialCode={initialCode} />
        <Link href="/register">← Register another team</Link>
      </section>
    </main>
  );
}
