import EventEmitter from "events";
import { spawn } from "node:child_process";
import { TextDecoder } from "util";

export interface FileTail {
  on(eventName: "line", listener: (text: string) => void): unknown;
  on(eventName: "error", listener: (error: unknown) => void): unknown;
  on(eventName: "close", listener: () => void): unknown;

  addEventListener(
    eventName: "line",
    listener: (text: string) => void,
  ): unknown;
  addEventListener(
    eventName: "error",
    listener: (error: unknown) => void,
  ): unknown;
  addEventListener(eventName: "close", listener: () => void): unknown;

  off(eventName: "line", listener: (text: string) => void): unknown;
  off(eventName: "error", listener: (error: unknown) => void): unknown;
  off(eventName: "close", listener: () => void): unknown;

  removeEventListener(
    eventName: "line",
    listener: (text: string) => void,
  ): unknown;
  removeEventListener(
    eventName: "error",
    listener: (error: unknown) => void,
  ): unknown;
  removeEventListener(eventName: "close", listener: () => void): unknown;

  once(eventName: "line", listener: (text: string) => void): unknown;
  once(eventName: "error", listener: (error: unknown) => void): unknown;
  once(eventName: "close", listener: () => void): unknown;

  emit(eventName: "line", text: string): unknown;
  emit(eventName: "error", error: Error): unknown;
  emit(eventName: "close"): unknown;

  close: () => void;
}

export type FileTailOptions = {
  path: string;
  nLines?: number;
  encoding?: string;
  logger?: Console;
};

class FileTailImplementation extends EventEmitter implements FileTail {
  private closer: (() => void) | undefined;

  constructor(opts: FileTailOptions) {
    const { path, nLines, encoding, logger } = {
      nLines: 10,
      encoding: "utf-8",
      logger: console,
      ...opts,
    };

    super();

    const decoder = new TextDecoder(encoding);
    let text = "";

    const childProcess = spawn("tail", ["-F", "-n", `${nLines}`, "--", path], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    const stdout = childProcess.stdout;

    childProcess.on("close", (code, signal) => {
      logger.debug("cp close", code, signal);
      this.emit("close");
    });

    childProcess.on("error", (err) => {
      logger.error("cp error", err);
      this.emit("error", err);
    });

    stdout.on("data", (chunk) => {
      logger.debug("cp stdout data", chunk);
      const t = decoder.decode(chunk, { stream: true });
      text += t;

      while (true) {
        const indexOfNewline = text.indexOf("\n");
        if (indexOfNewline < 0) break;

        this.emit("line", text.substring(0, indexOfNewline + 1));
        text = text.substring(indexOfNewline + 1);
      }
    });

    stdout.on("end", () => {
      logger.debug("cp stdout end");
      text += decoder.decode(Buffer.of());
      if (text !== "") this.emit("line", text);
    });

    stdout.on("error", (err) => {
      logger.debug("cp stdout error", err);
      this.emit("error", err);
    });

    this.closer = () => childProcess.kill("SIGTERM");
  }

  public addEventListener(
    eventName: "line",
    listener: (text: string) => void,
  ): unknown;
  public addEventListener(
    eventName: "error",
    listener: (error: unknown) => void,
  ): unknown;
  public addEventListener(eventName: "close", listener: () => void): unknown;
  public addEventListener(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: any[]) => any,
  ): unknown {
    return super.addListener(eventName, listener);
  }

  public removeEventListener(
    eventName: "line",
    listener: (text: string) => void,
  ): unknown;
  public removeEventListener(
    eventName: "error",
    listener: (error: unknown) => void,
  ): unknown;
  public removeEventListener(eventName: "close", listener: () => void): unknown;

  public removeEventListener(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: any[]) => any,
  ): unknown {
    return super.removeListener(eventName, listener);
  }

  public close() {
    if (this.closer !== undefined) {
      this.closer();
      this.closer = undefined;
    }
  }
}

export const fileTail = (opts: FileTailOptions): FileTail =>
  new FileTailImplementation(opts);
