import { afterEach, expect, test, vi } from "vitest";

import { getArtistCatalog } from "@/modules/artists/artist-catalog";
import { DeepSeekLyricAssistant, MockLyricAssistant } from "./lyric-assistant";

afterEach(() => vi.restoreAllMocks());

test("generates generic lyrics when no artist is selected", async () => {
  const result = await new MockLyricAssistant().createDraft({ projectId: crypto.randomUUID(), artist: null, message: "写一首五周年应援歌", eventIds: [] });
  expect(result.lyrics).toContain("[副歌]");
  expect(result.message).toContain("完整歌词");
});

test("passes recent conversation history to DeepSeek", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ message: "已继续修改", lyrics: "[Verse]\n新歌词", context: { emotion: "克制", singingMode: "solo" } }) } }] }), { status: 200, headers: { "content-type": "application/json" } }));
  await new DeepSeekLyricAssistant("test-key", "https://example.test", "deepseek-v4-flash").createDraft({ projectId: crypto.randomUUID(), artist: null, message: "把副歌再克制一点", eventIds: [], currentLyrics: "旧歌词", history: [{ role: "user", content: "上一轮要更温柔" }, { role: "assistant", content: "已完成第一版" }] });
  const init = request.mock.calls[0]?.[1] as RequestInit;
  const body = JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }> };
  expect(body.messages.map((message) => message.content)).toEqual(expect.arrayContaining(["上一轮要更温柔", "已完成第一版"]));
});

test("uses only selected artist events in the mock lyric", async () => {
  const artist = (await getArtistCatalog().list())[0]!;
  const selected = artist.events[1]!;
  const result = await new MockLyricAssistant().createDraft({ projectId: crypto.randomUUID(), artist, message: "副歌适合合唱", eventIds: [selected.id] });
  expect(result.lyrics).toContain(selected.title);
  expect(result.lyrics).not.toContain(artist.events[0]!.title);
});
