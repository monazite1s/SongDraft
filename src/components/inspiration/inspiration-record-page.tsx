"use client";

/**
 * 灵感记录页主流程（docs/SPEC.md）：先创建/更新灵感记录，再上传媒体，最后保存到新项目或已有项目。
 */
import { AudioLines, Check, ChevronDown, FileText, Image as ImageIcon, Lightbulb, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { InspirationSnapshot } from "@/modules/inspirations/inspiration-schema";
import type { ProjectListPage } from "@/modules/projects/project-types";
import { cn } from "@/lib/utils";
import { InspirationMediaCapture, type CapturedMedia } from "./inspiration-media-capture";

type CaptureKind = "audio" | "image" | "text";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type RecordResponse = { ok: boolean; data?: { id: string; versionCount: number; projectId?: string | null }; error?: { message?: string } };

const kindTabs = [
  { id: "audio" as const, label: "录音 / 音频", hint: "捕捉旋律、节奏或环境声", icon: AudioLines },
  { id: "image" as const, label: "图片", hint: "留住画面、色彩与氛围", icon: ImageIcon },
  { id: "text" as const, label: "文本", hint: "歌词、故事与制作想法", icon: FileText },
];

const moodOptions = ["治愈", "克制", "明亮", "迷离", "热烈", "怀旧"];

/** 落地页采集流：先拥有灵感 record，再挂载媒体上传。 */
export function InspirationRecordPage() {
  const [kind, setKind] = useState<CaptureKind>("audio");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [textType, setTextType] = useState<"lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other">("lyric");
  const [moods, setMoods] = useState<string[]>([]);
  const [speedFeel, setSpeedFeel] = useState<"slow" | "medium" | "fast" | "unknown">("unknown");
  const [soundHints, setSoundHints] = useState("");
  const [referenceWorks, setReferenceWorks] = useState("");
  const [note, setNote] = useState("");
  const [assets, setAssets] = useState<CapturedMedia[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [destination, setDestination] = useState<"new_project" | "existing_project">("new_project");
  const [projectTitle, setProjectTitle] = useState("");
  const [projects, setProjects] = useState<ProjectListPage["items"]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const snapshot = useMemo<InspirationSnapshot | null>(() => {
    const common = { primaryKind: kind, title, tags: moods } as const;
    if (kind === "text") {
      if (!text.trim()) return null;
      return { ...common, primaryKind: "text", text: { inspirationType: textType, content: text, moods, speedFeel, soundHints, referenceWorks, advanced: {} } };
    }
    if (kind === "audio") {
      if (!assets.length) return null;
      return { ...common, primaryKind: "audio", audio: { note, items: assets.map((asset) => ({ assetId: asset.id, label: asset.label, note, role: "other" })) } };
    }
    if (!assets.length) return null;
    return { ...common, primaryKind: "image", image: { note, assetIds: assets.map((asset) => asset.id), moods } };
  }, [assets, kind, moods, note, referenceWorks, soundHints, speedFeel, text, textType, title]);

  useEffect(() => {
    // Tabs represent separate drafts; never overwrite a saved audio record with text.
    setRecordId(null);
    setAssets([]);
    setStatus("idle");
    setMessage("");
  }, [kind]);

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
    const nextAssets = [...assets, asset];
    setAssets(nextAssets);
    // State has not committed yet, so construct the next valid snapshot explicitly.
    const nextSnapshot: InspirationSnapshot = kind === "audio"
      ? { primaryKind: "audio", title, tags: moods, audio: { note, items: nextAssets.map((item) => ({ assetId: item.id, label: item.label, note, role: "other" })) } }
      : { primaryKind: "image", title, tags: moods, image: { note, assetIds: nextAssets.map((item) => item.id), moods } };
    setStatus("saving");
    try {
      await request(`/api/inspirations/${recordId}/autosave`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot: nextSnapshot, reason: "autosave" }) });
      setStatus("saved");
      setMessage("素材已保存");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "素材已上传，但记录保存失败");
    }
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
  const mediaRecordId = kind === "text" ? null : recordId;

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand"><Lightbulb className="size-4" /><span className="text-sm font-medium">灵感记录</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">先把这一刻留下来</h1>
            <p className="mt-2 text-sm text-muted-foreground">记录完成后再决定放进哪个项目；每一次有效改动都会自动沉淀为版本。</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className={cn("size-2 rounded-full", status === "error" ? "bg-destructive" : status === "saved" ? "bg-success" : "bg-muted-foreground/40")} />{status === "saving" ? "正在保存" : status === "saved" ? "已自动保存" : "私有草稿"}</div>
        </header>

        <section className="mt-7 overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div role="tablist" aria-label="灵感类型" className="grid grid-cols-3 border-b border-border">
            {kindTabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === kind;
              return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => selectKind(tab.id)} className={cn("flex min-h-20 items-center justify-center gap-2 border-r border-border px-3 text-sm transition-colors last:border-r-0", active ? "bg-brand-muted text-foreground" : "bg-card text-muted-foreground hover:bg-muted/60")}><Icon className="size-4" /><span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.id === "audio" ? "音频" : tab.id === "image" ? "图片" : "文本"}</span></button>;
            })}
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">{kindTabs.find((tab) => tab.id === kind)?.label}</h2><p className="mt-1 text-sm text-muted-foreground">{kindTabs.find((tab) => tab.id === kind)?.hint}</p></div><label className="hidden text-xs text-muted-foreground sm:block">标题（可选）<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="给这条灵感起个名字" className="ml-2 w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></label></div>

            {kind === "text" && <TextCapture text={text} setText={setText} textType={textType} setTextType={setTextType} moods={moods} setMoods={setMoods} speedFeel={speedFeel} setSpeedFeel={setSpeedFeel} soundHints={soundHints} setSoundHints={setSoundHints} referenceWorks={referenceWorks} setReferenceWorks={setReferenceWorks} />}
            {kind !== "text" && <MediaCapture kind={kind} recordId={mediaRecordId} note={note} setNote={setNote} assets={assets} onPrepare={ensureMediaDraft} onUploaded={handleMediaUploaded} />}
          </div>

          <footer className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p role="status" className={cn("text-sm", status === "error" ? "text-destructive" : "text-muted-foreground")}>{message || "灵感仅自己可见，保存到项目后才能进入制作台。"}</p><div className="flex gap-2"><button type="button" onClick={() => void persistCurrent()} className="min-h-10 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground hover:bg-muted">保存记录</button><button type="button" disabled={!snapshot} onClick={() => void openSavePanel()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" />保存到项目</button></div></footer>
        </section>
      </div>
      {savePanelOpen && <ProjectSavePanel destination={destination} setDestination={setDestination} projectTitle={projectTitle} setProjectTitle={setProjectTitle} projects={projects} selectedProjectId={selectedProjectId} setSelectedProjectId={setSelectedProjectId} onClose={() => setSavePanelOpen(false)} onConfirm={attachToProject} />}
    </main>
  );
}

