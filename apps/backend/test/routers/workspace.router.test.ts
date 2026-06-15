import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const WorkspaceController = {
  getAppointmentBootstrap: jest.fn(),
  getEncounterBootstrap: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("src/controllers/web/workspace.controller", () => ({
  WorkspaceController,
}));

const workspaceRouter = jest.requireActual("../../src/routers/workspace.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (workspaceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("workspace.router", () => {
  it("registers the appointment and encounter bootstrap routes", () => {
    const appointmentRoute = findRoute(
      "/organisations/:organisationId/appointments/:appointmentId",
      "get",
    );
    const encounterRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId",
      "get",
    );

    expect(appointmentRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(encounterRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(withOrgPermissions).toHaveBeenCalledTimes(2);
    expect(requirePermission).toHaveBeenCalledTimes(2);
    expect(WorkspaceController.getAppointmentBootstrap).toHaveBeenCalledTimes(
      0,
    );
  });
});
