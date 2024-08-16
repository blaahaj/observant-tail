import { ScanAndTail } from "./scanAndTail.mjs";
import { onSigIntOrTerm } from "./onSigIntOrTerm.mjs";

// Does a "tail -F" of */log/main/current, but paying attention
// to when the set of files matching that glob, changes.

const logger = {
  ...console,
};

const args = process.argv.slice(2);

if (args[0] === "--debug") {
  args.shift();
} else {
  logger.debug = () => undefined;
}

const scanAndTail = new ScanAndTail(args[0] ?? ".", 1000, logger);
onSigIntOrTerm(() => scanAndTail.close());