function MediaCapture({ kind, recordId, note, setNote, assets, onPrepare, onUploaded }: { kind: "audio" | "image"; recordId: string | null; note: string; setNote: (value: string) => void; assets: CapturedMedia[]; onPrepare: () => Promise<string>; onUploaded: (asset: CapturedMedia) => void }) {
  const [preparedId, setPreparedId] = useState<string | null>(recordId);
  useEffect(() => setPreparedId(recordId), [recordId]);
  async function prepare() { setPreparedId(await onPrepare()); }
  return <div className="space-y-4"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={kind === "audio" ? "这段旋律像什么？可以标注副歌、节奏或想保留的声音。" : "写下图片带来的画面、色彩或情绪。"} className="min-h-24 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" />{preparedId ? <InspirationMediaCapture recordId={preparedId} kind={kind} onUploaded={onUploaded} /> : <button type="button" onClick={() => void prepare()} className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-sm font-medium text-foreground hover:bg-muted"><Sparkles className="size-5 text-brand" />准备{kind === "audio" ? "录音 / 上传" : "图片上传"}</button>}{assets.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <div key={asset.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">{kind === "image" ? <img src={asset.previewUrl} alt="已上传的图片灵感" className="size-12 rounded object-cover" /> : <AudioLines className="size-5 text-brand" />}<p className="min-w-0 truncate text-sm">{asset.label}</p><Check className="ml-auto size-4 text-success" /></div>)}</div>}</div>;
}

