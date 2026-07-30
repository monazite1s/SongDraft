"use client";

/**
 * 灵感记录页主流程（docs/SPEC.md）：先创建/更新灵感记录，再上传媒体，最后保存到新项目或已有项目。
 */
import { AudioLines, Check, ChevronDown, FileText, Image as ImageIcon, Lightbulb, Plus, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { InspirationSnapshot } from "@/modules/inspirations/inspiration-schema";
import type { ProjectListPage } from "@/modules/projects/project-types";
import { DRAFT_KEYS, loadClientDraft, saveClientDraft } from "@/lib/client-draft-store";
import { cn } from "@/lib/utils";
import { InspirationMediaCapture, type CapturedMedia } from "./inspiration-media-capture";

type CaptureKind = "audio" | "image" | "text";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type RecordResponse = { ok: boolean; data?: { id: string; versionCount: number; projectId?: string | null }; error?: { message?: string } };

/** /api/inspirations/enrich 返回的补全字段集合（空缺字段才会被建议）。 */
type Enrichment = {
  title: string | null;
  moods: string[] | null;
  speedFeel: "slow" | "medium" | "fast" | "unknown" | null;
  soundHints: string | null;
  referenceWorks: string | null;
  mode: "real" | "simulated";
};

/**
 * 灵感页会话草稿：同 tab 切到制作台再回来时回填，避免纯 useState 随卸载丢失。
 * 一条灵感 = 一个记录，含 text/audio/image 三个可选槽位；切 tab 只是换录入面板，
 * 底下是同一条记录的不同内容槽位，保存到项目时一次性导入全部已录入内容。
 */
type InspirationSessionDraft = {
  kind: CaptureKind;
  /** 单条灵感记录 id（三槽位共用，不再按类型拆分）。 */
  recordId: string | null;
  audioAssets: CapturedMedia[];
  audioNote: string;
  imageAssets: CapturedMedia[];
  imageNote: string;
  title: string;
  text: string;
  textType: "lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other";
  moods: string[];
  speedFeel: "slow" | "medium" | "fast" | "unknown";
  soundHints: string;
  referenceWorks: string;
};

const kindTabs = [
  { id: "audio" as const, label: "录音 / 音频", hint: "捕捉旋律、节奏或环境声", icon: AudioLines },
  { id: "image" as const, label: "图片", hint: "留住画面、色彩与氛围", icon: ImageIcon },
  { id: "text" as const, label: "文本", hint: "歌词、故事与制作想法", icon: FileText },
];

const moodOptions = ["治愈", "克制", "明亮", "迷离", "热烈", "怀旧"];

/** 落地页采集流：先拥有灵感 record，再挂载媒体上传。 */
export function InspirationRecordPage() {
  const [boot] = useState(() => loadClientDraft<InspirationSessionDraft>(DRAFT_KEYS.inspiration));
  const [kind, setKind] = useState<CaptureKind>(boot?.kind ?? "audio");
  // 单条灵感记录 id：三槽位共用，切 tab 不变。
  const [recordId, setRecordId] = useState<string | null>(boot?.recordId ?? null);
  const [audioAssets, setAudioAssets] = useState<CapturedMedia[]>(boot?.audioAssets ?? []);
  const [audioNote, setAudioNote] = useState(boot?.audioNote ?? "");
  const [imageAssets, setImageAssets] = useState<CapturedMedia[]>(boot?.imageAssets ?? []);
  const [imageNote, setImageNote] = useState(boot?.imageNote ?? "");
  const [title, setTitle] = useState(boot?.title ?? "");
  const [text, setText] = useState(boot?.text ?? "");
  const [textType, setTextType] = useState<"lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other">(boot?.textType ?? "lyric");
  const [moods, setMoods] = useState<string[]>(boot?.moods ?? []);
  const [speedFeel, setSpeedFeel] = useState<"slow" | "medium" | "fast" | "unknown">(boot?.speedFeel ?? "unknown");
  const [soundHints, setSoundHints] = useState(boot?.soundHints ?? "");
  const [referenceWorks, setReferenceWorks] = useState(boot?.referenceWorks ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [destination, setDestination] = useState<"new_project" | "existing_project">("new_project");
  const [projectTitle, setProjectTitle] = useState("");
  const [projects, setProjects] = useState<ProjectListPage["items"]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);

  // 当前 tab 对应的 assets / note / recordId（派生值，避免每处都按 kind 三分支判断）。
  const assets = kind === "image" ? imageAssets : audioAssets;
  const note = kind === "image" ? imageNote : audioNote;

  /**
   * 一条灵感 = 一个记录，含 text/audio/image 三个可选槽位。snapshot 收集所有已录入槽位，
   * primaryKind 取当前 tab（若当前 tab 有内容），否则取第一个有内容的槽位。任一槽位有内容即有效。
   */
  const snapshot = useMemo<InspirationSnapshot | null>(() => {
    const slots: Partial<Pick<InspirationSnapshot, "text" | "audio" | "image">> = {};
    if (text.trim()) slots.text = { inspirationType: textType, content: text, moods, speedFeel, soundHints, referenceWorks, advanced: {} };
    if (audioAssets.length) slots.audio = { note: audioNote, items: audioAssets.map((asset) => ({ assetId: asset.id, label: asset.label, note: audioNote, role: "other" as const })) };
    if (imageAssets.length) slots.image = { note: imageNote, assetIds: imageAssets.map((asset) => asset.id), moods };
    const present: InspirationSnapshot["primaryKind"][] = [];
    if (slots.text) present.push("text");
    if (slots.audio) present.push("audio");
    if (slots.image) present.push("image");
    if (present.length === 0) return null;
    const primaryKind = present.includes(kind) ? kind : present[0]!;
    return { primaryKind, title, tags: moods, ...slots };
  }, [audioAssets, audioNote, imageAssets, imageNote, kind, moods, referenceWorks, soundHints, speedFeel, text, textType, title]);

  // 切换 tab 只改 kind，不清空任何已录入内容（三槽位同属一条记录）。

  /** 调用 AI 补全：把当前表单拼成 snapshot 发给后端，返回空缺字段的建议值。 */
  async function runEnrich() {
    // 表单尚未构成有效 snapshot（无实质内容）时，构造一个最小输入也接受——补全主要服务于标题等空缺字段。
    const inputSnapshot: InspirationSnapshot = kind === "text"
      ? { primaryKind: "text", title, tags: moods, text: { inspirationType: textType, content: text, moods, speedFeel, soundHints, referenceWorks, advanced: {} } }
      : kind === "audio"
        ? { primaryKind: "audio", title, tags: moods, audio: { note: audioNote, items: audioAssets.length ? audioAssets.map((asset) => ({ assetId: asset.id, label: asset.label, note: audioNote, role: "other" as const })) : [{ assetId: "00000000-0000-0000-0000-000000000000", label: audioNote || "音频灵感", note: audioNote, role: "other" as const }] } }
        : { primaryKind: "image", title, tags: moods, image: { note: imageNote, assetIds: imageAssets.length ? imageAssets.map((asset) => asset.id) : ["00000000-0000-0000-0000-000000000000"], moods } };
    setEnriching(true);
    setEnrichError("");
    try {
      const response = await fetch("/api/inspirations/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: inputSnapshot }),
      });
      const body = await response.json() as { ok: boolean; data?: Enrichment; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "AI 补全失败，请重试");
      setEnrichment(body.data);
      applyEnrichment(body.data);
    } catch (error) {
      setEnrichError(error instanceof Error ? error.message : "AI 补全失败，请重试");
    } finally {
      setEnriching(false);
    }
  }

  /** 把补全字段回填到表单（仅空缺字段，不覆盖用户已填）。 */
  function applyEnrichment(next: Enrichment) {
    if (next.title && !title.trim()) setTitle(next.title);
    if (next.moods?.length) {
      const merged = Array.from(new Set([...moods, ...next.moods])).slice(0, 11);
      setMoods(merged);
    }
    if (next.speedFeel && next.speedFeel !== "unknown" && speedFeel === "unknown") setSpeedFeel(next.speedFeel);
    if (next.soundHints && !soundHints.trim()) setSoundHints(next.soundHints);
    if (next.referenceWorks && !referenceWorks.trim()) setReferenceWorks(next.referenceWorks);
  }

  // 仅写入外部存储；跳过首次 effect，避免 SSR 空初值覆盖已有会话草稿。
  const skipPersist = useRef(true);
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    saveClientDraft(DRAFT_KEYS.inspiration, {
      kind,
      recordId,
      audioAssets,
      audioNote,
      imageAssets,
      imageNote,
      title,
      text,
      textType,
      moods,
      speedFeel,
      soundHints,
      referenceWorks,
    } satisfies InspirationSessionDraft);
  }, [kind, recordId, audioAssets, audioNote, imageAssets, imageNote, title, text, textType, moods, speedFeel, soundHints, referenceWorks]);

  useEffect(() => {
    if (!recordId || !snapshot) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setStatus("saving");
          const response = await fetch(`/api/inspirations/${recordId}/autosave`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ snapshot, reason: "autosave" }),
          });
          if (!response.ok) throw new Error("autosave_failed");
          setStatus("saved");
        } catch {
          setStatus("error");
          setMessage("自动保存失败，请手动重试");
        }
      })();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [recordId, snapshot]);

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = await response.json() as { ok: boolean; data?: T; error?: { message?: string } };
    if (!response.ok || !body.data) throw new Error(body.error?.message || "操作失败，请重试");
    return body.data;
  }

  async function ensureMediaDraft() {
    if (recordId) return recordId;
    const record = await request<RecordResponse["data"]>("/api/inspirations/drafts", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ primaryKind: kind }),
    });
    if (!record?.id) throw new Error("无法创建灵感草稿");
    setRecordId(record.id);
    return record.id;
  }

  async function persistCurrent() {
    if (!snapshot) { setMessage("请先完成一条有效的灵感记录"); return null; }
    setStatus("saving");
    setMessage("");
    try {
      const record = recordId
        ? await request<{ record: RecordResponse["data"]; versionCreated: boolean }>(`/api/inspirations/${recordId}/autosave`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot, reason: "manual" }) })
        : await request<RecordResponse["data"]>("/api/inspirations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot }) });
      const nextId = record && "record" in record ? record.record?.id : record?.id;
      if (!nextId) throw new Error("保存返回缺少灵感编号");
      setRecordId(nextId);
      setStatus("saved");
      setMessage("已保存为新版本");
      return nextId;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "保存失败，请重试");
      return null;
    }
  }

  async function handleMediaUploaded(asset: CapturedMedia) {
    // 追加到当前 kind 的素材；snapshot 随之变化，由上面的自动保存 effect 用最新 recordId 落库。
    if (kind === "image") setImageAssets((prev) => [...prev, asset]);
    else setAudioAssets((prev) => [...prev, asset]);
    setStatus("saving");
    setMessage("素材已上传，正在保存…");
  }

  async function openSavePanel() {
    const id = await persistCurrent();
    if (!id) return;
    setProjectTitle(title.trim() || "未命名灵感项目");
    setSavePanelOpen(true);
    try {
      const page = await request<ProjectListPage>("/api/projects?page=1&pageSize=48", { method: "GET" });
      setProjects(page.items);
    } catch { /* Existing project selection is optional; new project remains available. */ }
  }

  async function attachToProject() {
    const id = await persistCurrent();
    if (!id) return;
    try {
      const payload = destination === "new_project"
        ? { destination, title: projectTitle.trim() || "未命名灵感项目" }
        : { destination, projectId: selectedProjectId };
      if (destination === "existing_project" && !selectedProjectId) throw new Error("请选择一个已有项目");
      const record = await request<RecordResponse["data"]>(`/api/inspirations/${id}/attach`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setSavePanelOpen(false);
      setMessage("已保存到项目，可以继续制作 Demo");
      if (record?.projectId) window.location.assign(`/create/${record.projectId}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存到项目失败"); }
  }

  function selectKind(next: CaptureKind) { setKind(next); }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand"><Lightbulb className="size-4" /><span className="text-sm font-medium">灵感记录</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">先把这一刻留下来</h1>
            <p className="mt-2 text-sm text-muted-foreground">记录完成后再决定放进哪个项目；每一次有效改动都会自动沉淀为版本。</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className={cn("size-2 rounded-full", status === "error" ? "bg-destructive" : status === "saved" ? "bg-success" : "bg-muted-foreground/40")} />{status === "saving" ? "正在保存" : status === "saved" ? "已自动保存" : "私有草稿"}</div>
        </header>

        <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:mt-6">
          {/* pill 风格 tab：参照 material-panel TABS（flex gap-1 + 每项 rounded-lg border + 选中 shadow + 指示点）。 */}
          <div role="tablist" aria-label="灵感类型" className="flex gap-1 border-b border-border p-2">
            {kindTabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === kind;
              // 已录入素材数作为选中指示点：文本=是否有内容，音频=音频素材数，图片=图片素材数。
              const count = tab.id === "text" ? (text.trim() ? 1 : 0) : tab.id === "image" ? imageAssets.length : audioAssets.length;
              return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => selectKind(tab.id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors", active ? "border-border bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]" : "border-transparent text-muted-foreground hover:bg-muted")}><Icon className="size-4" /><span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.id === "audio" ? "音频" : tab.id === "image" ? "图片" : "文本"}</span>{count > 0 && <span className="size-1.5 rounded-full bg-brand" aria-label={`已录入 ${count} 项`} />}</button>;
            })}
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{kindTabs.find((tab) => tab.id === kind)?.label}</h2><p className="mt-1 text-sm text-muted-foreground">{kindTabs.find((tab) => tab.id === kind)?.hint}</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void runEnrich()} disabled={enriching || !snapshot} title={!snapshot ? "请先填写有效内容" : undefined} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"><Wand2 className={cn("size-4 text-brand", enriching && "animate-pulse")} />{enriching ? "AI 补全中…" : "AI 补全"}</button><label className="block text-xs text-muted-foreground">标题（可选）<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="给这条灵感起个名字" className="ml-2 w-40 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></label></div></div>

            {/* AI 补全结果提示：显示来源（real/simulated）+ 已补字段；用户可忽略。 */}
            {enrichError && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{enrichError}</p>}
            {enrichment && !enrichError && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-brand-muted/40 px-3 py-2 text-xs text-foreground"><span>已补全空缺字段：</span>{enrichment.title && <span className="rounded bg-background/60 px-1.5 py-0.5">标题</span>}{enrichment.moods && <span className="rounded bg-background/60 px-1.5 py-0.5">情绪</span>}{enrichment.speedFeel && <span className="rounded bg-background/60 px-1.5 py-0.5">速度</span>}{enrichment.soundHints && <span className="rounded bg-background/60 px-1.5 py-0.5">音色</span>}{enrichment.referenceWorks && <span className="rounded bg-background/60 px-1.5 py-0.5">参考</span>}<span className="text-muted-foreground">可继续编辑或忽略</span></div>}

            {kind === "text" && <TextCapture text={text} setText={setText} textType={textType} setTextType={setTextType} moods={moods} setMoods={setMoods} speedFeel={speedFeel} setSpeedFeel={setSpeedFeel} soundHints={soundHints} setSoundHints={setSoundHints} referenceWorks={referenceWorks} setReferenceWorks={setReferenceWorks} />}
            {kind !== "text" && <MediaCapture kind={kind} note={note} setNote={kind === "image" ? setImageNote : setAudioNote} assets={assets} onPrepare={ensureMediaDraft} onUploaded={handleMediaUploaded} />}
          </div>

          <footer className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p role="status" className={cn("text-sm", status === "error" ? "text-destructive" : "text-muted-foreground")}>{message || "灵感仅自己可见，保存到项目后才能进入制作台。"}</p><div className="flex gap-2"><button type="button" onClick={() => void persistCurrent()} disabled={!snapshot} title={!snapshot ? "请先填写有效内容" : undefined} className="min-h-10 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">保存记录</button><button type="button" disabled={!snapshot} onClick={() => void openSavePanel()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" />保存到项目</button></div></footer>
        </section>
      </div>
      {savePanelOpen && <ProjectSavePanel destination={destination} setDestination={setDestination} projectTitle={projectTitle} setProjectTitle={setProjectTitle} projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} onClose={() => setSavePanelOpen(false)} onConfirm={attachToProject} />}
    </main>
  );
}

function MediaCapture({ kind, note, setNote, assets, onPrepare, onUploaded }: { kind: "audio" | "image"; note: string; setNote: (value: string) => void; assets: CapturedMedia[]; onPrepare: () => Promise<string>; onUploaded: (asset: CapturedMedia) => void }) {
  // 上传按钮始终可见：recordId 在上传瞬间由 InspirationMediaCapture 惰性获取（onPrepare→ensureMediaDraft）。
  return <div className="space-y-4"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={kind === "audio" ? "这段旋律像什么？可以标注副歌、节奏或想保留的声音。" : "写下图片带来的画面、色彩或情绪。"} className="min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" /><InspirationMediaCapture kind={kind} prepareRecordId={onPrepare} onUploaded={onUploaded} />{assets.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <div key={asset.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">{kind === "image" ? <>{asset.previewUrl ? <img src={asset.previewUrl} alt="已上传的图片灵感" onError={(event) => { const target = event.currentTarget; target.style.display = "none"; const fallback = target.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = "inline-flex"; }} className="size-12 rounded object-cover" /> : null}<ImageIcon className="hidden size-12 rounded text-muted-foreground" aria-hidden /></> : <AudioLines className="size-5 text-brand" />}<p className="min-w-0 truncate text-sm">{asset.label}</p><Check className="ml-auto size-4 text-success" /></div>)}</div>}</div>;
}

function TextCapture(props: { text: string; setText: (value: string) => void; textType: "lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other"; setTextType: (value: "lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other") => void; moods: string[]; setMoods: (value: string[]) => void; speedFeel: "slow" | "medium" | "fast" | "unknown"; setSpeedFeel: (value: "slow" | "medium" | "fast" | "unknown") => void; soundHints: string; setSoundHints: (value: string) => void; referenceWorks: string; setReferenceWorks: (value: string) => void }) {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">记录类型<select value={props.textType} onChange={(event) => props.setTextType(event.target.value as typeof props.textType)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"><option value="lyric">歌词片段</option><option value="concept">创作概念</option><option value="story">故事 / 场景</option><option value="melody_note">旋律笔记</option><option value="arrangement">编曲想法</option><option value="other">其他</option></select></label><div><p className="text-sm font-medium">速度感觉</p><div className="mt-2 flex flex-wrap gap-2">{(["unknown", "slow", "medium", "fast"] as const).map((value) => <button key={value} type="button" onClick={() => props.setSpeedFeel(value)} className={cn("rounded-md border px-3 py-2 text-xs", props.speedFeel === value ? "border-brand bg-brand-muted text-foreground" : "border-border text-muted-foreground")}>{({ unknown: "未确定", slow: "慢", medium: "中", fast: "快" })[value]}</button>)}</div></div></div><textarea value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={5000} placeholder="写下歌词、一个画面、想要的情绪，或任何稍纵即逝的想法…" className="min-h-56 w-full resize-y rounded-lg border border-input bg-background p-4 text-base leading-7 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" /><div><p className="text-sm font-medium">情绪标签</p><div className="mt-2 flex flex-wrap gap-2">{moodOptions.map((mood) => <button key={mood} type="button" onClick={() => props.setMoods(props.moods.includes(mood) ? props.moods.filter((item) => item !== mood) : [...props.moods, mood])} className={cn("rounded-full border px-3 py-1.5 text-xs", props.moods.includes(mood) ? "border-brand bg-brand-muted text-foreground" : "border-border text-muted-foreground")}>{mood}</button>)}</div></div><details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">补充音乐线索（可选）</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={props.soundHints} onChange={(event) => props.setSoundHints(event.target.value)} maxLength={500} placeholder="音色、乐器、节奏…" className="h-10 rounded-md border border-input px-3 text-sm" /><input value={props.referenceWorks} onChange={(event) => props.setReferenceWorks(event.target.value)} maxLength={500} placeholder="参考作品或艺术家…" className="h-10 rounded-md border border-input px-3 text-sm" /></div></details></div>;
}

function ProjectSavePanel(props: { destination: "new_project" | "existing_project"; setDestination: (value: "new_project" | "existing_project") => void; projectTitle: string; setProjectTitle: (value: string) => void; projects: ProjectListPage["items"]; selectedProjectId: string; setSelectedProjectId: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="保存到项目"><section className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold">保存到项目</h2><p className="mt-1 text-sm text-muted-foreground">选择一个已有项目，或以这条灵感新建项目。</p></div><button type="button" onClick={props.onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="关闭">×</button></div><div className="mt-5 grid grid-cols-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => props.setDestination("new_project")} className={cn("rounded-md py-2 text-sm", props.destination === "new_project" && "bg-card font-medium shadow-sm")}>新建项目</button><button type="button" onClick={() => props.setDestination("existing_project")} className={cn("rounded-md py-2 text-sm", props.destination === "existing_project" && "bg-card font-medium shadow-sm")}>已有项目</button></div>{props.destination === "new_project" ? <label className="mt-4 block text-sm font-medium">项目名称<input value={props.projectTitle} onChange={(event) => props.setProjectTitle(event.target.value)} maxLength={80} className="mt-2 h-10 w-full rounded-lg border border-input px-3 text-sm font-normal" /></label> : <label className="mt-4 block text-sm font-medium">选择项目<select value={props.selectedProjectId} onChange={(event) => props.setSelectedProjectId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input px-3 text-sm font-normal"><option value="">请选择</option>{props.projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>}<button type="button" onClick={props.onConfirm} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground">进入制作台<ChevronDown className="size-4 -rotate-90" /></button></section></div>;
}
