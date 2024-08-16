import fs from "node:fs";

import EventEmitter from "events";

export interface Scan extends EventEmitter {
  on(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  on(eventName: "error", listener: (err: Error) => void): this;
  on(eventName: "close", listener: () => void): this;

  off(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  off(eventName: "error", listener: (err: Error) => void): this;
  off(eventName: "close", listener: () => void): this;

  once(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  once(eventName: "error", listener: (err: Error) => void): this;
  once(eventName: "close", listener: () => void): this;

  addEventListener(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  addEventListener(eventName: "error", listener: (err: Error) => void): this;
  addEventListener(eventName: "close", listener: () => void): this;

  removeEventListener(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  removeEventListener(eventName: "error", listener: (err: Error) => void): this;
  removeEventListener(eventName: "close", listener: () => void): this;

  close(): void;
}

class ScanImplementation extends EventEmitter implements Scan {
  private nameStats = new Map<string, fs.Stats>();
  private timer: NodeJS.Timeout | undefined;
  private closed = false;

  constructor(
    public readonly servicesDir: string,
    public readonly pollInterval = 5000,
    private readonly logger = console,
  ) {
    super();

    this.timer = setTimeout(() => this.scan(), 0);
  }

  public close(): void {
    if (!this.closed) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.closed = true;
      this.emit("close");
    }
  }

  private scan(): void {
    this.timer = undefined;

    fs.promises
      .readdir(this.servicesDir)
      .then(
        async (entries) => {
          const nonDots = entries.filter((s) => !s.startsWith("."));
          const dirStatsFound = new Map<string, fs.Stats>();

          await Promise.all(
            nonDots.map((name) =>
              fs.promises.stat(`${this.servicesDir}/${name}`).then(
                (stats) => {
                  if (stats.isDirectory()) {
                    dirStatsFound.set(name, stats);
                  }
                },
                (err) => {
                  this.emit("error", err);
                },
              ),
            ),
          );

          for (const service of this.nameStats.keys()) {
            if (!dirStatsFound.has(service)) {
              this.emit("serviceRemoved", service);
              this.nameStats.delete(service);
            }
          }

          for (const [name, newStats] of dirStatsFound.entries()) {
            const oldStats = this.nameStats.get(name);

            if (oldStats === undefined) {
              this.nameStats.set(name, newStats);
              this.emit("serviceAdded", name);
            } else if (
              oldStats.dev === newStats.dev &&
              oldStats.ino === newStats.ino
            ) {
              // No change
            } else {
              this.nameStats.set(name, newStats);
              this.emit("serviceChanged", name);
            }
          }
        },
        (err) => {
          this.emit(err);
        },
      )
      .finally(() => {
        if (!this.closed) {
          this.timer = setTimeout(() => this.scan(), this.pollInterval);
        }
      });
  }

  addEventListener(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  addEventListener(eventName: "error", listener: (err: Error) => void): this;
  addEventListener(eventName: "close", listener: () => void): this;
  addEventListener(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: any[]) => void,
  ): this {
    return super.addListener(eventName, listener);
  }

  removeEventListener(
    eventName: "serviceAdded" | "serviceChanged" | "serviceRemoved",
    listener: (serviceName: string) => void,
  ): this;
  removeEventListener(eventName: "error", listener: (err: Error) => void): this;
  removeEventListener(eventName: "close", listener: () => void): this;
  removeEventListener(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: any[]) => void,
  ): this {
    return super.removeListener(eventName, listener);
  }
}

export const scan = (
  servicesDir: string,
  pollInterval = 5000,
  logger = console,
): Scan => new ScanImplementation(servicesDir, pollInterval, logger);
