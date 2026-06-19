import type { CodeSyncKind } from "src/models/code-sync-state";
import type { CodeSystem } from "src/models/code-entry";
import { prisma } from "src/config/prisma";

export const CodeSyncService = {
  async get(system: CodeSystem, kind: CodeSyncKind) {
    return prisma.codeSyncState.findFirst({
      where: { system, kind },
    });
  },

  async upsert(input: {
    system: CodeSystem;
    kind: CodeSyncKind;
    version: string;
    lastSyncedAt?: Date | null;
  }) {
    return prisma.codeSyncState.upsert({
      where: { system_kind: { system: input.system, kind: input.kind } },
      create: {
        system: input.system,
        kind: input.kind,
        version: input.version,
        lastSyncedAt: input.lastSyncedAt ?? null,
      },
      update: {
        version: input.version,
        lastSyncedAt: input.lastSyncedAt ?? null,
      },
    });
  },
};
