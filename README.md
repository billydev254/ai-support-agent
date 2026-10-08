# AI Front-Desk Agent: Fiverr demo

A demo website for a fictional dental clinic. It has an AI chat assistant ("Amani") that:

- answers questions about prices, hours, insurance and the team, using **only** the clinic's own information
- collects booking requests (name, phone, service and preferred time) and saves them
- flags emergencies, complaints and "I want a human" requests for staff to follow up
- replies in the visitor's language (English, Swahili, …)

The owner sees every captured lead at **/dashboard**.

## Run it

```bash
cp .env.example .env.local    # then paste your OpenAI API key into it
npm install
npm run dev
```

Open http://localhost:3000, click the chat bubble, then open http://localhost:3000/dashboard.

## Re-using it for a buyer

| What to change | Where |
|---|---|
| Business name, hours, contacts, prices, FAQs | `src/lib/business.ts` |
| Assistant behaviour and tone | `systemPrompt` in `src/lib/agent.ts` |
| Where leads go (CRM, Google Sheets, email, WhatsApp) | `src/lib/leads.ts` |
| Look and feel of the widget | `src/components/ChatWidget.tsx` |

## Deploy to Vercel

1. Import this GitHub repo at vercel.com/new (keep the default Next.js settings).
2. Under **Environment Variables**, add `OPENAI_API_KEY` and `DASHBOARD_PASSWORD`.
3. After the first deploy, go to **Storage → Create Database → Upstash (Redis)** and connect it to the project. This stores leads and chats, and switches on rate limiting.
4. **Redeploy** so the new database variables take effect.

On the live site, `/dashboard` asks for a password: any username, plus the `DASHBOARD_PASSWORD` you set.

## Limits on the live demo

- 30 messages per visitor per hour, and 1,000 messages per day in total (`src/lib/rate-limit.ts`)
- Chats expire after 24 hours, and the 500 most recent leads are kept
