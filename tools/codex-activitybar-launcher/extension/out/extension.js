"use strict";

const vscode = require("vscode");

class EmptyTreeProvider {
  getChildren() {
    return [];
  }

  getTreeItem(item) {
    return item;
  }
}

async function runCodexCommand(command) {
  try {
    await vscode.commands.executeCommand(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `Codex command failed: ${message}. Make sure the official OpenAI Codex extension is installed and enabled.`
    );
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "codexLauncher.home",
      new EmptyTreeProvider()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codexLauncher.openCodex", async () => {
      await runCodexCommand("chatgpt.openSidebar");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codexLauncher.newAgent", async () => {
      await runCodexCommand("chatgpt.newCodexPanel");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codexLauncher.openMenu", async () => {
      await runCodexCommand("chatgpt.openCommandMenu");
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
