export const onSigIntOrTerm = (stop: () => void): void => {
  const sigHandler = () =>
    process.nextTick(() => {
      process.off("SIGINT", sigHandler);
      process.off("SIGTERM", sigHandler);

      stop();
    });

  process.on("SIGINT", sigHandler);
  process.on("SIGTERM", sigHandler);
};
