/**
 * 灵感素材采集 UI：录音/选文件 → POST intents → PUT 直传 → POST complete。
 * 必须先完成持久化再关联项目（docs/SPEC.md 灵感记录）。
 */
"use client";

import { FileUp, LoaderCircle, Mic, Square, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

type AssetKind = "audio" | "image" | "video";
type UploadedAsset = { id: string; kind: AssetKind; originalName: string; mimeType: string; sizeBytes: number; objectKey: string; status: "ready"; previewUrl: string };

export function AssetCapture({ projectId, kind, onUploaded }: { projectId: string; kind: AssetKind | "visual"; onUploaded: (asset: UploadedAsset) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  /** intent → 直传 PUT → complete，全部成功后回调 ready 素材。 */
  async function upload(file: File, uploadKind: AssetKind) {
    setIsUploading(true); setError("");
    try {
      const intentResponse = await fetch("/api/uploads/intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, kind: uploadKind, filename: file.name, mimeType: file.type, sizeBytes: file.size }) });
      const intentBody = await intentResponse.json() as { ok: boolean; data?: { uploadId: string; url: string; method: "PUT"; headers: Record<string, string>; objectKey: string }; error?: { message?: string } };
      if (!intentResponse.ok || !intentBody.data) throw new Error(intentBody.error?.message || "无法创建上传任务");
      const putResponse = await fetch(intentBody.data.url, { method: intentBody.data.method, headers: intentBody.data.headers, body: file });
      if (!putResponse.ok) throw new Error("文件上传失败，请检查网络后重试");
      const completeResponse = await fetch(`/api/uploads/${intentBody.data.uploadId}/complete`, { method: "POST" });
      const completeBody = await completeResponse.json() as { ok: boolean; data?: { id: string; status: "ready" }; error?: { message?: string } };
      if (!completeResponse.ok || !completeBody.data) throw new Error(completeBody.error?.message || "上传校验失败");
      onUploaded({ id: completeBody.data.id, kind: uploadKind, originalName: file.name, mimeType: file.type, sizeBytes: file.size, objectKey: intentBody.data.objectKey, status: "ready", previewUrl: URL.createObjectURL(file) });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "上传失败，请重试"); }
    finally { setIsUploading(false); }
  }

  async function selectFile(file: File | undefined) {
    if (!file) return;
    const uploadKind: AssetKind = kind === "visual" ? (file.type.startsWith("video/") ? "video" : "image") : kind;
    await upload(file, uploadKind);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError("当前浏览器不支持录音，请上传音频文件"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }); if (blob.size) void upload(new File([blob], `humming-${Date.now()}.webm`, { type: blob.type || "audio/webm" }), "audio"); };
      recorder.current = mediaRecorder; mediaRecorder.start(); setIsRecording(true); setError("");
    } catch { setError("无法取得麦克风权限，请检查浏览器授权"); }
  }

  function stopRecording() { recorder.current?.stop(); recorder.current = null; setIsRecording(false); }
  const accept = kind === "audio" ? ".mp3,.m4a,.wav,.webm,audio/*" : "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
  return (
    <div className="mt-3 flex aspect-[2/1] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 text-center">
      <input ref={fileInput} onChange={(event) => void selectFile(event.target.files?.[0])} accept={accept} className="sr-only" type="file" />
      {kind === "audio" ? (
        <button
          type="button"
          disabled={isUploading}
          onClick={isRecording ? stopRecording : startRecording}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${isRecording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {isRecording ? <><Square className="size-4" />结束录制</> : <><Mic className="size-4" />录制哼唱</>}
        </button>
      ) : null}
      <button
        type="button"
        disabled={isUploading}
        onClick={() => fileInput.current?.click()}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand disabled:text-muted-foreground"
      >
        {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : kind === "audio" ? <FileUp className="size-4" /> : <UploadCloud className="size-4" />}
        {isUploading ? "上传与校验中…" : kind === "audio" ? "或上传音频文件" : "选择图片或视频"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {kind === "audio" ? "支持 mp3、m4a、wav、webm，最大 20MB" : "图片最大 10MB；视频最大 100MB"}
        </p>
      )}
    </div>
  );
}
