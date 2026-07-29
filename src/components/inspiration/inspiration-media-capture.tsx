"use client";

import { FileUp, ImagePlus, LoaderCircle, Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

export type CapturedMedia = {
  id: string;
  kind: "audio" | "image";
  label: string;
  previewUrl: string;
};

type IntentResponse = {
  ok: boolean;
  data?: { uploadId: string; url: string; method: "PUT"; headers: Record<string, string> };
  error?: { message?: string };
};

/** Browser recording/file selection plus the shared intent → PUT → complete flow. */
export function InspirationMediaCapture({
  recordId,
  kind,
  onUploaded,
}: {
  recordId: string;
  kind: "audio" | "image";
  onUploaded: (asset: CapturedMedia) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    setError("");
    const assetId = crypto.randomUUID();
    try {
      const intentResponse = await fetch("/api/uploads/intents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recordId, assetId, kind, filename: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const intent = await intentResponse.json() as IntentResponse;
      if (!intentResponse.ok || !intent.data) throw new Error(intent.error?.message || "无法创建上传任务");

      const putResponse = await fetch(intent.data.url, { method: intent.data.method, headers: intent.data.headers, body: file });
      if (!putResponse.ok) throw new Error("文件上传失败，请检查网络后重试");

      const completeResponse = await fetch(`/api/uploads/${intent.data.uploadId}/complete`, { method: "POST" });
      if (!completeResponse.ok) throw new Error("上传校验失败，请重试");
      onUploaded({ id: assetId, kind, label: file.name, previewUrl: URL.createObjectURL(file) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "上传失败，请重试");
    } finally {
      setIsUploading(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("当前浏览器不支持录音，请上传音频文件");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        if (blob.size) void upload(new File([blob], `灵感录音-${Date.now()}.webm`, { type: blob.type || "audio/webm" }));
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setError("无法取得麦克风权限，请检查浏览器授权");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    recorder.current = null;
    setIsRecording(false);
  }

  const isAudio = kind === "audio";
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
      <input ref={fileInput} type="file" className="sr-only" accept={isAudio ? "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm" : "image/jpeg,image/png,image/webp"} onChange={(event) => void upload(event.target.files?.[0])} />
      {isAudio ? (
        <button type="button" disabled={isUploading} onClick={isRecording ? stopRecording : startRecording} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {isRecording ? <><Square className="size-4" />结束录制</> : <><Mic className="size-4" />开始录音</>}
        </button>
      ) : (
        <button type="button" disabled={isUploading} onClick={() => fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          <ImagePlus className="size-4" />上传图片
        </button>
      )}
      <button type="button" disabled={isUploading} onClick={() => fileInput.current?.click()} className="mx-auto mt-3 flex items-center gap-1.5 text-sm text-brand disabled:text-muted-foreground">
        {isUploading ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
        {isUploading ? "正在上传并校验…" : isAudio ? "或选择本地音频" : "也可从本地选择"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">{isAudio ? "支持 mp3、m4a、wav、webm，最大 20 MB" : "支持 jpg、png、webp，最大 10 MB"}</p>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
