import { promises as fs } from "fs";
import path from "path";
import { redis } from "./redis";

// Leads go to Redis when it's configured (production), otherwise to a local
// JSON file so the demo runs with zero setup. For a paid build you can also
// forward them to the client's CRM, Google Sheet, email or WhatsApp here.

export type Lead = {
  id: string;
  createdAt: string;
  kind: "booking_request" | "human_handoff";
  name: string;
  phone: string;
  email?: string;
  service?: string;
  preferredTime?: string;
  notes?: string;
  conversationId: string;
};

const KEY = "leads";
const MAX_LEADS = 500;
const file = path.join(process.cwd(), "data", "leads.json");

export async function listLeads(): Promise<Lead[]> {
  if (redis) return redis.lrange<Lead>(KEY, 0, MAX_LEADS - 1);
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Lead[];
  } catch {
    return [];
  }
}

export async function addLead(lead: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
  const saved: Lead = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...lead };
  if (redis) {
    await redis.lpush(KEY, saved);
    await redis.ltrim(KEY, 0, MAX_LEADS - 1);
    return saved;
  }
  const leads = await listLeads();
  leads.unshift(saved);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(leads, null, 2));
  return saved;
}
