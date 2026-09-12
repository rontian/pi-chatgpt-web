import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerChatGPTCommand } from "./extension/command.js";

export default function piChatGPTWeb(pi: ExtensionAPI) {
  registerChatGPTCommand(pi);
}
