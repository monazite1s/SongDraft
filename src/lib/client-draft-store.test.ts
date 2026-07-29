import { afterEach, expect, test } from "vitest";

import { clearClientDraft, loadClientDraft, resetClientDraftStore, saveClientDraft } from "./client-draft-store";

afterEach(() => {
  resetClientDraftStore();
});

test("saves and restores a client draft from memory and sessionStorage", () => {
  saveClientDraft("songdraft:test", { title: "夜车", text: "副歌要更口语" });
  expect(loadClientDraft<{ title: string; text: string }>("songdraft:test")).toEqual({
    title: "夜车",
    text: "副歌要更口语",
  });
});

test("clearClientDraft removes the key", () => {
  saveClientDraft("songdraft:test", { ok: true });
  clearClientDraft("songdraft:test");
  expect(loadClientDraft("songdraft:test")).toBeNull();
});
