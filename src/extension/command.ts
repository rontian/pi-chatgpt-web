import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseChatGPTCommand } from "./parse-command.js";
import { ChatGPTCommandServices } from "./services.js";
import { loadConfig, saveConfig } from "../config/loader.js";
import { listModelKeys, resolveAssistantModel } from "../assistant/model-catalog.js";

const HELP = `pi-chatgpt-web\n\nCommands:\n  /chatgpt help\n  /chatgpt status\n  /chatgpt login\n  /chatgpt logout\n  /chatgpt doctor\n  /chatgpt ask <request>\n  /chatgpt prompt <request>\n  /chatgpt prompt show|edit|send|retry|inspect\n  /chatgpt config\n  /chatgpt config assistant-model <provider/model|auto>\n  /chatgpt config assistant <on|off>\n  /chatgpt config models`;

export function registerChatGPTCommand(pi: ExtensionAPI) {
  const services = new ChatGPTCommandServices();

  pi.registerCommand("chatgpt", {
    description: "Use ChatGPT Web workflows and inspect pi-chatgpt-web state",
    handler: async (args: string, ctx: ExtensionContext) => {
      const command = parseChatGPTCommand(args ?? "");
      try {
        if (command.kind === "help") return ctx.ui.notify(HELP, "info");

        if (command.kind === "status") {
          const { config, health } = await services.status();
          const resolved = config.assistant.enabled
            ? resolveAssistantModel(ctx.modelRegistry, config.assistant.model)
            : null;
          return ctx.ui.notify([
            "pi-chatgpt-web status",
            `transport: ${health.ok ? "ready" : "not ready"}`,
            `detail: ${health.detail ?? "-"}`,
            `helper: ${config.assistant.enabled ? resolved?.key ?? `${config.assistant.model} (unresolved)` : "disabled"}`,
            "real browser validation: deferred",
          ].join("\n"), health.ok ? "info" : "warning");
        }

        if (command.kind === "login") {
          return ctx.ui.notify("Browser login is currently validated through the local P1 probe: npm run p1:browser. Production driver wiring remains deferred until that probe passes on this workstation.", "info");
        }

        if (command.kind === "logout") {
          return ctx.ui.notify("Logout/reset is intentionally not automatic before local browser-profile validation. Remove/reset the isolated package profile only after reviewing docs/research/P1_BROWSER_PROBE_RUNBOOK.md.", "warning");
        }

        if (command.kind === "doctor") {
          const result = await services.doctor();
          return ctx.ui.notify(JSON.stringify(result, null, 2), result.ok ? "info" : "warning");
        }

        if (command.kind === "ask") {
          if (!command.text) return ctx.ui.notify("Usage: /chatgpt ask <request>", "warning");
          const result = await services.ask(command.text);
          if (result.status !== "completed" || !result.text) {
            return ctx.ui.notify(`ChatGPT ask did not complete: ${result.status}${result.text ? `\n${result.text}` : ""}`, "warning");
          }
          return ctx.ui.notify(result.text, "info");
        }

        if (command.kind === "config") {
          const config = await loadConfig();
          if (command.action === "show") return ctx.ui.notify(JSON.stringify(config, null, 2), "info");
          if (command.action === "models") {
            const keys = listModelKeys(ctx.modelRegistry);
            return ctx.ui.notify(keys.length ? keys.join("\n") : "No models found in Pi model registry.", keys.length ? "info" : "warning");
          }
          if (command.action === "assistant-model") {
            if (!command.value) return ctx.ui.notify("Usage: /chatgpt config assistant-model <provider/model|auto>", "warning");
            if (command.value !== "auto" && !resolveAssistantModel(ctx.modelRegistry, command.value)) {
              return ctx.ui.notify(`Model is not present in the Pi/OpenCodex registry: ${command.value}`, "warning");
            }
            config.assistant.model = command.value;
            await saveConfig(config);
            return ctx.ui.notify(`Helper model set to ${command.value}`, "info");
          }
          if (command.action === "assistant") {
            if (!command.value || !["on", "off"].includes(command.value)) return ctx.ui.notify("Usage: /chatgpt config assistant <on|off>", "warning");
            config.assistant.enabled = command.value === "on";
            await saveConfig(config);
            return ctx.ui.notify(`Helper model ${config.assistant.enabled ? "enabled" : "disabled"}`, "info");
          }
          return ctx.ui.notify(`Unknown config action: ${command.action}`, "warning");
        }

        if (command.kind === "prompt") {
          return ctx.ui.notify("Prompt workflow is implemented in the next planned phase group.", "info");
        }

        return ctx.ui.notify(`Unknown /chatgpt subcommand: ${command.tokens.join(" ")}`, "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
