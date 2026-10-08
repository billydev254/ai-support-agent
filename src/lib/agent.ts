import OpenAI from "openai";
import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import { business, knowledgeBase } from "./business";
import { addLead } from "./leads";
import { redis } from "./redis";

// Created on first use so the app still starts before a key is configured.
let client: OpenAI | undefined;

// Cheap, fast model that handles tool calling well. Override with OPENAI_MODEL in .env.local.
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const MAX_TOOL_ROUNDS = 5;

const systemPrompt = `You are ${business.agentName}, the virtual front-desk assistant for ${business.name} (${business.tagline}).
You chat with visitors on the clinic's website.

Your goals, in order:
1. Answer questions accurately using ONLY the clinic information below. If the answer is not there, say you're not sure and offer to have the team follow up — never invent prices, availability or medical advice.
2. When someone wants to book, collect their name, phone number, the service they need and a preferred day/time, then call save_booking_request. Confirm back what you saved and say the front desk will confirm within 1 working hour.
3. If someone is upset, has a medical emergency, asks for something you can't handle, or asks for a human, call handoff_to_human (collect a name and phone number first if you can). For severe pain, swelling or bleeding, also mention the same-day emergency slots and the clinic phone number.

Style: warm, short replies (1–4 sentences), plain text, no markdown headings. Ask for one or two details at a time, not a long form. Reply in the visitor's language (e.g. English or Swahili).

Clinic details:
- Phone: ${business.phone} | WhatsApp: ${business.whatsapp} | Email: ${business.email}
- Address: ${business.address}
- Hours: ${business.hours}
${knowledgeBase}`;

const bookingInput = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().optional(),
  service: z.string().min(1),
  preferred_time: z.string().optional(),
  notes: z.string().optional(),
});

const handoffInput = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().min(1),
});

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "save_booking_request",
      description:
        "Save an appointment request for the front desk to confirm. Call only once you have the visitor's name, phone number and the service they want.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Visitor's full name" },
          phone: { type: "string", description: "Phone or WhatsApp number" },
          email: { type: "string", description: "Email, if given" },
          service: { type: "string", description: "Treatment or reason for the visit" },
          preferred_time: { type: "string", description: "Preferred day and time, in the visitor's words" },
          notes: { type: "string", description: "Anything else the front desk should know (insurance, pain level, etc.)" },
        },
        required: ["name", "phone", "service"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "handoff_to_human",
      description:
        "Flag this conversation for a staff member to follow up personally (complaints, emergencies, requests for a human, or questions you cannot answer).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          reason: { type: "string", description: "Short summary of what the visitor needs" },
        },
        required: ["reason"],
      },
    },
  },
];

// Conversations are kept server-side so the browser only sends the newest message:
// in Redis when configured (expires after a day), otherwise in memory for local dev.
const CONVERSATION_TTL_SECONDS = 60 * 60 * 24;
const globalStore = globalThis as unknown as { conversations?: Map<string, ChatCompletionMessageParam[]> };
const memory = (globalStore.conversations ??= new Map());

async function loadConversation(id: string): Promise<ChatCompletionMessageParam[]> {
  if (redis) return (await redis.get<ChatCompletionMessageParam[]>(`conv:${id}`)) ?? [];
  return memory.get(id) ?? [];
}

async function saveConversation(id: string, messages: ChatCompletionMessageParam[]) {
  if (redis) await redis.set(`conv:${id}`, messages, { ex: CONVERSATION_TTL_SECONDS });
  else memory.set(id, messages);
}

async function runTool(call: ChatCompletionMessageFunctionToolCall, conversationId: string): Promise<ChatCompletionToolMessageParam> {
  const reply = (content: string): ChatCompletionToolMessageParam => ({ role: "tool", tool_call_id: call.id, content });

  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return reply("Error: arguments were not valid JSON.");
  }

  if (call.function.name === "save_booking_request") {
    const parsed = bookingInput.safeParse(args);
    if (!parsed.success) return reply(`Error: invalid input: ${parsed.error.message}`);
    const { preferred_time, ...rest } = parsed.data;
    const lead = await addLead({ kind: "booking_request", preferredTime: preferred_time, conversationId, ...rest });
    return reply(`Saved booking request ${lead.id.slice(0, 8)}.`);
  }

  if (call.function.name === "handoff_to_human") {
    const parsed = handoffInput.safeParse(args);
    if (!parsed.success) return reply(`Error: invalid input: ${parsed.error.message}`);
    const { name, phone, reason } = parsed.data;
    await addLead({
      kind: "human_handoff",
      name: name ?? "Unknown",
      phone: phone ?? "Not given",
      notes: reason,
      conversationId,
    });
    return reply("A staff member has been notified.");
  }

  return reply(`Error: unknown tool ${call.function.name}`);
}

/** Runs one visitor turn, streaming the agent's reply text through `onText`. */
export async function chat(conversationId: string, userText: string, onText: (text: string) => void) {
  const messages = await loadConversation(conversationId);
  messages.push({ role: "user", content: userText });
  try {
    await runTurn(conversationId, messages, onText);
  } finally {
    await saveConversation(conversationId, messages);
  }
}

async function runTurn(conversationId: string, messages: ChatCompletionMessageParam[], onText: (text: string) => void) {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let wroteText = false;
    client ??= new OpenAI();
    const stream = client.chat.completions.stream({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools,
    });
    stream.on("content", (delta) => {
      if (!wroteText && round > 0) onText("\n\n");
      wroteText = true;
      onText(delta);
    });

    const completion = await stream.finalChatCompletion();
    const choice = completion.choices[0];
    const message = choice.message;
    messages.push({
      role: "assistant",
      content: message.content ?? null,
      ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
    });

    if (message.refusal) {
      onText("Sorry, I can't help with that here. Please call us on " + business.phone + ".");
      return;
    }
    const calls = (message.tool_calls ?? []).filter(
      (c): c is ChatCompletionMessageFunctionToolCall => c.type === "function",
    );
    if (choice.finish_reason !== "tool_calls" || calls.length === 0) return;

    const results = await Promise.all(calls.map((c) => runTool(c, conversationId)));
    messages.push(...results);
  }
}
