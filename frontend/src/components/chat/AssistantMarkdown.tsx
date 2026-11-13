import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-6 text-xl font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="opacity-75">{children}</del>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-teal-500/60 pl-4 text-[var(--muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-[var(--border)]" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-teal-500 underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs leading-5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[var(--border)] px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-[var(--border)] px-3 py-2 align-top">{children}</td>,
  img: () => null,
};

export default function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-markdown break-words leading-7 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
