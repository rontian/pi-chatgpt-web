import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseChatGPTCommand } from "./parse-command.js";
import { createDefaultConfig } from "../config/defaults.js";

const HELP = `pi-chatgpt-web\n\nCommands:\n  /chatgpt help\n  /chatgpt status\n  /chatgpt login\n  /chatgpt logout\n  /chatgpt doctor\n  /chatgpt ask <request>\n  /chatgpt prompt <request>\n  /chatgpt prompt show|edit|send|retry|inspect\n  /chatgpt config`;

export function registerChatGPTCommand(pi: ExtensionAPI) {
  pi.registerCommand("chatgpt", {
    description: "Use ChatGPT Web workflows and inspect pi-chatgpt-web state",
    handler: async (args: string, ctx: ExtensionContext) => {
      const command = parseChatGPTCommand(args ?? "");

      if (command.kind === "help") {
        ctx.ui.notify(HELP, "info");
        return;
      }

      if (command.kind === "status") {
        const config = createDefaultConfig();
        ctx.ui.notify(
          [
            "pi-chatgpt-web bootstrap status",
            "runtime: not implemented",
            "transport: browser-owned (planned)",
            `helper model: ${config.assistant.enabled ? "enabled/auto" : "disabled"}`,
            "phase: P0 bootstrap"
          ].join("\n"),
          "info"
        );
        return;
      }

      ctx.ui.notify(
        `/${["chatgpt", ...command.tokens].join(" ")} is planned but not implemented in the bootstrap milestone.`,
        "warning"
      );
    }
  });
}
