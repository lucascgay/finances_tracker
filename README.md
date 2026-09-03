# LocalFinance Tracker

A **local-first, privacy-focused** personal finance dashboard. Drop in monthly
credit-card statements (PDF) or paste raw utility/expense text, let an LLM
(Ollama local or an OpenAI-compatible API) turn it into structured
transactions, and explore your spending with rich charts and budgets.

Everything is stored in a **local SQLite** database. No data ever leaves your
machine (unless you choose an online LLM provider).

---

## 1. Tech Stack

| Concern            | Choice                                              |
| ------------------ | --------------------------------------------------- |
| Framework          | Next.js 14 (App Router, React 18, TypeScript)       |
| Styling            | Tailwind CSS 3 + hand-rolled shadcn-style components|
| Icons              | lucide-react                                        |
| Charts             | recharts (donut + progress bars)                    |
| PDF text extraction| pdfplumber (Python) via a Node→Python bridge          |
| Database           | SQLite via Prisma 6 ORM                             |
| LLM parsing        | Ollama (local, default) **or** OpenAI-compatible API|
| Validation         | zod (strict parsing of LLM JSON output)             |

> Node 18+ **and Python 3.10+** are required. This repo's JS lockfile uses
> **pnpm** (pinned in `package.json` via `packageManager`), but you can equally
> use npm or yarn. The PDF extractor depends on **pdfplumber** (Python), which
> is installed and managed by **uv** in the `py/` directory.

---

## 2. Quick Start

```bash
# 1) Install JS dependencies
pnpm install

# 2) Install the Python environment (needed only for PDF uploads).
#    Requires: Python 3.10+ and uv (https://docs.astral.sh/uv/)
cd py && uv sync && cd ..

# 3) Configure your LLM in .env (already created for you):
#    Option A (default, fully offline) — install Ollama first:
#      LLM_PROVIDER="ollama", OLLAMA_MODEL="llama3.1"
#    Option B — OpenAI-compatible API:
#      LLM_PROVIDER="openai", OPENAI_API_KEY="sk-...", OPENAI_MODEL="gpt-4o-mini"

# 4) Create the SQLite DB and generate the Prisma client
pnpm db:push

# 5) (Optional) load demo transactions + budgets so the dashboard isn't empty
pnpm db:seed

# 6) Run it
pnpm dev
# -> http://localhost:3000
```

---

## 3. Architecture

```
Browser (React, client components)
   │  Drag-drop PDF  /  paste text
   v
/api/extract  ──►  pdfplumber (Python)  (layout-aware text from PDF buffer)
   │                  │
   │                  └──►  LLM  (Ollama | OpenAI)  ──►  JSON
   │                              │
   │                              ▼
   │                      zod validation + normalization
   │                              │
   └──► Prisma ?? SQLite  (Statement, Transaction, Budget)
                        │
                        ▼
/api/transactions, /api/budgets, /api/statements   (read/update)
                        │
                        ▼
Dashboard: HeroSpend, CategoryChart, BudgetBar, TransactionTable
```

**Request flow for a paste or PDF:**
1. Route handler receives multipart (PDF) or JSON (text).
2. If PDF → `lib/pdf.ts` pipes the buffer to `scripts/pdf_extract.py`
   (pdfplumber), which returns layout-aware text (columns/rows in reading
   order) as JSON.
3. The text + a strict system prompt are sent to the LLM.
4. The model returns JSON → validated by **zod** → normalized (signs, dates,
   dedupe) in `lib/extract.ts`.
5. A `Statement` row is persisted, then each transaction within a DB
   transaction.
6. The UI refetches `/api/transactions` + `/api/budgets` and re-renders.

`lib/prisma.ts` caches the Prisma client across hot-reloads (Next.js dev
singleton pattern).

---

## 4. Data Schema (`prisma/schema.prisma`)

