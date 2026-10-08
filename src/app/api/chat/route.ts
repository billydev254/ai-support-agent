import OpenAI from "openai";
import { chat } from "@/lib/agent";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { conversationId, message } = (await req.json()) as { conversationId?: string; message?: string };
  if (!conversationId || !message?.trim()) {
    return Response.json({ error: "conversationId and message are required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      "⚠️ The assistant isn't configured yet: add OPENAI_API_KEY to .env.local and restart the server.",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limited = await checkRateLimit(ip);
  if (limited) {
    return new Response(limited, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        await chat(conversationId, message.slice(0, 2000), write);
      } catch (error) {
        console.error(error);
        if (error instanceof OpenAI.AuthenticationError) {
          write("⚠️ The OpenAI API key was rejected. Check OPENAI_API_KEY in .env.local.");
        } else if (error instanceof OpenAI.RateLimitError) {
          write("I'm getting a lot of messages right now — please try again in a moment. (If this keeps happening, check the OpenAI account has credit.)");
        } else {
          write("Sorry, something went wrong on my side. Please try again or call the clinic directly.");
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
