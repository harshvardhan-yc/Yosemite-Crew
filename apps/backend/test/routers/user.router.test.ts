import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());

const UserController = {
  create: jest.fn(),
  getById: jest.fn(),
  deleteById: jest.fn(),
  updateName: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/controllers/web/user.controller", () => ({
  UserController,
}));

const userRouter = jest.requireActual("../../src/routers/user.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (
  path: string,
  method: "get" | "post" | "delete" | "patch",
) => {
  const layer = (
    (userRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("user.router", () => {
  it("protects user lookup with Cognito auth", () => {
    const route = findRoute("/:id", "get");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      UserController.getById,
    ]);
  });

  it("protects user creation with Cognito auth", () => {
    const route = findRoute("/", "post");

    expect(route?.stack.map((layer) => layer.handle)).toEqual([
      authorizeCognito,
      UserController.create,
    ]);
  });
});
