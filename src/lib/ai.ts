// lib/ai.ts
// ─── Core AI utility for Fintrax Agent ───────────────────────────────────────
// Handles: system prompt construction, Claude API calls, action parsing

import { UserProfile } from '../hooks/useUserprofile';

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  userId: string;
}

export interface AgentAction {
  type: 'ADD_EXPENSE' | 'DELETE_EXPENSE' | 'UPDATE_EXPENSE' | 'NONE';
  payload?: {
    id?: string;
    title?: string;
    amount?: number;
    category?: string;
    date?: string;
    notes?: string;
  };
}

export interface AgentResponse {
  message: string;
  action: AgentAction;
  suggestions?: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: AgentAction;
  isTyping?: boolean;
}

// ─── FINANCIAL CONTEXT BUILDER ────────────────────────────────────────────────
export function buildFinancialContext(expenses: Expense[], profile: UserProfile | null, symbol: string): string {
  if (!expenses.length) {
    return `The user has no expenses recorded yet. Encourage them to add their first expense.`;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Monthly totals
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const lastMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    const lm = currentMonth === 0 ? 11 : currentMonth - 1;
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const allTimeTotal   = expenses.reduce((s, e) => s + e.amount, 0);
  const avgTransaction = allTimeTotal / expenses.length;

  // Category breakdown (all time)
  const byCategory: Record<string, number> = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => `${cat}: ${symbol}${total.toFixed(2)}`)
    .join(', ');

  // This month by category
  const thisMonthByCategory: Record<string, number> = {};
  thisMonthExpenses.forEach(e => { thisMonthByCategory[e.category] = (thisMonthByCategory[e.category] || 0) + e.amount; });
  const thisMonthCats = Object.entries(thisMonthByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) => `${cat}: ${symbol}${total.toFixed(2)}`)
    .join(', ');

  // Monthly trend (last 6 months)
  const monthlyTrend: Record<string, number> = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const key = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyTrend[key] = (monthlyTrend[key] || 0) + e.amount;
  });
  const trendStr = Object.entries(monthlyTrend)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-6)
    .map(([m, t]) => `${m}: ${symbol}${t.toFixed(2)}`)
    .join(' | ');

  // Largest expense
  const largest = [...expenses].sort((a, b) => b.amount - a.amount)[0];

  // Recent 10 expenses
  const recent = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(e => `[ID:${e.id}] ${e.date} | ${e.title} | ${symbol}${e.amount.toFixed(2)} | ${e.category}${e.notes ? ` | "${e.notes}"` : ''}`)
    .join('\n');

  // Anomaly detection — months with >50% spike
  const monthlyValues = Object.values(monthlyTrend);
  const avgMonthly = monthlyValues.reduce((a, b) => a + b, 0) / (monthlyValues.length || 1);
  const anomalyMonth = Object.entries(monthlyTrend).find(([, v]) => v > avgMonthly * 1.5);

  const deltaPercent = lastMonthTotal > 0
    ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1)
    : 'N/A';

  return `
=== USER FINANCIAL DATA ===
User: ${profile?.displayName || profile?.username || 'User'}
Currency: ${profile?.currency || 'USD'} (${symbol})
Country: ${profile?.country || 'Unknown'}

=== SUMMARY ===
Total transactions: ${expenses.length}
All-time total spent: ${symbol}${allTimeTotal.toFixed(2)}
Average transaction: ${symbol}${avgTransaction.toFixed(2)}
Largest single expense: ${largest.title} — ${symbol}${largest.amount.toFixed(2)} on ${largest.date}

=== THIS MONTH (${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}) ===
Total spent: ${symbol}${thisMonthTotal.toFixed(2)}
vs last month: ${deltaPercent}% ${parseFloat(deltaPercent) > 0 ? '↑ increase' : '↓ decrease'}
Transactions: ${thisMonthExpenses.length}
By category: ${thisMonthCats || 'No data'}

=== ALL-TIME BY CATEGORY ===
${topCategories}

=== MONTHLY TREND (last 6 months) ===
${trendStr}

${anomalyMonth ? `=== ⚠️ ANOMALY DETECTED ===\nSpending spike in ${anomalyMonth[0]}: ${symbol}${anomalyMonth[1].toFixed(2)} (${((anomalyMonth[1] / avgMonthly - 1) * 100).toFixed(0)}% above average)` : ''}

=== RECENT 10 TRANSACTIONS ===
${recent}
`.trim();
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
export function buildSystemPrompt(financialContext: string): string {
  return `You are Fintrax AI — a sharp, friendly personal finance assistant built into the Fintrax expense tracker app. You have full access to the user's financial data and can take actions on their behalf.

## Your Personality
- Conversational and warm, but sharp and data-driven
- You give real, specific answers using the user's actual numbers — never generic advice
- You're also a capable general assistant: you can help with math, answer questions, explain concepts, and have real conversations
- You're direct. No fluff. But you have personality.

## Your Capabilities
1. **Answer financial questions** using the data below (specific numbers, trends, comparisons)
2. **Take actions**: add, edit, or delete expenses when the user asks
3. **Give financial coaching**: budgeting advice, spending patterns, recommendations
4. **Detect anomalies**: flag unusual spending when relevant
5. **General assistant**: answer any question, help with math, explain things — you're not limited to finance

## Action Format
When the user asks you to ADD, DELETE, or EDIT an expense, you MUST include a JSON block at the very end of your response in this exact format:

For ADD:
\`\`\`action
{"type":"ADD_EXPENSE","payload":{"title":"...","amount":0,"category":"...","date":"YYYY-MM-DD","notes":"..."}}
\`\`\`

For DELETE (use the ID from the data):
\`\`\`action
{"type":"DELETE_EXPENSE","payload":{"id":"..."}}
\`\`\`

For UPDATE:
\`\`\`action
{"type":"UPDATE_EXPENSE","payload":{"id":"...","title":"...","amount":0,"category":"...","date":"YYYY-MM-DD"}}
\`\`\`

Valid categories are EXACTLY: Food, Transport, Shopping, Bills, Entertainment, Other

When no action is needed:
\`\`\`action
{"type":"NONE"}
\`\`\`

## Rules
- Always include the action block, even if it's just NONE
- If the user wants to delete something but you're unsure which expense, ask for clarification
- Use today's date (${new Date().toISOString().split('T')[0]}) when adding expenses if no date is specified
- Be specific with numbers — always reference actual figures from their data
- If asked something outside finance, just answer it naturally as a smart assistant would

## User's Financial Data
${financialContext}`;
}

