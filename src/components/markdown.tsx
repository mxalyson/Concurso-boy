import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-marca-600 prose-table:text-sm prose-th:bg-slate-50 dark:prose-th:bg-slate-800/50 prose-th:px-3 prose-td:px-3 prose-blockquote:border-marca-400 prose-blockquote:font-normal prose-blockquote:not-italic",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
