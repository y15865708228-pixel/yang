const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { compileFunction } = require("node:vm");
const { buildSync } = require("esbuild");

const { outputFiles } = buildSync({
  stdin: {
    resolveDir: path.join(__dirname, ".."),
    contents: `
      export { default as Plugin } from "./src/main";
      export { createProvider } from "./src/llm/provider";
      export { buildEmbeddingIndex, updateEmbeddingIndex, semanticSearch } from "./src/wiki/embedding-index";
      export { queryWiki } from "./src/wiki/query";
      export { lintWiki } from "./src/wiki/lint";
    `,
  },
  bundle: true, platform: "node", format: "cjs", external: ["obsidian"], write: false,
});
const host = {
  Plugin: class {}, ItemView: class {}, PluginSettingTab: class {}, Modal: class {},
  FuzzySuggestModal: class {}, Notice: class {}, TFile: class {},
  normalizePath: (value) => value.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/|\/$/g, ""),
  requestUrl() { throw new Error("unexpected request"); },
};
const entry = { exports: {} };
compileFunction(outputFiles[0].text, ["module", "exports", "require"])(
  entry, entry.exports, (name) => name === "obsidian" ? host : require(name),
);
const { Plugin, createProvider, buildEmbeddingIndex, updateEmbeddingIndex, semanticSearch, queryWiki, lintWiki } = entry.exports;

async function openVault(data) {
  let stored = structuredClone(data);
  const plugin = new Plugin();
  plugin.loadData = async () => structuredClone(stored);
  plugin.saveData = async (next) => { stored = structuredClone(next); };
  await plugin.loadSettings();
  return plugin;
}

test("0.1.3 provider defaults survive an upgrade and new or cleared settings stay empty", async (t) => {
  const requests = [];
  t.mock.method(host, "requestUrl", async (request) => {
    requests.push(request);
    return { status: 200, json: { data: [{ embedding: [1] }], embeddings: [{ values: [1] }] } };
  });
  for (const [provider, model] of [
    ["openai-compat", "text-embedding-3-small"], ["claude", "text-embedding-3-small"], ["gemini", "text-embedding-004"],
  ]) {
    const llm = { provider, baseURL: "https://chat.example", model: "chat", apiKey: "test-chat" };
    if (provider === "claude") Object.assign(llm, { embeddingBaseURL: "https://vectors.example", embeddingApiKey: "test-vector" });
    const plugin = await openVault({ llm, srsData: { kept: true } });
    assert.equal(plugin.settings.llm.embeddingModel, model);
    await createProvider(plugin.settings.llm).embed(["fixture"]);
    const request = requests.at(-1);
    if (provider === "gemini") assert.ok(request.url.includes("/models/" + model + ":batchEmbedContents"));
    else assert.equal(JSON.parse(request.body).model, model);
    await plugin.saveSettings();
    assert.deepEqual((await plugin.loadData()).srsData, { kept: true });
    plugin.settings.llm.embeddingModel = "";
    await plugin.saveSettings();
    const reopened = await openVault(await plugin.loadData());
    assert.equal(reopened.settings.llm.embeddingModel, "");
    await assert.rejects(createProvider(reopened.settings.llm).embed(["fixture"]), /Embedding 模型/);
  }
  const fresh = await openVault(null);
  fresh.settings.llm.apiKey = "fresh-test-key";
  await fresh.saveSettings();
  assert.equal((await openVault(await fresh.loadData())).settings.llm.embeddingModel, "");
  const explicit = await openVault({ llm: { apiKey: "test", embeddingModel: "chosen-model" } });
  assert.equal(explicit.settings.llm.embeddingModel, "chosen-model");
});

test("embedding credentials respect origin, including protocol and port", async (t) => {
  const requests = [];
  t.mock.method(host, "requestUrl", async (request) => {
    requests.push(request);
    return { status: 200, json: { data: [{ embedding: [1] }] } };
  });
  for (const provider of ["openai-compat", "claude"]) {
    const config = { provider, baseURL: "https://chat.example/api", apiKey: "test-chat", embeddingModel: "chosen" };
    const ai = createProvider(config);
    config.embeddingBaseURL = "https://CHAT.example:443/vector";
    await ai.embed(["fixture"]);
    assert.equal(requests.at(-1).headers.Authorization, "Bearer test-chat");
    for (const url of ["https://vectors.example", "http://chat.example", "https://chat.example:8443"]) {
      config.embeddingBaseURL = url;
      const before = requests.length;
      await assert.rejects(ai.embed(["fixture"]), /Embedding API Key/);
      assert.equal(requests.length, before);
    }
    config.embeddingApiKey = "test-dedicated";
    await ai.embed(["fixture"]);
    assert.equal(requests.at(-1).headers.Authorization, "Bearer test-dedicated");
    delete config.embeddingApiKey;
    config.embeddingBaseURL = "http://localhost:11434/v1";
    await ai.embed(["fixture"]);
    assert.equal(requests.at(-1).headers.Authorization, undefined);
  }
});