// ─── CLAUDE API CALL ──────────────────────────────────────────────────────────
export async function callClaude(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  maxTokens = 1000
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
}

// ─── ACTION PARSER ────────────────────────────────────────────────────────────
export function parseAgentResponse(raw: string): AgentResponse {
  const actionMatch = raw.match(/```action\n([\s\S]*?)\n```/);
  let action: AgentAction = { type: 'NONE' };
  let message = raw;

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1].trim()) as AgentAction;
    } catch {
      // malformed JSON — treat as NONE
    }
    // Strip the action block from the visible message
    message = raw.replace(/```action\n[\s\S]*?\n```/g, '').trim();
  }

  return { message, action, suggestions: [] };
}

// ─── AUTO-CATEGORIZATION ──────────────────────────────────────────────────────
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'] as const;
type Category = typeof CATEGORIES[number];

// Debounced category suggestion via Claude
let categorizationTimer: ReturnType<typeof setTimeout> | null = null;

export function suggestCategory(
  title: string,
  onResult: (category: Category) => void,
  delay = 600
): void {
  if (categorizationTimer) clearTimeout(categorizationTimer);
  if (!title || title.length < 3) return;

  categorizationTimer = setTimeout(async () => {
    try {
      const result = await callClaude(
        [{ role: 'user', content: `Categorize this expense into exactly one of these categories: Food, Transport, Shopping, Bills, Entertainment, Other.\n\nExpense title: "${title}"\n\nReply with ONLY the category name, nothing else.` }],
        'You are an expense categorization assistant. Reply with exactly one word: the category name.',
        20
      );
      const cat = result.trim() as Category;
      if (CATEGORIES.includes(cat)) onResult(cat);
    } catch {
      // Silent fail — user keeps their current selection
    }
  }, delay);
}

// ─── WEEKLY INSIGHTS GENERATOR ────────────────────────────────────────────────
export async function generateWeeklyInsights(
  expenses: Expense[],
  profile: UserProfile | null,
  symbol: string
): Promise<string> {
  const context = buildFinancialContext(expenses, profile, symbol);
  const prompt  = buildSystemPrompt(context);

  const result = await callClaude(
    [{
      role: 'user',
      content: `Generate a brief weekly financial insight summary for the user. Cover:
1. One key spending pattern or trend you notice
2. One concrete, actionable tip based on their actual data
3. One thing they're doing well (if anything)

Keep it to 3 short paragraphs. Be specific with their actual numbers. Don't include an action block.`,
    }],
    prompt,
    400
  );

  return result.replace(/```action[\s\S]*?```/g, '').trim();
}

// ─── ANOMALY DETECTION (client-side math, no AI needed) ──────────────────────
export interface SpendingAnomaly {
  type: 'spike' | 'category_spike' | 'large_single';
  title: string;
  detail: string;
  severity: 'warning' | 'info';
}

export function detectAnomalies(expenses: Expense[], symbol: string): SpendingAnomaly[] {
  const anomalies: SpendingAnomaly[] = [];
  if (expenses.length < 5) return anomalies;

  const now = new Date();

  // Monthly totals
  const monthlyTotals: Record<string, number> = {};
  expenses.forEach(e => {
    const d   = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals[key] = (monthlyTotals[key] || 0) + e.amount;
  });

  const months      = Object.values(monthlyTotals);
  const avgMonthly  = months.reduce((a, b) => a + b, 0) / months.length;
  const thisKey     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisTotal   = monthlyTotals[thisKey] || 0;

  if (thisTotal > avgMonthly * 1.4 && months.length >= 2) {
    anomalies.push({
      type: 'spike',
      title: 'Higher spending this month',
      detail: `You've spent ${symbol}${thisTotal.toFixed(0)} this month — ${((thisTotal / avgMonthly - 1) * 100).toFixed(0)}% above your ${symbol}${avgMonthly.toFixed(0)} monthly average.`,
      severity: 'warning',
    });
  }

  // Large single transaction (>3x avg transaction)
  const avgTx = expenses.reduce((s, e) => s + e.amount, 0) / expenses.length;
  const recentLarge = expenses
    .filter(e => {
      const d = new Date(e.date);
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && e.amount > avgTx * 3;
    });

  recentLarge.forEach(e => {
    anomalies.push({
      type: 'large_single',
      title: `Large expense detected`,
      detail: `"${e.title}" (${symbol}${e.amount.toFixed(2)}) is ${(e.amount / avgTx).toFixed(1)}× your usual transaction size.`,
      severity: 'info',
    });
  });

  return anomalies.slice(0, 3); // max 3 anomalies shown
}