import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";
import { Code } from "@/ui/code";
import { cn } from "@/lib/utils";

const components: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const text = String(children).replace(/\n$/, "");
    const fenced = Boolean(className) || text.includes("\n");
    if (!fenced) {
      return <code>{text}</code>;
    }
    return <Code value={text}>{text}</Code>;
  },
  a({ href, children }) {
    return (
      <a href={href} className="text-accent underline" rel="noreferrer">
        {children}
      </a>
    );
  },
};

function MarkdownBody({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div className={cn("md-body", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export { MarkdownBody };
