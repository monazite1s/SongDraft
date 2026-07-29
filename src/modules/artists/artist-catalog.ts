import type { ArtistCatalog, ArtistProfile } from "./artist-types";

// TODO(artist-kb): replace this read-only catalog with a local/remote repository.
const ARTISTS: ArtistProfile[] = [
  {
    id: "xingye-cheng",
    name: "星野澄",
    avatarUrl: "/covers/cover-neon-rain.png",
    heroUrl: "/covers/cover-neon-rain.png",
    theme: { primary: "#7c3aed", muted: "#f3e8ff", border: "#d8b4fe", foreground: "#5b21b6", hero: "#6d28d9" },
    genres: ["流行", "梦幻电子", "合唱"],
    events: [
      { id: "debut-5", title: "出道五周年", type: "anniversary", description: "从第一场小剧场到万人舞台的第五年。" },
      { id: "summer-concert", title: "夏日巡演终场", type: "concert", description: "适合全场共同合唱的巡演纪念。" },
    ],
    summary: "温柔坚定的唱作型艺人，舞台常以星光和紫色为视觉线索。",
    fandomName: "澄光",
    slogan: "星河有尽，澄光不散",
  },
  {
    id: "lin-ji",
    name: "林霁",
    avatarUrl: "/covers/cover-dusk.png",
    heroUrl: "/covers/cover-dusk.png",
    theme: { primary: "#e11d48", muted: "#fff1f2", border: "#fda4af", foreground: "#9f1239", hero: "#be123c" },
    genres: ["摇滚", "抒情", "现场合唱"],
    events: [
      { id: "arena-night", title: "首场体育馆演唱会", type: "concert", description: "纪念第一次与大规模观众共同完成现场。" },
      { id: "new-album", title: "新专辑《破晓》回归", type: "comeback", description: "以重新出发和彼此守望为主题。" },
    ],
    summary: "现场感染力强，作品强调成长、勇气与共同奔赴。",
    fandomName: "晴屿",
    slogan: "雨会停，我们在晴处相见",
  },
  {
    id: "shen-xian",
    name: "沈弦",
    avatarUrl: "/covers/cover-paper.png",
    heroUrl: "/covers/cover-paper.png",
    theme: { primary: "#0f766e", muted: "#ecfdf5", border: "#99f6e4", foreground: "#115e59", hero: "#0f766e" },
    genres: ["民谣", "轻流行", "叙事"],
    events: [
      { id: "birthday-letter", title: "生日信箱企划", type: "birthday", description: "把粉丝共同回忆写成一封可以唱出的信。" },
      { id: "song-award", title: "年度原创歌曲获奖", type: "award", description: "纪念坚持原创道路获得的首次肯定。" },
    ],
    summary: "擅长细腻叙事与木吉他表达，适合温暖、真诚的歌词。",
    fandomName: "弦月",
    slogan: "每一次拨弦，都有月光回应",
  },
  {
    id: "jiang-yuguang",
    name: "江予光",
    avatarUrl: "/covers/cover-neon-rain.png",
    heroUrl: "/covers/cover-dusk.png",
    theme: { primary: "#2563eb", muted: "#eff6ff", border: "#93c5fd", foreground: "#1d4ed8", hero: "#1e40af" },
    genres: ["明亮流行", "舞曲", "应援口号"],
    events: [
      { id: "debut-stage", title: "出道舞台纪念日", type: "anniversary", description: "重温第一次亮相时与粉丝许下的约定。" },
      { id: "fan-choice", title: "年度粉丝选择奖", type: "award", description: "感谢彼此共同投下的每一束光。" },
    ],
    summary: "明亮活力的舞台型艺人，歌曲强调简单易唱的记忆点。",
    fandomName: "光点",
    slogan: "你向前走，我们把路照亮",
  },
];

class StaticArtistCatalog implements ArtistCatalog {
  async list() { return ARTISTS.map((artist) => structuredClone(artist)); }
  async findById(id: string) { return ARTISTS.find((artist) => artist.id === id) ? structuredClone(ARTISTS.find((artist) => artist.id === id)!) : null; }
}

const catalog = new StaticArtistCatalog();

export function getArtistCatalog(): ArtistCatalog { return catalog; }
