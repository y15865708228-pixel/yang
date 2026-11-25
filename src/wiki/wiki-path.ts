import { App, normalizePath, TFile } from "obsidian";
import type { ParaWavesSettings } from "../types";

export function isWikiFile(path: string, wikiPath: string): boolean {
  if (!wikiPath.trim()) return false;
  const folder = normalizePath(wikiPath).replace(/\/+$/, "");
  const file = normalizePath(path);
  return folder.length > 0 && file.startsWith(folder + "/") && !file.split("/").includes("..");
}

// Vault files can move while an earlier read or network request is pending.
export class WikiReadBatch {
  private readonly originalPaths = new Map<TFile, string>();
  private readonly wikiPath: string;

  constructor(private app: App, private settings: ParaWavesSettings) {
    this.wikiPath = settings.wikiPath;
  }

  read(file: TFile): Promise<string> {
    if (!this.originalPaths.has(file)) this.originalPaths.set(file, file.path);
    this.assertCurrent([file]);
    return this.app.vault.cachedRead(file);
  }

  assertCurrent(files: Iterable<TFile> = this.originalPaths.keys()): void {
    if (this.wikiPath !== this.settings.wikiPath) throw new Error("Wiki 目录已更改，请重试");
    for (const file of files) {
      if (file.path !== this.originalPaths.get(file) || !isWikiFile(file.path, this.wikiPath)
          || this.app.vault.getAbstractFileByPath(file.path) !== file) {
        throw new Error("Wiki 笔记的位置已变化，请重试");
      }
    }
  }
}
