import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { RuntimeEvent } from "@livepad/shared";
import { Button } from "./ui";
import { copy } from "../lib/copy";

type Props = {
  events: RuntimeEvent[];
  onClear: () => void;
};

export default function ConsolePane({ events, onClear }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const seenRef = useRef(0);
  const hasOutput = events.some(
    (e) => e.type === "stdout" || e.type === "stderr" || e.type === "status" || e.type === "exit" || e.type === "error",
  );

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      convertEol: true,
      fontSize: 12,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      theme: { background: "#161718", foreground: "#d4d4d4", cursor: "#d4d4d4" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (events.length < seenRef.current) {
      term.clear();
      seenRef.current = 0;
    }
    for (let i = seenRef.current; i < events.length; i += 1) {
      const event = events[i];
      if (event.type === "stdout") term.write(event.data);
      else if (event.type === "stderr") term.write(`\x1b[31m${event.data}\x1b[0m`);
      else if (event.type === "status") term.write(`\x1b[36m${event.data}\x1b[0m`);
      else if (event.type === "error") term.write(`\x1b[31m${event.message}\n\x1b[0m`);
      else if (event.type === "exit") term.write(`\r\n\x1b[33m${copy.console.exit(event.code)}\x1b[0m\r\n`);
    }
    seenRef.current = events.length;
  }, [events]);

  return (
    <div className="relative flex h-full flex-col bg-lp-console">
      <div className="flex shrink-0 items-center justify-between border-b border-lp-editor-border bg-[#1a1b1d] px-3 py-1.5">
        <span className="text-[length:var(--lp-text-xs)] font-medium uppercase tracking-wide text-lp-muted-text">
          {copy.console.title}
        </span>
        <Button variant="ghost" size="sm" className="text-lp-inverse hover:bg-white/10" onClick={onClear}>
          {copy.console.clear}
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {!hasOutput ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-[length:var(--lp-text-xs)] text-lp-muted-text">
            {copy.console.empty}
          </p>
        ) : null}
        <div ref={hostRef} className="h-full w-full p-2" />
      </div>
    </div>
  );
}