test("Wiki indexing, health checks and Q&A exclude a same-prefix sibling and old out-of-folder index entries", async () => {
  const wikiPath = "Notes/Wiki/";
  const allowed = "Notes/Wiki/Sub/Page.md";
  const other = "Notes/Wiki-Private/Personal.md";
  const plugin = await openVault({ wikiPath, embeddingIndex: {
    [other]: { vector: [1], title: "private", updated: "" },
  } });
  const files = [allowed, other].map((filePath) => Object.assign(new host.TFile(), {
    path: filePath, basename: path.posix.basename(filePath, ".md"), stat: { mtime: Date.now() },
  }));
  const app = {
    metadataCache: { getFileCache: () => ({}) },
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (p) => p === "Notes/Wiki" ? {} : files.find((f) => f.path === p),
      cachedRead: async (file) => { assert.equal(file.path, allowed); return "allowed text"; },
    },
  };
  const embeddings = [], prompts = [];
  const ai = {
    embed: async (texts) => { embeddings.push(...texts); return texts.map(() => [1]); },
    chat: async (messages) => { prompts.push(messages[0].content); return "[]"; },
  };
  assert.deepEqual(await semanticSearch("question", ai, plugin), []);
  assert.deepEqual(embeddings, []);
  await queryWiki(app, plugin.settings, ai, "question");
  assert.match(prompts.at(-1), /allowed text/);
  await lintWiki(app, plugin.settings, ai);
  assert.match(prompts.at(-1), /Notes\/Wiki\/Sub\/Page.md/);
  assert.equal(await updateEmbeddingIndex(app, plugin.settings, ai, plugin), 1);
  assert.deepEqual(Object.keys((await plugin.loadData()).embeddingIndex), [allowed]);
  assert.equal(await buildEmbeddingIndex(app, plugin.settings, ai, plugin), 1);
  assert.deepEqual(embeddings, ["allowed text", "allowed text"]);
  await queryWiki(app, plugin.settings, ai, "question", plugin);
  assert.match(prompts.at(-1), /allowed text/);
  assert.ok(prompts.every((prompt) => !prompt.includes("Wiki-Private")));
});

function simulatedWiki(paths, onRead = () => {}) {
  const files = paths.map((filePath) => Object.assign(new host.TFile(), {
    path: filePath, basename: path.posix.basename(filePath, ".md"), stat: { mtime: Date.now() },
  }));
  const app = {
    metadataCache: { getFileCache: () => ({}) },
    vault: {
      getMarkdownFiles: () => files,
      getAbstractFileByPath: (p) => p === "Wiki" ? {} : files.find((f) => f.path === p),
      cachedRead: async (file) => {
        assert.ok(file.path.startsWith("Wiki/"), "read happened outside the configured folder");
        await onRead(file, files);
        return file.basename;
      },
    },
  };
  return { app, files };
}

test("Wiki files moved during a batch read are never sent, including the Q&A index", async () => {
  const operations = [
    (app, plugin, ai) => buildEmbeddingIndex(app, plugin.settings, ai, plugin),
    (app, plugin, ai) => updateEmbeddingIndex(app, plugin.settings, ai, plugin),
    (app, plugin, ai) => lintWiki(app, plugin.settings, ai),
    (app, plugin, ai) => queryWiki(app, plugin.settings, ai, "question"),
  ];
  for (const run of operations) {
    const plugin = await openVault({ wikiPath: "Wiki" });
    const { app } = simulatedWiki(["Wiki/index.md", "Wiki/First.md", "Wiki/Second.md"], (file, files) => {
      if (file.basename === "Second") files[1].path = "Elsewhere/First.md";
    });
    let sent = 0;
    const ai = { chat: async () => { sent++; return "[]"; }, embed: async () => { sent++; return [[1], [1]]; } };
    await assert.rejects(run(app, plugin, ai), /位置已变化/);
    assert.equal(sent, 0);
  }
  const plugin = await openVault({ wikiPath: "Wiki" });
  const { app } = simulatedWiki(["Wiki/index.md", "Wiki/Page.md"], (file, files) => {
    if (file.basename === "Page") files[0].path = "Elsewhere/index.md";
  });
  await assert.rejects(queryWiki(app, plugin.settings, { chat: () => assert.fail("sent a moved index") }, "question"), /位置已变化/);
});

test("index writes recheck file identity and Wiki configuration after asynchronous work", async () => {
  for (const index of [buildEmbeddingIndex, updateEmbeddingIndex]) {
    for (const race of ["move during embedding", "replacement before save", "folder change before save"]) {
      const plugin = await openVault({ wikiPath: "Wiki", embeddingIndex: {} });
      const { app, files } = simulatedWiki(["Wiki/Page.md"]);
      const ai = { embed: async () => {
        if (race === "move during embedding") files[0].path = "Elsewhere/Page.md";
        return [[1]];
      } };
      const update = plugin.updatePluginData.bind(plugin);
      plugin.updatePluginData = (change) => update((data) => {
        if (race === "replacement before save") files[0] = Object.assign(new host.TFile(), files[0]);
        if (race === "folder change before save") plugin.settings.wikiPath = "Elsewhere";
        change(data);
      });
      await assert.rejects(index(app, plugin.settings, ai, plugin), /位置已变化|目录已更改/);
      assert.deepEqual((await plugin.loadData()).embeddingIndex, {});
    }
  }
});
