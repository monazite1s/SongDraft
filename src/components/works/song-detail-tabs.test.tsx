import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

// jsdom 未实现 Element.prototype.scrollIntoView —— 注入空实现，避免「定位当前评论」时抛错。
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

import { SongDetailTabs } from "./song-detail-tabs";
import type { OwnerCommentView } from "@/modules/sharing/share-service";

function makeComment(overrides: Partial<OwnerCommentView> & { id: string }): OwnerCommentView {
  return {
    versionId: "v1",
    shareId: null,
    read: false,
    author: "林",
    content: "评论内容",
    atMs: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

type TabsProps = Parameters<typeof SongDetailTabs>[0];

function renderTabs(overrides: Partial<TabsProps> = {}) {
  const props: TabsProps = {
    projectId: "p1",
    versionId: "v1",
    versionNo: 1,
    isMain: true,
    authorName: "林",
    lyrics: "",
    comments: [],
    currentTime: 0,
    hasAudio: true,
    onSeekAndPlay: vi.fn(),
    anchorMs: null,
    onAnchorChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<SongDetailTabs {...props} />);
  return { ...utils, props };
}

test("same-second comments collapse into one timeline group with a single node, sorted by audio time", () => {
  // 21s 有两条评论（发布时间乱序），8s 与 47s 各一条 → 3 个分组节点，按音频时间升序。
  const comments = [
    makeComment({ id: "c-late", atMs: 21_500, content: "人声被盖住了", createdAt: "2026-07-30T01:00:00Z" }),
    makeComment({ id: "c-47", atMs: 47_000, content: "副歌情绪再推", createdAt: "2026-07-30T00:00:00Z" }),
    makeComment({ id: "c-early", atMs: 21_000, content: "旋律很好建议保留", createdAt: "2026-07-30T00:30:00Z" }),
    makeComment({ id: "c-8", atMs: 8_000, content: "前奏可以再短一点", createdAt: "2026-07-30T02:00:00Z" }),
  ];
  renderTabs({ comments });
  fireEvent.click(screen.getByTestId("tab-comments"));

  const timeline = screen.getByTestId("comment-timeline");
  const groups = timeline.querySelectorAll("[data-group-key]");
  expect(groups).toHaveLength(3);
  expect(groups[0]).toHaveAttribute("data-group-key", "t8");
  expect(groups[1]).toHaveAttribute("data-group-key", "t21");
  expect(groups[2]).toHaveAttribute("data-group-key", "t47");

  // t21 分组内两条评论按发布时间升序：早发布的在前。
  const t21 = groups[1] as HTMLElement;
  const items = t21.querySelectorAll("[data-comment-id]");
  expect(items[0]).toHaveAttribute("data-comment-id", "c-early");
  expect(items[1]).toHaveAttribute("data-comment-id", "c-late");
});

test("clicking a timeline node seeks + plays and rebinds the comment anchor to that time", () => {
  const onSeekAndPlay = vi.fn();
  const onAnchorChange = vi.fn();
  renderTabs({
    comments: [makeComment({ id: "c1", atMs: 21_000 })],
    onSeekAndPlay,
    onAnchorChange,
  });
  fireEvent.click(screen.getByTestId("tab-comments"));
  fireEvent.click(screen.getByTestId("timeline-node-t21"));
  expect(onSeekAndPlay).toHaveBeenCalledWith(21);
  expect(onAnchorChange).toHaveBeenCalledWith(21_000);
});

test("send stays disabled without a selected comment time, even with text entered", () => {
  renderTabs({ anchorMs: null, currentTime: 12 });
  fireEvent.click(screen.getByTestId("tab-comments"));

  expect(screen.getByTestId("comment-anchor-empty")).toHaveTextContent("请先在播放器中选择评论时间");
  fireEvent.change(screen.getByPlaceholderText(/请先在播放器中选择评论时间/), { target: { value: "前奏太长" } });
  expect(screen.getByRole("button", { name: /发送/ })).toBeDisabled();
});

test("「评论当前时间」binds the anchor to the current playback position", () => {
  const onAnchorChange = vi.fn();
  renderTabs({ anchorMs: null, currentTime: 32.4, onAnchorChange });
  fireEvent.click(screen.getByTestId("tab-comments"));
  fireEvent.click(screen.getByRole("button", { name: /评论当前时间/ }));
  expect(onAnchorChange).toHaveBeenCalledWith(32_400);
});

test("a selected anchor shows 评论于 mm:ss, does not follow playback, and enables send with text", () => {
  // anchor 固定在 32s，而播放已推进到 55s —— 输入区仍显示 00:32。
  renderTabs({ anchorMs: 32_000, currentTime: 55 });
  fireEvent.click(screen.getByTestId("tab-comments"));

  expect(screen.getByTestId("comment-anchor")).toHaveTextContent("评论于 00:32");
  // 「更新为当前时间」入口存在，显示当前播放位置。
  expect(screen.getByRole("button", { name: /更新为当前时间/ })).toHaveTextContent("00:55");

  const sendButton = screen.getByRole("button", { name: /发送/ });
  expect(sendButton).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText(/输入对当前时刻的修改意见/), { target: { value: "副歌很棒" } });
  expect(sendButton).not.toBeDisabled();
});

test("playback highlights the group whose time range covers currentTime", () => {
  const comments = [
    makeComment({ id: "c-8", atMs: 8_000 }),
    makeComment({ id: "c-21", atMs: 21_000 }),
    makeComment({ id: "c-47", atMs: 47_000 }),
  ];
  // 播放到 30s：高亮 21s 节点（直到 47s 才切换）。
  renderTabs({ comments, currentTime: 30 });
  fireEvent.click(screen.getByTestId("tab-comments"));

  const activeDot = screen.getByTestId("timeline-node-t21").querySelector("span:last-child");
  expect(activeDot?.className).toMatch(/bg-primary/);
  const idleDot = screen.getByTestId("timeline-node-t47").querySelector("span:last-child");
  expect(idleDot?.className).not.toMatch(/bg-primary/);
});

test("empty state shows guidance without a blank timeline", () => {
  renderTabs({ comments: [] });
  fireEvent.click(screen.getByTestId("tab-comments"));
  const empty = screen.getByTestId("comment-timeline-empty");
  expect(empty).toHaveTextContent("还没有时间点评论");
  expect(empty).toHaveTextContent("播放到想讨论的位置，留下第一条意见。");
  expect(screen.queryByTestId("comment-timeline")).not.toBeInTheDocument();
});

test("lyrics tab renders structure tags as muted labels and shows current version", () => {
  renderTabs({
    versionNo: 3,
    lyrics: "[Verse]\n第一段歌词\n\n[Chorus]\n副歌歌词",
    hasAudio: false,
  });
  expect(screen.getByText("Verse")).toBeInTheDocument();
  expect(screen.getByText("Chorus")).toBeInTheDocument();
  expect(screen.getByText("第一段歌词")).toBeInTheDocument();
  expect(screen.getByText(/当前版本 V3/)).toBeInTheDocument();
});
