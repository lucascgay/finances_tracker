"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, FileText, Loader2, Plus, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

type ParseResult = {
  parsed: number;
  inserted: number;
  statementId: string;
};

type Status = "idle" | "loading" | "success" | "error";

export default function Uploader({ onParsed }: { onParsed: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [paste, setPaste] = useState("");
  const [sourceType, setSourceType] = useState<string>("ManualPaste");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isPdf = (f: File) =>
    f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf";

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter(isPdf);
    if (pdfs.length) {
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name + f.lastModified));
        return [
          ...prev,
          ...pdfs.filter((f) => !existing.has(f.name + f.lastModified)),
        ];
      });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    // reset so selecting the same file again re-triggers onChange
    e.target.value = "";
  };

  async function handlePdfFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append(
      "sourceType",
      sourceType === "ManualPaste" ? "CreditCardStatement" : sourceType
    );
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Parse failed");
    return data as ParseResult;
  }

  async function handlePaste() {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: paste, sourceType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Parse failed");
    return data as ParseResult;
  }

  async function run() {
    setStatus("loading");
    setMessage("");
    try {
      let result: ParseResult = { parsed: 0, inserted: 0, statementId: "" };
      let parsedCount = 0;

      if (files.length) {
        for (const file of files) {
          result = await handlePdfFile(file);
          parsedCount += result.parsed;
        }
      } else if (paste.trim()) {
        result = await handlePaste();
        parsedCount = result.parsed;
      } else {
        setStatus("error");
        setMessage("Drop a PDF or paste some text first.");
        return;
      }

      const insertCount = result.inserted;
      setStatus(parsedCount > 0 ? "success" : "error");
      setMessage(
        parsedCount > 0
          ? `Parsed ${parsedCount} transaction(s), inserted ${insertCount}.`
          : "No transactions detected from that file. It may be a scanned image PDF — try copying the text and pasting it instead."
      );
      setFiles([]);
      setPaste("");
      if (inputRef.current) inputRef.current.value = "";
      onParsed();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const isBusy = status === "loading";

  return (
    <div className="space-y-4">
      {/* ------ Drop zone ------ */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging
            ? "border-sky-500 bg-sky-50"
            : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition",
            dragging ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-600"
          )}
        >
          <FileUp className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-700">
          {dragging ? "Drop to upload" : "Drag & drop PDF statement here"}
        </p>
        <p className="text-xs text-slate-500">or click to browse · PDF only</p>

        {files.length > 0 && (
          <div className="mt-2 w-full space-y-1 text-left">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                  <span className="truncate">{f.name}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFiles((prev) => prev.filter((_, j) => j !== i));
                  }}
                  className="text-slate-400 hover:text-rose-500"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ------ Paste area ------ */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-200" />
        or paste raw text
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Kind of source
        </label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        >
          <option value="ManualPaste">Manual paste / unknown</option>
          <option value="UtilityBill">Utility bill</option>
          <option value="CreditCardStatement">Credit card statement</option>
        </select>
      </div>

      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder="Shell 08/12  $42.10&#10;Netflix monthly  $15.99&#10;&#10;(paste any utility bill or line items)"
        rows={6}
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
      />

      <Button onClick={run} disabled={isBusy} className="w-full">
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing with LLM…
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" /> Extract Transactions
          </>
        )}
      </Button>

      {status === "success" && message && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {message}
        </p>
      )}
      {status === "error" && message && (
        <p className="flex items-center gap-1.5 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4" /> {message}
        </p>
      )}
    </div>
  );
}
