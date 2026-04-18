import { Plugin } from "obsidian";

export default class TestPlugin extends Plugin {
  async onload() {
    console.log("ParaWaves minimal test loaded");
  }
  onunload() {}
}
