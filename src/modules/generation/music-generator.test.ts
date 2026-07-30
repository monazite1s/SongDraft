import { expect, test } from "vitest";

import { buildMusicRequestBody } from "./music-generator";

const opts = { coverModel: "music-cover-free", textModel: "music-2.6" };

test("有参考音频 → music-cover 体：含 audio_url、prompt 夹在 [10,300]、带歌词", () => {
  const { model, body } = buildMusicRequestBody(
    { prompt: "流行,忧郁,雨夜", lyrics: "[verse]\n街灯微亮晚风轻抚\n影子拉长独自漫步", referenceAudioUrl: "https://cos.example.com/humming.mp3?sign=xxx" },
    opts,
  );
  expect(model).toBe("music-cover-free");
  expect(body.model).toBe("music-cover-free");
  expect(body.audio_url).toBe("https://cos.example.com/humming.mp3?sign=xxx");
  expect(body.output_format).toBe("url");
  // 不应携带互斥字段。
  expect(body.audio_base64).toBeUndefined();
  expect(body.cover_feature_id).toBeUndefined();
  // prompt 处于必填区间。
  const prompt = body.prompt as string;
  expect(prompt.length).toBeGreaterThanOrEqual(10);
  expect(prompt.length).toBeLessThanOrEqual(300);
  // 歌词 ≥10 字 → 带上。
  expect(typeof body.lyrics).toBe("string");
});

test("cover 路径：歌词不足 10 字 → 省略 lyrics，交 MiniMax ASR 提取", () => {
  const { body } = buildMusicRequestBody(
    { prompt: "流行,忧郁,雨夜,独走", lyrics: "短词", referenceAudioUrl: "https://cos.example.com/a.mp3" },
    opts,
  );
  expect(body.lyrics).toBeUndefined();
});

test("cover 路径：超长 prompt 截断到 300；空 prompt 补足到 ≥10", () => {
  const long = "风格".repeat(300);
  const truncated = buildMusicRequestBody({ prompt: long, lyrics: "足够长的歌词内容占位占位占位占位", referenceAudioUrl: "https://cos.example.com/a.mp3" }, opts);
  expect((truncated.body.prompt as string).length).toBeLessThanOrEqual(300);

  const empty = buildMusicRequestBody({ prompt: "", lyrics: "足够长的歌词内容占位占位占位占位", referenceAudioUrl: "https://cos.example.com/a.mp3" }, opts);
  expect((empty.body.prompt as string).length).toBeGreaterThanOrEqual(10);
});

test("无参考音频 → music-2.6 文本体：无 audio_url、保留 lyrics、prompt ≤2000", () => {
  const { model, body } = buildMusicRequestBody(
    { prompt: "流行".repeat(1500), lyrics: "[verse]\n街灯微亮晚风轻抚", referenceAudioUrl: null },
    opts,
  );
  expect(model).toBe("music-2.6");
  expect(body.model).toBe("music-2.6");
  expect(body.audio_url).toBeUndefined();
  expect(typeof body.lyrics).toBe("string");
  expect((body.prompt as string).length).toBeLessThanOrEqual(2000);
  expect(body.output_format).toBe("url");
});