```prisma
model Statement {
  id          String        @id @default(cuid())
  name        String
  sourceType  SourceType
  content     String?               // raw extracted text, kept for reference
  createdAt   DateTime      @default(now())
  transactions Transaction[]
}

model Transaction {
  id          String      @id @default(cuid())
  date        DateTime
  description String
  merchant    String?
  amount      Float                 // signed USD: expenses < 0, income > 0
  category    Category
  sourceType  SourceType
  statementId String?
  statement   Statement?  @relation(fields: [statementId], references: [id], onDelete: SetNull)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  @@index([date])
  @@index([category])
  @@index([statementId])
}

model Budget {
  id        String   @id @default(cuid())
  month     String             // "YYYY-MM"
  category  Category
  amount    Float              // monthly cap in USD
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([month, category])
}

enum Category {
  Rent
  Gas_Transportation
  Groceries
  Dining_Coffee
  Home_Supplies
  Utilities_Housing
  Subscriptions_Gym
  Entertainment_Personal
  Income_Credit
  Uncategorized
}

enum SourceType {
  CreditCardStatement
  UtilityBill
  ManualPaste
}
```

The `Category` / `SourceType` enums are mirrored in `lib/categories.ts`
(display label + chart color) so the UI, API, DB, and LLM prompt all agree on
one source of truth.

### Sign convention
- **Expenses** are stored **negative** (`amount: -46.20`).
- **Income / credits / refunds** are stored **positive**.
- Charts, hero metric, and budget bars always display spending as positive
  numbers by taking `Math.abs()`.

---

## 5. The LLM Extraction Prompt (`lib/prompt.ts` + `lib/llm.ts`)

The system prompt is designed to be "bulletproof" against a noisy model:

- **Output only JSON** — no markdown fences, no prose, parseable by
  `JSON.parse()`.
- **Strict categories** — the model is handed the exact allowed strings and
  told to use exactly those.
- **Drop, don't guess** — if date or amount is missing/unparseable, skip the
  line rather than invent a value.
- **Sign rules** — income positive, everything else negative; strip `$`/`,`.
- **Ignore boilerplate** — page numbers, totals, balances, pending watermarks.

The user message embeds the exact JSON shape with a concrete example.

### JSON schema (validated with zod in `lib/extract.ts`)

```jsonc
{
  "transactions": [
    {
      "date": "2026-09-12",        // ISO YYYY-MM-DD
      "description": "Shell Gas Station",
      "merchant": "Shell",         // inferred from description when missing
      "amount": -46.2,             // signed USD
      "category": "Gas_Transportation",
      "sourceType": "CreditCardStatement"
    }
  ]
}
```

**Normalization pass** (protects the DB from bad models):
- Coerces sign convention regardless of what the model sends.
- Rejects non-finite / absurd magnitudes.
- Rejects rows with no usable date.
- Deduplicates by `date|merchant|amount` fingerprint.
- Caps string lengths.

---

## 6. API Endpoints

| Method | Path                          | Description                                    |
| ------ | ----------------------------- | ---------------------------------------------- |
| POST   | `/api/extract`                | Accepts a PDF (multipart `file`) **or** pasted text (JSON `{ text }`). Runs the LLM, persists a `Statement` + transactions. |
| GET    | `/api/transactions`           | List w/ filters: `?month=YYYY-MM`, `?category=`, `?q=search`, `?limit=`. |
| PATCH  | `/api/transactions/:id`       | Re-assign `category`, edit `description`/`merchant`. |
| DELETE | `/api/transactions/:id`       | Remove a transaction.                          |
| GET    | `/api/budgets?month=`         | Per-category budgeted vs. spent + overall summary. |
| PUT    | `/api/budgets`                | Upsert monthly budgets (`{ month, budgets: [{ category, amount }] }`). |
| GET    | `/api/statements`             | Recently imported source docs + tx counts.     |

---

## 7. File Structure

