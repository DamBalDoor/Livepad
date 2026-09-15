import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { RuntimeEvent } from "@livepad/shared";

type Props = {
  events: RuntimeEvent[];
};

export default function ConsolePane({ events }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const seenRef = useRef(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const term = new Terminal({
      convertEol: true,
      fontSize: 12,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: { background: "#1e1e1e", foreground: "#d4d4d4", cursor: "#d4d4d4" },
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
      else if (event.type === "exit") term.write(`\r\n\x1b[33m[exit ${event.code}]\x1b[0m\r\n`);
    }
    seenRef.current = events.length;
  }, [events]);

  return <div ref={hostRef} className="h-full w-full bg-[#1e1e1e] p-2" />;
}
