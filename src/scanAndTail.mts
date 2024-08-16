import { fileTail, type FileTail } from "./fileTail.mjs";
import { scan } from "./scan.mjs";

export class ScanAndTail {
  private closer: (() => void) | undefined;

  constructor(
    private readonly servicesDir: string,
    private readonly pollInterval = 5000,
    private readonly logger = console,
  ) {
    const tails = new Map<string, FileTail>();
    const scanner = scan(servicesDir, pollInterval, logger);

    const addHooks = (fileTail: FileTail, svc: string) => {
      fileTail.on("line", (line) => {
        if (line.startsWith("@")) {
          logger.log(
            `${line.substring(0, 25)} ${svc}: ${line.substring(26).trimEnd()}`,
          );
        } else {
          logger.log(`${svc}: ${line.trimEnd()}`);
        }
      });

      fileTail.on("error", (err) => logger.error(`fileTail ${svc} error`, err));

      fileTail.on("close", () => logger.debug(`fileTail ${svc} closed`));
    };

    scanner.on("serviceAdded", (svc) => {
      logger.debug("serviceAdded", svc);
      const tail = fileTail({
        path: `${servicesDir}/${svc}/log/main/current`,
        nLines: 100,
        logger,
      });
      addHooks(tail, svc);
      tails.set(svc, tail);
    });

    scanner.on("serviceChanged", (svc) => {
      logger.debug("serviceChanged", svc);
      tails.get(svc)?.close();
      const tail = fileTail({
        path: `${servicesDir}/${svc}/log/main/current`,
        nLines: 100,
        logger,
      });
      addHooks(tail, svc);
      tails.set(svc, tail);
    });

    scanner.on("serviceRemoved", (svc) => {
      logger.debug("serviceRemoved", svc);
      tails.get(svc)?.close();
      tails.delete(svc);
    });

    scanner.on("error", (err) => logger.error("scan error", err));
    scanner.on("close", () => logger.debug("scan closed"));

    this.closer = () => {
      scanner.close();
      [...tails.values()].forEach((tail) => tail.close());
    };
  }

  public close() {
    this.closer?.();
    this.closer = undefined;
  }
}