function TextCapture(props: { text: string; setText: (value: string) => void; textType: "lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other"; setTextType: (value: "lyric" | "concept" | "story" | "melody_note" | "arrangement" | "other") => void; moods: string[]; setMoods: (value: string[]) => void; speedFeel: "slow" | "medium" | "fast" | "unknown"; setSpeedFeel: (value: "slow" | "medium" | "fast" | "unknown") => void; soundHints: string; setSoundHints: (value: string) => void; referenceWorks: string; setReferenceWorks: (value: string) => void }) {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">记录类型<select value={props.textType} onChange={(event) => props.setTextType(event.target.value as typeof props.textType)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"><option value="lyric">歌词片段</option><option value="concept">创作概念</option><option value="story">故事 / 场景</option><option value="melody_note">旋律笔记</option><option value="arrangement">编曲想法</option><option value="other">其他</option></select></label><div><p className="text-sm font-medium">速度感觉</p><div className="mt-2 flex flex-wrap gap-2">{(["unknown", "slow", "medium", "fast"] as const).map((value) => <button key={value} type="button" onClick={() => props.setSpeedFeel(value)} className={cn("rounded-md border px-3 py-2 text-xs", props.speedFeel === value ? "border-brand bg-brand-muted text-foreground" : "border-border text-muted-foreground")}>{({ unknown: "未确定", slow: "慢", medium: "中", fast: "快" })[value]}</button>)}</div></div></div><textarea value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={5000} placeholder="写下歌词、一个画面、想要的情绪，或任何稍纵即逝的想法…" className="min-h-56 w-full resize-y rounded-lg border border-input bg-background p-4 text-base leading-7 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" /><div><p className="text-sm font-medium">情绪标签</p><div className="mt-2 flex flex-wrap gap-2">{moodOptions.map((mood) => <button key={mood} type="button" onClick={() => props.setMoods(props.moods.includes(mood) ? props.moods.filter((item) => item !== mood) : [...props.moods, mood])} className={cn("rounded-full border px-3 py-1.5 text-xs", props.moods.includes(mood) ? "border-brand bg-brand-muted text-foreground" : "border-border text-muted-foreground")}>{mood}</button>)}</div></div><details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">补充音乐线索（可选）</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={props.soundHints} onChange={(event) => props.setSoundHints(event.target.value)} maxLength={500} placeholder="音色、乐器、节奏…" className="h-10 rounded-md border border-input px-3 text-sm" /><input value={props.referenceWorks} onChange={(event) => props.setReferenceWorks(event.target.value)} maxLength={500} placeholder="参考作品或艺术家…" className="h-10 rounded-md border border-input px-3 text-sm" /></div></details></div>;
}

function ProjectSavePanel(props: { destination: "new_project" | "existing_project"; setDestination: (value: "new_project" | "existing_project") => void; projectTitle: string; setProjectTitle: (value: string) => void; projects: ProjectListPage["items"]; selectedProjectId: string; setSelectedProjectId: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="保存到项目"><section className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-base font-semibold">保存到项目</h2><p className="mt-1 text-sm text-muted-foreground">选择一个已有项目，或以这条灵感新建项目。</p></div><button type="button" onClick={props.onClose} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="关闭">×</button></div><div className="mt-5 grid grid-cols-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => props.setDestination("new_project")} className={cn("rounded-md py-2 text-sm", props.destination === "new_project" && "bg-card font-medium shadow-sm")}>新建项目</button><button type="button" onClick={() => props.setDestination("existing_project")} className={cn("rounded-md py-2 text-sm", props.destination === "existing_project" && "bg-card font-medium shadow-sm")}>已有项目</button></div>{props.destination === "new_project" ? <label className="mt-4 block text-sm font-medium">项目名称<input value={props.projectTitle} onChange={(event) => props.setProjectTitle(event.target.value)} maxLength={80} className="mt-2 h-10 w-full rounded-lg border border-input px-3 text-sm font-normal" /></label> : <label className="mt-4 block text-sm font-medium">选择项目<select value={props.selectedProjectId} onChange={(event) => props.setSelectedProjectId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input px-3 text-sm font-normal"><option value="">请选择</option>{props.projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>}<button type="button" onClick={props.onConfirm} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground">进入制作台<ChevronDown className="size-4 -rotate-90" /></button></section></div>;
}
