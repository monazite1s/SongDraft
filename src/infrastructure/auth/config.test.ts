import { afterEach, describe, expect, test, vi } from "vitest";

import { getAuthConfigurationError, isMockAuthEnabled } from "./config";

function clearAuthEnvironment() {
  vi.stubEnv("AUTH_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
}

afterEach(() => vi.unstubAllEnvs());

describe("auth configuration", () => {
  test("uses mock auth for a zero-config development checkout", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");

    expect(isMockAuthEnabled()).toBe(true);
    expect(getAuthConfigurationError()).toBeNull();
  });

  test("respects an explicit Supabase mode and reports missing credentials", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_MODE", "supabase");

    expect(isMockAuthEnabled()).toBe(false);
    expect(getAuthConfigurationError()).toContain("Supabase");
  });

  test("never enables mock auth in production", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "mock");

    expect(isMockAuthEnabled()).toBe(false);
    expect(getAuthConfigurationError()).toContain("认证服务尚未配置");
  });

  test("uses configured Supabase by default", () => {
    clearAuthEnvironment();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");

    expect(isMockAuthEnabled()).toBe(false);
    expect(getAuthConfigurationError()).toBeNull();
  });
});
