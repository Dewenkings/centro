import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync("app/layout.tsx", "utf8");
const pageSource = readFileSync("app/page.tsx", "utf8");
const chatPanelSource = readFileSync("app/components/ChatPanel.tsx", "utf8");

test("mobile shell uses the dynamic viewport instead of fixed 100vh", () => {
  assert.doesNotMatch(layoutSource, /h-screen/);
  assert.doesNotMatch(pageSource, /h-screen/);
  assert.match(layoutSource, /100dvh/);
});

test("mobile input reserves the iOS bottom safe area", () => {
  assert.match(layoutSource, /viewportFit:\s*["']cover["']/);
  assert.match(chatPanelSource, /safe-area-inset-bottom/);
});
