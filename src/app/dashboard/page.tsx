import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { business } from "@/lib/business";
import { listLeads } from "@/lib/leads";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Leads captured by {business.agentName}</h1>
            <p className="text-sm text-slate-600">{business.name} · owner dashboard (refresh to update)</p>
          </div>
          <Link href="/" className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white">← Back to website</Link>
        </div>

        <Suspense fallback={<p className="mt-10 text-center text-slate-500">Loading leads…</p>}>
          <Leads />
        </Suspense>
      </div>
    </div>
  );
}

async function Leads() {
  await connection();
  const leads = await listLeads();
  const bookings = leads.filter((l) => l.kind === "booking_request").length;
  const handoffs = leads.length - bookings;

  return (
    <>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["Total", leads.length],
            ["Booking requests", bookings],
            ["Need a human", handoffs],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-2xl font-bold">{n}</div>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No leads yet. Open the website, chat with {business.agentName} and ask to book an appointment.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Preferred time</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(l.createdAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          l.kind === "booking_request" ? "bg-teal-100 text-teal-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {l.kind === "booking_request" ? "Booking" : "Human needed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{l.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{l.phone}</td>
                    <td className="px-4 py-3">{l.service ?? "—"}</td>
                    <td className="px-4 py-3">{l.preferredTime ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{l.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