```
.
├── prisma/
│   ├── schema.prisma        # models + enums
│   └── seed.ts              # demo transactions + budgets
├── scripts/
│   └── pdf_extract.py      # pdfplumber layout-aware PDF → JSON text
├── py/
│   ├── pyproject.toml      # pdfplumber dependency (managed by uv)
│   ├── uv.lock             # pinned Python deps
│   └── .venv/              # virtualenv (git-ignored; build via `uv sync`)
├── app/
│   ├── page.tsx             # dashboard shell (client component)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── extract/route.ts          # PDF/text -> LLM -> insert
│       ├── transactions/route.ts     # GET list (+ filters)
│       ├── transactions/[id]/route.ts# PATCH / DELETE
│       ├── budgets/route.ts          # GET summary / PUT upsert
│       └── statements/route.ts       # GET imports
├── components/
│   ├── uploader.tsx         # drag-drop PDF zone + paste area (client)
│   ├── hero-spend.tsx       # total spend / income / net card
│   ├── category-chart.tsx   # recharts donut + top-N legend
│   ├── budget-bar.tsx       # budget vs. actual with inline editing
│   ├── transaction-table.tsx# search / sort / filter / re-categorize
│   └── ui/                 # button, card, badge
├── lib/
│   ├── prisma.ts            # singleton Prisma client
│   ├── categories.ts        # category labels + colors (source of truth)
│   ├── prompt.ts            # extraction system prompt
│   ├── llm.ts               # Ollama + OpenAI client + user prompt
│   ├── extract.ts           # zod schema + normalization/dedupe
│   ├── pdf.ts               # Node→Python bridge to pdfplumber
│   └── cn.ts                # clsx + tailwind-merge
├── .env / .env.example      # DATABASE_URL + LLM provider config
└── tailwind.config.ts
```

---

## 8. Key Implementation Details

### Drag-and-drop PDF + paste (`components/uploader.tsx`)
- Client-side `onDragOver`/`onDrop` with a `dragging` state that swaps the
  dropzone border/background for **visual feedback**.
- Stores the actual dropped/selected **`File` objects** in state and uploads
  each as `multipart/form-data` to `/api/extract`; sends paste as JSON. Shows
  inline loading / success / error states, plus a clear "no transactions /
  likely a scanned image" message when a PDF yields nothing.

### PDF text extraction (`lib/pdf.ts` + `scripts/pdf_extract.py`)
- A Node route pipes the uploaded PDF buffer to a Python subprocess
  (`scripts/pdf_extract.py`) that reads it from stdin.
- The script uses **pdfplumber** with `extract_text(layout=True)`, which
  reconstructs text from character coordinates so multi-column bank/credit-card
  statements come out in reading order (not a jumbled blob).
- Override the interpreter with the `PDF_PYTHON` env var; it defaults to
  `py/.venv/bin/python`. If pdfplumber isn't installed the route returns a
  clear error telling you to run `uv sync` in `py/`.
- If the extracted text is extremely short, the route warns that the PDF is
  likely a scanned image with no text layer (pdfplumber can't OCR).

### LLM integration (`lib/llm.ts`)
- `LLM_PROVIDER` switches between `ollama` (default, fully offline) and an
  OpenAI-compatible chat-completions API.
- Uses `temperature: 0` and `response_format: { type: "json_object" }` (where
  supported) and Ollama's `format: "json"` to force JSON output.
- A generic `stripFences()` removes stray markdown code blocks, then zod
  validates before any DB write.

### Budget vs. actual (`components/budget-bar.tsx` + `/api/budgets`)
- Narrows each category by its selected month, sums absolute spend, and
  compares against the monthly `Budget` rows.
- Inline numeric inputs let you edit a category's cap; a "Save budgets" button
  PUTs an upsert that replaces that month's budget rows.

### Dashboard aggregation (`app/page.tsx`)
- A month selector (last 24 months) drives every fetch.
- `/api/transactions?month=` + `/api/budgets?month=` are fetched together.
- The donut and hero metric are computed client-side from the transaction
  list, so no extra aggregation endpoint is needed for this scale.

---

## 9. Trying It Without An LLM

If you don't have Ollama or an API key, the extract endpoint cannot run an
LLM, but **everything else works**:

```bash
pnpm db:seed      # loads 16 demo transactions + monthly budgets
pnpm dev          # browse the fully-populated dashboard
```

When you're ready for real parsing, install [Ollama](https://ollama.com), pull
a model (`ollama pull llama3.1`), and start `pnpm dev` again — the "Extract
Transactions" button will then work end-to-end.

---

## 10. Production Notes

- SQLite is perfect for a single-user local tool. The DB file lives at
  `prisma/dev.db` (git-ignored). Back it up by copying that one file.
- For a heavier multi-user deployment you can swap the datasource to Postgres
  by changing `provider` in `prisma/schema.prisma` and regenerating migrations.
- All API routes are marked `runtime = "nodejs"` because item extraction is
  CPU-bound and `pdf-parse` needs Node APIs.
