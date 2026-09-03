import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();

async function main() {
  // Demo dataset for the current month so the dashboard isn't empty.
  const transactions = [
    { d: 2, desc: "Whole Foods Market", merch: "Whole Foods", amt: 142.37, cat: "Groceries" },
    { d: 3, desc: "Shell Gas Station", merch: "Shell", amt: 46.2, cat: "Gas_Transportation" },
    { d: 4, desc: "Netflix", merch: "Netflix", amt: 15.99, cat: "Subscriptions_Gym" },
    { d: 5, desc: "Trader Joe's", merch: "Trader Joe's", amt: 68.4, cat: "Groceries" },
    { d: 6, desc: "Blue Bottle Coffee", merch: "Blue Bottle", amt: 8.75, cat: "Dining_Coffee" },
    { d: 7, desc: "Rent - Month", merch: "Rent", amt: 1850, cat: "Rent" },
    { d: 8, desc: "ConEd Electric", merch: "ConEd", amt: 92.1, cat: "Utilities_Housing" },
    { d: 9, desc: "Spotify", merch: "Spotify", amt: 11.99, cat: "Subscriptions_Gym" },
    { d: 10, desc: "Gym Membership - Planet Fitness", merch: "Planet Fitness", amt: 24.99, cat: "Subscriptions_Gym" },
    { d: 11, desc: "Amazon.com", merch: "Amazon", amt: 56.3, cat: "Home_Supplies" },
    { d: 12, desc: "Chipotle", merch: "Chipotle", amt: 13.45, cat: "Dining_Coffee" },
    { d: 13, desc: "Lyft Ride", merch: "Lyft", amt: 21.4, cat: "Gas_Transportation" },
    { d: 14, desc: "Paycheck - Acme Corp", merch: "Acme Corp", amt: 5200, cat: "Income_Credit" },
    { d: 15, desc: "Target", merch: "Target", amt: 88.22, cat: "Home_Supplies" },
    { d: 16, desc: "Verizon Wireless", merch: "Verizon", amt: 75, cat: "Utilities_Housing" },
    { d: 18, desc: "Cinemark", merch: "Cinemark", amt: 14, cat: "Entertainment_Personal" },
  ] as const;

  const statement = await prisma.statement.create({
    data: {
      name: "Demo · sample data",
      sourceType: "ManualPaste",
      content: "Generated demo transactions for evaluation.",
    },
  });

  for (const t of transactions) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), t.d, 12));
    const isIncome = t.cat === "Income_Credit";
    await prisma.transaction.create({
      data: {
        date,
        description: t.desc,
        merchant: t.merch,
        amount: isIncome ? t.amt : -t.amt,
        category: t.cat as never,
        sourceType: "ManualPaste",
        statementId: statement.id,
      },
    });
  }

  // Sample monthly budgets.
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const budgets: { category: string; amount: number }[] = [
    { category: "Rent", amount: 1900 },
    { category: "Groceries", amount: 500 },
    { category: "Dining_Coffee", amount: 250 },
    { category: "Gas_Transportation", amount: 200 },
    { category: "Home_Supplies", amount: 200 },
    { category: "Utilities_Housing", amount: 250 },
    { category: "Subscriptions_Gym", amount: 100 },
    { category: "Entertainment_Personal", amount: 150 },
  ];
  for (const b of budgets) {
    await prisma.budget.create({
      data: { month: key, category: b.category as never, amount: b.amount },
    });
  }

  console.log("Seeded demo transactions + budgets.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
