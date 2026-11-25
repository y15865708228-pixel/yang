const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { compileFunction } = require("node:vm");
const { buildSync } = require("esbuild");

// Run the real plugin and its review code against an in-memory Obsidian data file.
const { outputFiles } = buildSync({
  stdin: {
    resolveDir: path.join(__dirname, ".."),
    contents: `
      export { default as Plugin } from "./src/main";
      export { applyReview } from "./src/srs/review-scheduler";
      export { SparksView } from "./src/sparks/SparksView";
    `,
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["obsidian"],
  write: false,
});
const obsidian = {
  Plugin: class {}, PluginSettingTab: class {}, ItemView: class {},
  Modal: class {}, FuzzySuggestModal: class {},
};
const entry = { exports: {} };
compileFunction(outputFiles[0].text, ["module", "exports", "require"])(
  entry, entry.exports, (name) => name === "obsidian" ? obsidian : require(name),
);
const { Plugin, applyReview, SparksView } = entry.exports;

async function openPlugin(initialData) {
  let stored = structuredClone(initialData);
  const plugin = new Plugin();
  plugin.loadData = async () => structuredClone(stored);
  plugin.saveData = async (value) => { stored = structuredClone(value); };
  await plugin.loadSettings();
  return plugin;
}

test("the welcome card requires an initialized vault and a spark, with or without AI", async () => {
  const plugin = await openPlugin(null);
  const view = new SparksView({}, plugin);
  let initialized = false;
  view.app = { vault: { getAbstractFileByPath: () => initialized ? {} : null } };
  function showsStartButton() {
    const buttons = [];
    const container = {
      createDiv() { return this; },
      createEl(tag, options) {
        if (tag === "button") buttons.push(options.cls);
        return this;
      },
      addClass() {},
      addEventListener() {},
    };
    view.renderOnboarding(container);
    return buttons.includes("pw-onboarding-close");
  }
  for (const key of ["", "test-key"]) {
    plugin.settings.llm.apiKey = key;
    await plugin.saveSettings();
    for (initialized of [false, true]) {
      for (const hasSpark of [false, true]) {
        view.sparks = hasSpark ? [{ title: "My first spark" }] : [];
        assert.equal(showsStartButton(), initialized && hasSpark);
      }
    }
  }
});

test("finishing setup preserves reviews, the current index and other saved data", async () => {
  const plugin = await openPlugin({
    inboxPath: "Inbox",
    srsData: {},
    embeddingIndex: { old: { title: "Old" } },
    futureSetting: 7,
  });
  // Simulate a background index update after settings have been loaded.
  const data = await plugin.loadData();
  data.embeddingIndex = { latest: { title: "Latest" } };
  data.inboxPath = "Synced Inbox";
  await plugin.saveData(data);

  await Promise.all([
    applyReview(plugin, "First.md", "First.md", 3),
    plugin.saveSettings({ onboardingCompleted: true }),
    applyReview(plugin, "Second.md", "Second.md", 3),
  ]);
  const saved = await plugin.loadData();
  assert.equal(saved.srsData["First.md"].repetitions, 1);
  assert.equal(saved.srsData["Second.md"].repetitions, 1);
  assert.deepEqual(saved.embeddingIndex, data.embeddingIndex);
  assert.equal(saved.onboardingCompleted, true);
  assert.equal(plugin.settings.onboardingCompleted, true);
  assert.equal(saved.inboxPath, "Synced Inbox");
  assert.equal(saved.futureSetting, 7);
});

test("a first review in an empty vault can be retried after a write error", async () => {
  const plugin = await openPlugin(null);
  const save = plugin.saveData;
  plugin.saveData = async () => { throw new Error("disk full"); };
  await assert.rejects(applyReview(plugin, "First.md", "First.md", 3), /disk full/);
  plugin.saveData = save;
  await applyReview(plugin, "First.md", "First.md", 3);
  const saved = await plugin.loadData();
  assert.equal(saved.srsData["First.md"].repetitions, 1);
});

test("failed onboarding saves leave the welcome card available for retry", async () => {
  const plugin = await openPlugin(null);
  const save = plugin.saveData;
  plugin.saveData = async () => { throw new Error("disk full"); };
  await assert.rejects(plugin.saveSettings({ onboardingCompleted: true }), /disk full/);
  assert.equal(plugin.settings.onboardingCompleted, false);
  plugin.saveData = save;
  await plugin.saveSettings({ onboardingCompleted: true });
  assert.equal((await plugin.loadData()).onboardingCompleted, true);
});

test("clearing the chat key disables the provider during the same session", async () => {
  const plugin = await openPlugin(null);
  plugin.settings.llm = { ...plugin.settings.llm, apiKey: "local-test-key" };
  await plugin.saveSettings();
  assert.ok(plugin.llmProvider);
  plugin.settings.llm.apiKey = "";
  await plugin.saveSettings();
  assert.equal(plugin.llmProvider, null);
});
