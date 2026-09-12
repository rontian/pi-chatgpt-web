import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseChatGPTCommand } from "./parse-command.js";
import { ChatGPTCommandServices } from "./services.js";
import { PromptController } from "./prompt-controller.js";
import { loadConfig, saveConfig } from "../config/loader.js";
import { listModelKeys, resolveAssistantModel } from "../assistant/model-catalog.js";

const HELP = `pi-chatgpt-web\n\nCommands:\n  /chatgpt help\n  /chatgpt status\n  /chatgpt login\n  /chatgpt logout\n  /chatgpt doctor\n  /chatgpt capabilities\n  /chatgpt ask <request>\n  /chatgpt prompt <request>\n  /chatgpt prompt show|edit|send|retry|inspect\n  /chatgpt config\n  /chatgpt config assistant-model <provider/model|auto>\n  /chatgpt config assistant <on|off>\n  /chatgpt config models`;

export function registerChatGPTCommand(pi: ExtensionAPI) {
  const services = new ChatGPTCommandServices();
  const prompts = new PromptController(pi, services);

  pi.registerCommand("chatgpt", {
    description: "Use ChatGPT Web workflows and inspect pi-chatgpt-web state",
    handler: async (args: string, ctx: ExtensionContext) => {
      const command = parseChatGPTCommand(args ?? "");
      try {
        if (command.kind === "help") return ctx.ui.notify(HELP, "info");

        if (command.kind === "status") {
          const { config, health } = await services.status();
          const resolved = config.assistant.enabled ? resolveAssistantModel(ctx.modelRegistry, config.assistant.model) : null;
          return ctx.ui.notify([
            "pi-chatgpt-web status",
            `transport: ${health.ok ? "ready" : "not ready"}`,
            `detail: ${health.detail ?? "-"}`,
            `helper: ${config.assistant.enabled ? resolved?.key ?? `${config.assistant.model} (unresolved)` : "disabled"}`,
            "real browser validation: deferred",
          ].join("\n"), health.ok ? "info" : "warning");
        }

        if (command.kind === "capabilities") {
          return ctx.ui.notify(JSON.stringify(services.runtime.capabilities.snapshot(), null, 2), "info");
        }

        if (command.kind === "login") {
          return ctx.ui.notify("Run the local P1 login probe (`npm run p1:browser`) from the package checkout. Production browser-driver wiring remains gated by local validation.", "info");
        }

        if (command.kind === "logout") {
          return ctx.ui.notify("Automatic browser-profile reset remains gated by local validation. See docs/research/P1_BROWSER_PROBE_RUNBOOK.md.", "warning");
        }

        if (command.kind === "doctor") {
          const result = await services.doctor();
          return ctx.ui.notify(JSON.stringify({ ...result, capabilities: services.runtime.capabilities.snapshot() }, null, 2), result.ok ? "info" : "warning");
        }

        if (command.kind === "ask") {
          if (!command.text) return ctx.ui.notify("Usage: /chatgpt ask <request>", "warning");
          const result = await services.ask(command.text);
          if (result.status !== "completed" || !result.text) {
            return ctx.ui.notify(`ChatGPT ask did not complete: ${result.status}${result.text ? `\n${result.text}` : ""}`, "warning");
          }
          return ctx.ui.notify(result.text, "info");
        }

        if (command.kind === "prompt") {
          if (command.action === "show") return prompts.show(ctx);
          if (command.action === "edit") return await prompts.edit(ctx);
          if (command.action === "send") return prompts.send(ctx);
          if (command.action === "inspect") return prompts.inspect(ctx);
          if (command.action === "retry") {
            const result = await prompts.retry(ctx);
            if (result.status === "completed" && result.text) ctx.ui.setEditorText(result.text);
            return ctx.ui.notify(result.status === "completed" ? "Prompt regenerated and inserted into the Pi editor." : result.error ?? "Prompt retry failed.", result.status === "completed" ? "info" : "warning");
          }
          const result = await prompts.run(command.text, ctx);
          if (result.status === "completed" && result.text) {
            ctx.ui.setEditorText(result.text);
            return ctx.ui.notify("Prompt generated and inserted into the Pi editor. Use /chatgpt prompt send to execute it.", "info");
          }
          return ctx.ui.notify(result.error ?? "Prompt workflow failed.", "warning");
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

        return ctx.ui.notify(`Unknown /chatgpt subcommand: ${command.tokens.join(" ")}`, "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
