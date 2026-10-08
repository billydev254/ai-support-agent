import Link from "next/link";
import ChatWidget from "@/components/ChatWidget";
import { business } from "@/lib/business";

const services = [
  { name: "Check-ups & cleaning", text: "Keep your smile healthy with a full exam and professional clean." },
  { name: "Teeth whitening", text: "Up to 8 shades brighter in a single one-hour visit." },
  { name: "Clear aligners", text: "Straighten your teeth discreetly, with monthly payment plans." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
        Demo site for a fictional clinic. Open the chat bubble (bottom right), then see captured leads on the{" "}
        <Link href="/dashboard" className="font-semibold underline">owner dashboard</Link>.
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="text-xl font-bold text-teal-800">🦷 {business.name}</div>
        <div className="hidden text-sm text-slate-600 sm:block">{business.phone}</div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">{business.tagline}</h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Book a check-up, ask about prices or insurance, any time of day. Our assistant {business.agentName} replies in seconds.
          </p>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-3">
          {services.map((s) => (
            <div key={s.name} className="rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-teal-800">{s.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        {business.address} · {business.hours}
      </footer>

      <ChatWidget agentName={business.agentName} businessName={business.name} />
    </div>
  );
}
