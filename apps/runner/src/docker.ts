import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const NODE_IMAGE = process.env.NODE_IMAGE ?? "node:20-alpine";
const JOBS_DIR = process.env.JOBS_DIR ?? path.resolve(process.cwd(), "../../tmp/jobs");
const INSTALL_TIMEOUT_MS = 60_000;
const RUN_TIMEOUT_MS = 15_000;

export type JobEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "status"; data: string }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string };

function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  }
}

function killChild(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  child.kill("SIGKILL");
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number; onEvent: (event: JobEvent) => void },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      env: { ...process.env, npm_config_ignore_scripts: "true" },
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killChild(child);
      options.onEvent({
        type: "stderr",
        data: `\nПревышен лимит времени (${Math.round(options.timeoutMs / 1000)}s)\n`,
      });
    }, options.timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => options.onEvent({ type: "stdout", data: chunk.toString() }));
    child.stderr?.on("data", (chunk: Buffer) => options.onEvent({ type: "stderr", data: chunk.toString() }));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(timedOut ? 124 : code ?? 1);
    });
  });
}

function hasDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["version"], { windowsHide: true, stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function dockerVolume(hostDir: string): string {
  return `${toPosix(hostDir)}:/workspace`;
}

export async function executeJob(input: {
  roomSlug: string;
  action: "install" | "run";
  files: Record<string, string>;
  entrypoint: string;
  onEvent: (event: JobEvent) => void;
}): Promise<void> {
  const workdir = path.join(JOBS_DIR, input.roomSlug.replace(/[^A-Za-z0-9_-]/g, "_"));
  await mkdir(workdir, { recursive: true });
  for (const name of Object.keys(input.files)) {
    await rm(path.join(workdir, name), { force: true });
  }
  await writeTree(workdir, input.files);

  const docker = await hasDocker();
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const nodeBin = process.execPath;

  if (!docker) {
    input.onEvent({
      type: "status",
      data: "Docker не найден — локальный запуск с таймаутом (поставьте Docker Desktop для песочницы).\n",
    });
    if (input.action === "install") {
      const code = await runCommand(
        npmBin,
        ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: workdir, timeoutMs: INSTALL_TIMEOUT_MS, onEvent: input.onEvent },
      );
      input.onEvent({ type: "exit", code });
      return;
    }
    const args = input.entrypoint.endsWith(".ts")
      ? ["--experimental-strip-types", input.entrypoint]
      : [input.entrypoint];
    const code = await runCommand(nodeBin, args, {
      cwd: workdir,
      timeoutMs: RUN_TIMEOUT_MS,
      onEvent: input.onEvent,
    });
    input.onEvent({ type: "exit", code });
    return;
  }

  const volume = dockerVolume(path.resolve(workdir));
  const common = ["run", "--rm", "--memory=256m", "--cpus=0.5", "--pids-limit=128", "-v", volume, "-w", "/workspace"];

  if (input.action === "install") {
    input.onEvent({ type: "status", data: "Установка зависимостей в песочнице...\n" });
    const code = await runCommand("docker", [
      ...common,
      "--network=bridge",
      NODE_IMAGE,
      "npm",
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ], { timeoutMs: INSTALL_TIMEOUT_MS, onEvent: input.onEvent });
    input.onEvent({ type: "exit", code });
    return;
  }

  const entry = input.entrypoint.endsWith(".ts")
    ? ["node", "--experimental-strip-types", input.entrypoint]
    : ["node", input.entrypoint];
  input.onEvent({ type: "status", data: "Запуск без сети...\n" });
  const code = await runCommand("docker", [
    ...common,
    "--network=none",
    "--cap-drop=ALL",
    "--security-opt",
    "no-new-privileges",
    NODE_IMAGE,
    ...entry,
  ], { timeoutMs: RUN_TIMEOUT_MS, onEvent: input.onEvent });
  input.onEvent({ type: "exit", code });
}
