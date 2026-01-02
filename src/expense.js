// Expense categories (used for validation, dropdowns, etc.)
export const EXPENSE_CATEGORIES = [
  'Food',
  'Shopping',
  'Transportation',
  'Entertainment',
  'Bills',
  'Healthcare',
  'Other',
];

/*
Expense object structure (for reference):

{
  id: string,
  title: string,
  amount: number,
  category: string,
  date: string,
  notes: string,
  created_at: string
}

NewExpense structure (used when creating an expense):

{
  title: string,
  amount: number,
  category: string,
  date: string,
  notes: string
}
*/
