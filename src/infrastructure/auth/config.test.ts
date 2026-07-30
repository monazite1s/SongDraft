import { afterEach, describe, expect, test, vi } from "vitest";

import { getAuthConfigurationError, isMockAuthEnabled, isSelfAuthConfigured } from "./config";

function clearAuthEnvironment() {
  vi.stubEnv("AUTH_MODE", "");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("AUTH_SESSION_SECRET", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("auth configuration (self-rolled)", () => {
  test("uses mock auth for a zero-config development checkout", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");

    expect(isMockAuthEnabled()).toBe(true);
    expect(getAuthConfigurationError()).toBeNull();
  });

  test("respects an explicit non-mock mode and reports missing DATABASE_URL", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "self");

    expect(isMockAuthEnabled()).toBe(false);
    expect(getAuthConfigurationError()).toContain("DATABASE_URL");
  });

  test("reports missing AUTH_SESSION_SECRET when DATABASE_URL is set", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "self");
    vi.stubEnv("DATABASE_URL", "postgres://example/db");

    expect(isSelfAuthConfigured()).toBe(false);
    expect(getAuthConfigurationError()).toContain("AUTH_SESSION_SECRET");
  });

  test("never enables mock auth in production", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "mock");

    expect(isMockAuthEnabled()).toBe(false);
    expect(getAuthConfigurationError()).toContain("认证服务尚未配置");
  });

  test("is configured when both DATABASE_URL and AUTH_SESSION_SECRET are set", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "self");
    vi.stubEnv("DATABASE_URL", "postgres://example/db");
    vi.stubEnv("AUTH_SESSION_SECRET", "some-very-secret-key");

    expect(isSelfAuthConfigured()).toBe(true);
    expect(getAuthConfigurationError()).toBeNull();
  });
});
