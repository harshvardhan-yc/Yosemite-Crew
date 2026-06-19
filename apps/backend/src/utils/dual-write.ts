import logger from "./logger";

export const shouldDualWrite = false;
export const isDualWriteStrict = false;

export const handleDualWriteError = (entity: string, err: unknown) => {
  logger.error(`${entity} dual-write failed: ${String(err)}`);
  if (isDualWriteStrict) {
    throw err;
  }
};
