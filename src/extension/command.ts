import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseChatGPTCommand } from "./parse-command.js";
import { ChatGPTCommandServices } from "./services.js";
import { PromptController } from "./prompt-controller.js";
import { loadConfig, saveConfig } from "../config/loader.js";
import { listModelKeys, resolveAssistantModel } from "../assistant/model-catalog.js";
import { describeAssistantHelper } from "../assistant/pi-adapter.js";
import { handleOperationalCommand } from "../../scripts/p4/command-handler.mjs";

const HELP = `pi-chatgpt-web\n\nCommands:\n  /chatgpt help\n  /chatgpt status\n  /chatgpt login\n  /chatgpt login confirm\n  /chatgpt logout\n  /chatgpt doctor\n  /chatgpt capabilities\n  /chatgpt ask <request>\n  /chatgpt prompt <request>\n  /chatgpt prompt show|edit|send|retry|inspect\n  /chatgpt config\n  /chatgpt config assistant-model <provider/model|auto>\n  /chatgpt config fallback-model <provider/model|none>\n  /chatgpt config assistant <on|off>\n  /chatgpt config models`;

export function registerChatGPTCommand(pi: ExtensionAPI, services = new ChatGPTCommandServices()) {
  const prompts = new PromptController(pi, services);

  pi.registerCommand("chatgpt", {
    description: "Use ChatGPT Web workflows and inspect pi-chatgpt-web state",
    handler: async (args: string, ctx: ExtensionContext) => {
      const command = parseChatGPTCommand(args ?? "");
      try {
        if (command.kind === "help") return ctx.ui.notify(HELP, "info");

        if (command.kind === "status" || command.kind === "login" || command.kind === "logout" || command.kind === "doctor" || command.kind === "ask") {
          const config = command.kind === "status" ? (await loadConfig()) : null;
          const operational = {
            login: () => services.login(),
            confirmLogin: () => services.confirmLogin(),
            logout: () => services.logout(),
            ask: (text: string) => services.ask(text),
            doctor: async () => {
              const result = await services.doctor();
              return { ...result, capabilities: services.runtime.capabilities.snapshot() };
            },
            async statusSummary() {
              const { health } = await services.status();
              return {
                health,
                helper: config ? describeAssistantHelper(config, ctx.modelRegistry) : "disabled",
              };
            },
          };
          return handleOperationalCommand(command, operational, (message, level) => ctx.ui.notify(message, level));
        }

        if (command.kind === "capabilities") {
          return ctx.ui.notify(JSON.stringify(services.runtime.capabilities.snapshot(), null, 2), "info");
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
          if (command.action === "fallback-model") {
            if (!command.value) return ctx.ui.notify("Usage: /chatgpt config fallback-model <provider/model|none>", "warning");
            if (command.value === "none" || command.value === "off") {
              config.assistant.fallbackModel = null;
              await saveConfig(config);
              return ctx.ui.notify("Helper fallback model cleared", "info");
            }
            if (!resolveAssistantModel(ctx.modelRegistry, command.value)) {
              return ctx.ui.notify(`Model is not present in the Pi/OpenCodex registry: ${command.value}`, "warning");
            }
            config.assistant.fallbackModel = command.value;
            await saveConfig(config);
            return ctx.ui.notify(`Helper fallback model set to ${command.value}`, "info");
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
