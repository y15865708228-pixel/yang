const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { compileFunction } = require("node:vm");
const { buildSync } = require("esbuild");

const { outputFiles } = buildSync({
  entryPoints: [path.join(__dirname, "../src/editor/writing-assist.ts")],
  platform: "node",
  bundle: true,
  format: "cjs",
  external: ["obsidian"],
  write: false,
});
const entry = { exports: {} };
compileFunction(outputFiles[0].text, ["module", "exports", "require"])(
  entry, entry.exports, () => ({ MarkdownView: class {} }),
);
const { formatNote, continueWriting, polishText } = entry.exports;

function openNote() {
  const editor = {
    text: "same same", start: 0, end: 4,
    getValue() { return this.text; },
    setValue(value) { this.text = value; },
    getCursor(side) { return { line: 0, ch: side === "from" ? this.start : this.end }; },
    lineCount() { return 1; },
    getRange(from, to) {
      return this.text.slice(from.ch, to.line > 0 ? this.text.length : to.ch);
    },
    replaceRange(value, from, to = from) {
      this.text = this.text.slice(0, from.ch) + value + this.text.slice(to.ch);
    },
  };
  const workspace = {
    getActiveViewOfType() { return this.activeView; },
    getLeavesOfType() { return this.leaves; },
  };
  const app = { workspace };
  const view = { app, file: { path: "Daily/First.md" }, editor };
  workspace.leaves = [{ view }];
  workspace.activeView = view;
  let reply;
  const provider = { chat: () => new Promise(resolve => { reply = resolve; }) };
  return { app, workspace, view, editor, provider, finish: (value) => reply(value) };
}

test("formatting leaves edits made while the answer was pending intact", async () => {
  const { app, editor, view, provider, finish } = openNote();
  const pending = formatNote(app, editor, view, provider);
  editor.text += " and a new thought";
  finish("Formatted answer.");
  await assert.rejects(pending, /笔记已更新/);
  assert.equal(editor.text, "same same and a new thought");
});

test("formatting refuses a replacement file even if its content matches the original", async () => {
  const { app, editor, view, provider, finish } = openNote();
  const pending = formatNote(app, editor, view, provider);
  view.file = { path: "Daily/Second.md" };
  finish("Formatted answer.");
  await assert.rejects(pending, /切换或关闭/);
  assert.equal(editor.text, "same same");
});

test("selecting the same phrase elsewhere does not move a pending rewrite", async () => {
  const { editor, view, provider, finish } = openNote();
  const pending = polishText(editor, view, provider);
  editor.start = 5;
  editor.end = 9;
  finish("new");
  await assert.rejects(pending, /选区已改变/);
  assert.equal(editor.text, "same same");
});

test("continuation leaves the note alone if the cursor moved", async () => {
  const { app, editor, view, provider, finish } = openNote();
  const pending = continueWriting(app, editor, view, provider);
  editor.end = 9;
  finish("next step");
  await assert.rejects(pending, /光标位置已改变/);
  assert.equal(editor.text, "same same");
});

test("switching to another open note prevents writes to the previous editor", async () => {
  const { editor, view, workspace, provider, finish } = openNote();
  const pending = polishText(editor, view, provider);
  workspace.activeView = { file: { path: "Other.md" } };
  finish("new");
  await assert.rejects(pending, /切换或关闭/);
  assert.equal(editor.text, "same same");
});

test("unchanged targets still accept all three writes, including from the sidebar", async () => {
  const { app, editor, view, workspace, provider, finish } = openNote();
  workspace.activeView = null;
  const rewrite = polishText(editor, view, provider);
  finish("new");
  await rewrite;
  assert.equal(editor.text, "new same");
  const format = formatNote(app, editor, view, provider);
  finish("Formatted.");
  assert.equal(await format, "ok");
  assert.equal(editor.text, "Formatted.");
  editor.start = editor.end = 4;
  const continuation = continueWriting(app, editor, view, provider);
  finish("next step");
  await continuation;
  assert.match(editor.text, /^Form\n\n> \[!tip\].*next step\n\natted\.$/s);
});
