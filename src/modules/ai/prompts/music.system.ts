/**
 * 音乐阶段 system prompt 前缀（喂给 MiniMax music-2.6 的浓缩创作指令）。
 *
 * buildMusicPrompt 会把本常量 + 素材角色 + theme/description/genre/tempo/emotion/extraPrompt
 * 用逗号拼接后截断到 2000 字内，作为 MiniMax 的 prompt 字段。
 *
 * MiniMax music-2.6 支持 14 个结构标签（见 docs/requirements.md P0-08），prompt 应：
 *  - 充分利用结构标签引导曲式；
 *  - 用风格/情绪/编曲关键词（而非长句）下达指令；
 *  - 2000 字内高质量浓缩，给主歌/副歌层次与记忆点留指令空间。
 *
 * 注意：此处只写「如何驱动 MiniMax」的指令性描述；具体主题/歌词由 lyrics 字段单独传入，
 * 主题/曲风由 buildMusicPrompt 的其余参数拼入。
 */
export const MUSIC_SYSTEM_PROMPT = `将已确认歌词生成为结构完整、旋律清晰、适合传播的中文歌曲 Demo。曲式建议使用 [intro]/[verse]/[pre_chorus]/[chorus]/[bridge]/[outro]/[instrumental]/[drop]/[break]/[build_up]/[solo]/[hook]/[refrain]/[fade_out] 等结构标签引导编曲走向。副歌需有清晰记忆点与一次情绪抬升，主歌铺垫克制；用简洁的音乐关键词描述风格、情绪与配器（如 Dream Pop/温暖合成 Pad/轻拨吉他/84 BPM），避免长句指令`;
