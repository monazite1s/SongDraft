"use client";

import { Check, ChevronDown, Copy, FileText, ImageIcon, MessageCircle, Music2, Plus, RefreshCw, Share2, Sparkles, Trash2, WandSparkles } from "lucide-react";
import NextImage from "next/image";
import { useMemo, useState } from "react";

import type { ProjectDetail } from "@/modules/projects/project-types";
import type { DemoVersionView, GenerationResult } from "@/modules/generation/generation-types";
import type { AnalysisResultView } from "@/modules/analyzers/analysis-service";
import type { OutputType } from "@/shared/contracts/domain";
import type { OwnerCommentView, OwnerShareView } from "@/modules/sharing/share-service";
import { AssetCapture } from "@/components/inspiration/asset-capture";
import { MockDemoPlayer } from "@/components/audio/mock-demo-player";

const tabs = [{ id: "text", label: "文字与歌词", icon: FileText }, { id: "audio", label: "哼唱与音频", icon: Music2 }, { id: "visual", label: "图片与视频", icon: ImageIcon }] as const;
type Tab = (typeof tabs)[number]["id"];

export function WorkspaceClient({ project }: { project: ProjectDetail }) {
  const [tab, setTab] = useState<Tab>("text");
  const [outputType, setOutputType] = useState<OutputType>("song");
  const [brief, setBrief] = useState({ theme: project.description || "未命名灵感", mood: "温柔、释然", genre: "华语流行", tempo: "92 BPM" });
  const [planConfirmed, setPlanConfirmed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [selected, setSelected] = useState("A");
  const [generationError, setGenerationError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareQr, setShareQr] = useState("");
  const [shareId, setShareId] = useState("");
  const [comments, setComments] = useState<OwnerCommentView[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [shares, setShares] = useState<OwnerShareView[]>([]);
  const [showShares, setShowShares] = useState(false);
  const [shareExpiryDays, setShareExpiryDays] = useState("7");
  const [shareError, setShareError] = useState("");
  const [assets, setAssets] = useState(project.assets);
  const [versions, setVersions] = useState<DemoVersionView[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResultView[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const textAssets = assets.filter((asset) => asset.kind === "text" || asset.kind === "lyrics");
  const audioAssets = assets.filter((asset) => asset.kind === "audio");
  const visualAssets = assets.filter((asset) => asset.kind === "image" || asset.kind === "video");
  const evidence = useMemo(() => textAssets.map((asset) => asset.kind === "lyrics" ? "原始歌词" : "灵感描述").join("、") || "尚未添加素材", [textAssets]);

  async function generate() {
    if (!planConfirmed) return;
    setIsGenerating(true); setGenerationError("");
    try {
      const response = await fetch("/api/generation-jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: project.id, brief, outputType, idempotencyKey: crypto.randomUUID() }) });
      const body = await response.json() as { ok: boolean; data?: GenerationResult; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "生成任务创建失败");
      setResult(body.data);
      setVersions(body.data.candidates.map((candidate, index) => ({ id: candidate.versionId, versionNo: index + 1, title: candidate.title, variation: candidate.variation, isMain: index === 0, createdAt: new Date().toISOString(), executionKind: candidate.executionKind, hasAudio: candidate.hasAudio })));
    } catch (error) { setGenerationError(error instanceof Error ? error.message : "生成任务创建失败"); }
    finally { setIsGenerating(false); }
  }

  async function share() {
    const versionId = versions.find((version) => version.isMain)?.id || result?.candidates[0]?.versionId;
    if (!versionId) { setShareError("请先生成并保存一个 Demo 版本"); return; }
    setShareError("");
    try {
      const expiresAt = shareExpiryDays === "0" ? null : new Date(Date.now() + Number(shareExpiryDays) * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/projects/${project.id}/shares`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionId, allowComments: true, expiresAt }) });
      const body = await response.json() as { ok: boolean; data?: { id: string; token: string }; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message || "创建分享链接失败");
      const url = `${window.location.origin}/s/${body.data.token}`;
      setShareUrl(url);
      setShareId(body.data.id);
      setShares((current) => [{ id: body.data!.id, versionId, allowComments: true, expiresAt, revokedAt: null, createdAt: new Date().toISOString() }, ...current]);
      const QRCode = await import("qrcode");
      setShareQr(await QRCode.toDataURL(url, { width: 176, margin: 1, color: { dark: "#172033", light: "#ffffff" } }));
    } catch (error) { setShareError(error instanceof Error ? error.message : "创建分享链接失败"); }
  }

  async function revokeShare() {
    if (!shareId) return;
    try { const response = await fetch(`/api/shares/${shareId}`, { method: "DELETE" }); if (!response.ok) throw new Error("撤回失败"); setShares((current) => current.map((item) => item.id === shareId ? { ...item, revokedAt: new Date().toISOString() } : item)); setShareUrl(""); setShareQr(""); setShareId(""); }
    catch (error) { setShareError(error instanceof Error ? error.message : "撤回失败"); }
  }

  async function toggleFeedback() {
    if (!showFeedback) { try { const response = await fetch(`/api/projects/${project.id}/comments`); const body = await response.json() as { ok: boolean; data?: OwnerCommentView[] }; if (response.ok && body.data) setComments(body.data); } catch { /* Keep the panel usable with its empty state. */ } }
    setShowFeedback((value) => !value);
  }

  async function toggleShares() {
    if (!showShares) { try { const response = await fetch(`/api/projects/${project.id}/shares`); const body = await response.json() as { ok: boolean; data?: OwnerShareView[] }; if (response.ok && body.data) setShares(body.data); } catch { /* Empty state remains usable if this request fails. */ } }
    setShowShares((value) => !value);
  }

  async function markCommentRead(commentId: string) { const response = await fetch(`/api/comments/${commentId}`, { method: "PATCH" }); if (response.ok) setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, read: true } : comment)); }
  async function deleteComment(commentId: string) { const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" }); if (response.ok) setComments((current) => current.filter((comment) => comment.id !== commentId)); }

  async function setMain(versionId: string) {
    try { const response = await fetch(`/api/projects/${project.id}/versions/${versionId}/main`, { method: "POST" }); if (!response.ok) throw new Error("主版本更新失败"); setVersions((current) => current.map((version) => ({ ...version, isMain: version.id === versionId }))); }
    catch (error) { setGenerationError(error instanceof Error ? error.message : "主版本更新失败"); }
  }

  async function runAnalysis() {
    setIsAnalyzing(true); setAnalysisError("");
    try { const response = await fetch(`/api/projects/${project.id}/analysis`, { method: "POST" }); const body = await response.json() as { ok: boolean; data?: AnalysisResultView[]; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message || "分析失败"); setAnalyses(body.data); }
    catch (error) { setAnalysisError(error instanceof Error ? error.message : "分析失败"); }
    finally { setIsAnalyzing(false); }
  }

  return <main className="mx-auto max-w-[1440px] p-4 lg:p-7">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-medium text-indigo-600">创作工作台 · {project.combination}</p><h1 className="mt-1 text-xl font-semibold text-slate-950">{project.title}</h1></div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">模拟 Provider</span><label className="sr-only" htmlFor="share-expiry">分享有效期</label><select id="share-expiry" value={shareExpiryDays} onChange={(event) => setShareExpiryDays(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600"><option value="0">永不过期</option><option value="1">1 天有效</option><option value="7">7 天有效</option><option value="30">30 天有效</option></select><button type="button" onClick={share} className="icon-button"><Share2 className="size-4" />新建分享</button><button type="button" onClick={() => void toggleShares()} className="icon-button">分享管理</button><button type="button" onClick={() => void toggleFeedback()} className="icon-button"><MessageCircle className="size-4" />反馈</button><a href={`/api/projects/${project.id}/export`} className="icon-button"><ChevronDown className="size-4" />导出创作包</a></div></header>
    {shareError ? <p role="alert" className="mt-3 text-sm text-rose-600">{shareError}</p> : null}{shareUrl ? <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><div className="min-w-0 flex-1"><p className="text-xs font-medium text-indigo-700">已生成可撤回的私密链接</p><p className="mt-1 truncate text-sm text-indigo-800">{shareUrl}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="icon-button"><Copy className="size-4" />复制链接</button><button type="button" onClick={revokeShare} className="icon-button text-rose-600">撤回</button></div></div>{shareQr ? <NextImage src={shareQr} alt="SongDraft 私密分享二维码" width={96} height={96} unoptimized className="size-24 rounded-lg border border-indigo-100 bg-white p-1" /> : null}</div> : null}
    {showShares ? <section className="mt-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="section-kicker">分享管理</p><span className="text-xs text-slate-500">{shares.length} 个链接</span></div>{shares.length ? <div className="mt-3 space-y-2">{shares.map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-sm font-medium text-slate-700">V{versions.find((version) => version.id === item.versionId)?.versionNo || "?"} · {item.allowComments ? "允许评论" : "仅试听"}</p><p className="mt-1 text-xs text-slate-500">创建于 {new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p></div><span className={`rounded-full px-2 py-1 text-xs ${item.revokedAt ? "bg-slate-200 text-slate-600" : item.expiresAt && new Date(item.expiresAt) < new Date() ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{item.revokedAt ? "已撤回" : item.expiresAt && new Date(item.expiresAt) < new Date() ? "已过期" : "有效"}</span></article>)}</div> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">暂未创建分享链接。</p>}</section> : null}
    {showFeedback ? <section className="mt-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="section-kicker">协作反馈</p><span className="text-xs text-slate-500">{comments.length} 条</span></div>{comments.length ? <div className="mt-3 space-y-2">{comments.map((comment) => <article key={comment.id} className={`rounded-lg p-3 ${comment.read ? "bg-slate-50" : "border border-indigo-100 bg-indigo-50/50"}`}><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{comment.author}</span><span className="text-indigo-600">{comment.atMs !== null ? `${Math.floor(comment.atMs / 1000)} 秒 · ` : ""}V{versions.find((version) => version.id === comment.versionId)?.versionNo || "?"}</span></div><p className="mt-1.5 text-sm leading-6 text-slate-600">{comment.content}</p><div className="mt-2 flex gap-2">{!comment.read ? <button type="button" onClick={() => void markCommentRead(comment.id)} className="text-xs font-medium text-indigo-600">标为已读</button> : null}<button type="button" onClick={() => void deleteComment(comment.id)} className="text-xs font-medium text-rose-600">删除</button></div></article>)}</div> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">还没有来自分享页的反馈。</p>}</section> : null}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(300px,1.05fr)_minmax(280px,.9fr)_minmax(320px,1.1fr)]">
      <section className="workspace-panel"><div className="border-b border-slate-100 px-4 pt-3"><div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="素材类型">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-3 text-xs font-medium ${tab === id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}><Icon className="size-3.5" />{label}</button>)}</div></div><div className="p-4">
        {tab === "text" ? <><p className="section-kicker">已保存的原始素材</p>{textAssets.length ? textAssets.map((asset) => <article key={asset.id} className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{asset.kind === "lyrics" ? "原始歌词 · 不会被覆盖" : "创作描述"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{asset.content}</p></article>) : <EmptyAsset label="添加文字或歌词" />}</> : null}
        {tab === "audio" ? <><p className="section-kicker">旋律与节奏参考</p>{audioAssets.map((asset) => <MediaAssetCard key={asset.id} asset={asset} onDeleted={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} />)}<AssetCapture projectId={project.id} kind="audio" onUploaded={(asset) => setAssets((current) => [...current, { ...asset, content: null, included: true }])} /></> : null}
        {tab === "visual" ? <><p className="section-kicker">画面与氛围参考</p>{visualAssets.map((asset) => <MediaAssetCard key={asset.id} asset={asset} onDeleted={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} />)}<AssetCapture projectId={project.id} kind="visual" onUploaded={(asset) => setAssets((current) => [...current, { ...asset, content: null, included: true }])} /></> : null}
        {tab === "text" ? <button type="button" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600"><Plus className="size-4" />添加素材</button> : null}
      </div></section>
      <section className="workspace-panel p-4"><p className="section-kicker">Creative Brief</p><h2 className="mt-1 text-base font-semibold">先确定想表达什么</h2><p className="mt-1 text-xs leading-5 text-slate-500">来源：{evidence}。字段可编辑，保存后将成为本次生成快照。</p><button type="button" disabled={isAnalyzing} onClick={runAnalysis} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 disabled:text-slate-400">{isAnalyzing ? <RefreshCw className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}{isAnalyzing ? "正在分析" : "分析当前素材"}</button>{analysisError ? <p role="alert" className="mt-2 text-xs text-rose-600">{analysisError}</p> : null}{analyses.length ? <div className="mt-3 space-y-2">{analyses.map((analysis) => <article key={analysis.id} className="rounded-xl bg-slate-50 p-2.5"><p className="text-xs font-medium text-slate-700">{analysis.analyzer} · 模拟分析</p><p className="mt-1 text-xs leading-5 text-slate-500">{analysis.summary}</p></article>)}</div> : null}<div className="mt-5 space-y-3">{([['theme', '主题 / 叙事'], ['mood', '情绪'], ['genre', '曲风'], ['tempo', '速度']] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-slate-600">{label}<input value={brief[key]} onChange={(event) => setBrief({ ...brief, [key]: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400" /></label>)}</div><div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-5 text-indigo-800"><b>冲突处理：</b>用户原始歌词与手动编辑优先于自动分析结果。</div></section>
      <section className="workspace-panel p-4"><p className="section-kicker">Generation Plan</p><h2 className="mt-1 text-base font-semibold">生成前的可解释计划</h2><label className="mt-4 block text-xs font-medium text-slate-600">输出类型<select value={outputType} onChange={(event) => { setOutputType(event.target.value as OutputType); setPlanConfirmed(false); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"><option value="song">歌曲 Demo</option><option value="soundtrack">配乐 Demo</option><option value="melody_sketch">旋律草稿</option></select></label><ol className="mt-5 space-y-3">{[{ title: "整理输入", text: `识别 ${project.combination} 组合，提取主题和节奏线索。` }, { title: "生成歌词与结构", text: "Mock 文本分析；真实 DeepSeek 接入后替换。" }, { title: outputType === "song" ? "输出歌曲 Demo" : outputType === "soundtrack" ? "输出配乐 Demo" : "输出旋律草稿", text: "Mock 音乐生成；不冒充外部音乐模型。" }].map((step, index) => <li key={step.title} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">{index + 1}</span><div><p className="text-sm font-medium">{step.title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{step.text}</p></div></li>)}</ol><button type="button" onClick={() => setPlanConfirmed(!planConfirmed)} className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${planConfirmed ? "bg-emerald-50 text-emerald-700" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{planConfirmed ? <><Check className="size-4" />计划已确认</> : "确认本次生成计划"}</button><button type="button" disabled={!planConfirmed || isGenerating} onClick={generate} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300">{isGenerating ? <RefreshCw className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}{isGenerating ? "模拟生成中…" : "生成 2 个候选"}</button>{generationError ? <p role="alert" className="mt-3 text-xs text-rose-600">{generationError}</p> : null}</section>
    </div>
    {result ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 lg:p-5"><div className="flex items-center justify-between"><div><p className="section-kicker">Demo 候选 · 模拟结果</p><h2 className="mt-1 font-semibold">选择一个方向继续打磨</h2></div><button type="button" onClick={generate} className="icon-button"><Sparkles className="size-4" />再次生成</button></div><div className="mt-4 grid gap-3 md:grid-cols-2">{result.candidates.map((candidate, index) => { const name = index === 0 ? "A" : "B"; const version = versions.find((item) => item.id === candidate.versionId); return <article key={candidate.id} className={`rounded-xl border p-4 ${selected === name ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200"}`}><div className="flex items-center justify-between"><span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">候选 {name}</span><span className="text-xs text-amber-700">模拟生成 · 无 Provider 音频</span></div><h3 className="mt-4 font-medium">{candidate.title}</h3><p className="mt-1 text-sm text-slate-500">{brief.genre} · {brief.tempo} · 可在接入音乐 Provider 后生成可下载音频文件。</p><div className="mt-4 flex flex-wrap items-center gap-2"><MockDemoPlayer compact /><button type="button" onClick={() => { setSelected(name); void setMain(candidate.versionId); }} className={`rounded-lg px-3 py-2 text-sm ${version?.isMain ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>{version?.isMain ? "主版本" : "设为主版本"}</button></div></article>; })}</div>{versions.length ? <div className="mt-5 border-t border-slate-100 pt-4"><p className="section-kicker">版本历史</p><div className="mt-2 flex flex-wrap gap-2">{versions.map((version) => <button key={version.id} type="button" onClick={() => void setMain(version.id)} className={`rounded-lg border px-3 py-2 text-xs ${version.isMain ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}>V{version.versionNo} · {version.variation}{version.isMain ? " · 主版本" : ""}</button>)}</div></div> : null}</section> : null}
  </main>;
}

function EmptyAsset({ label }: { label: string }) { return <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center"><p className="text-sm font-medium text-slate-700">{label}</p><p className="mt-1 text-xs leading-5 text-slate-500">先保存文字灵感；音频与视觉素材可在相应 Tab 上传。</p></div>; }

function MediaAssetCard({ asset, onDeleted }: { asset: ProjectDetail["assets"][number]; onDeleted: () => void }) {
  const [previewUrl, setPreviewUrl] = useState(asset.previewUrl || "");
  const [isDeleting, setIsDeleting] = useState(false);
  async function loadPreview() { if (previewUrl) return; const response = await fetch(`/api/inspiration-assets/${asset.id}/download`); const body = await response.json() as { ok: boolean; data?: { url: string } }; if (response.ok && body.data?.url) setPreviewUrl(body.data.url); }
  async function remove() { setIsDeleting(true); try { const response = await fetch(`/api/inspiration-assets/${asset.id}`, { method: "DELETE" }); if (response.ok) onDeleted(); } finally { setIsDeleting(false); } }
  const meta = `${asset.kind === "video" ? "视频" : asset.kind === "image" ? "图片" : "音频"} · ${formatBytes(asset.sizeBytes)} · 已上传`;
  return <article className="mt-3 rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-700">{asset.originalName || "未命名素材"}</p><p className="mt-1 text-xs text-slate-500">{meta}</p></div><button type="button" disabled={isDeleting} onClick={() => void remove()} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600" aria-label="删除素材"><Trash2 className="size-4" /></button></div>{previewUrl ? <div className="mt-3 overflow-hidden rounded-lg bg-white">{asset.kind === "audio" ? <audio controls className="w-full" src={previewUrl} /> : asset.kind === "video" ? <video controls className="max-h-48 w-full" src={previewUrl} /> : <NextImage src={previewUrl} alt={asset.originalName || "视觉素材预览"} width={480} height={240} unoptimized className="max-h-48 w-full object-cover" />}</div> : <button type="button" onClick={() => void loadPreview()} className="mt-3 text-xs font-medium text-indigo-600">加载私有预览</button>}</article>;
}
function formatBytes(value: number | null | undefined) { if (!value) return "大小未知"; return `${(value / 1024 / 1024).toFixed(value >= 1024 * 1024 ? 1 : 2)} MB`; }
