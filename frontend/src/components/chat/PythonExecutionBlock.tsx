// Show the Python code the model ran for a calculation, with its output, in a collapsible block.

import { Terminal } from "lucide-react";
import type { PythonExecution } from "../../types";

export default function PythonExecutionBlock({ execution }: { execution: PythonExecution }) {
  const failed = execution.timedOut || execution.exitCode !== 0;

  return (
    <details className="app-surface mt-3 rounded-xl text-xs">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-medium">
        <Terminal size={13} className={failed ? "text-red-400" : "text-teal-500"} />
        {failed ? "Calculation failed" : "Calculation with Python"}
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono">{execution.code}</pre>
        {execution.stdout && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/10 p-3 font-mono">{execution.stdout}</pre>
        )}
        {execution.stderr && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-red-500/10 p-3 font-mono text-red-400">{execution.stderr}</pre>
        )}
        {execution.timedOut && <p className="text-red-400">The calculation took too long and was stopped.</p>}
      </div>
    </details>
  );
}