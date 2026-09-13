export async function handleOperationalCommand(command, services, notify) {
  if (command.kind === "login") {
    const result = command.action === "confirm" ? await services.confirmLogin() : await services.login();
    return notify(result.detail, result.ok ? "info" : "warning");
  }
  if (command.kind === "logout") {
    const result = await services.logout();
    return notify(result.detail, result.ok ? "info" : "warning");
  }
  if (command.kind === "status") {
    const { health, helper } = await services.statusSummary();
    return notify(
      [
        "pi-chatgpt-web status",
        `transport: ${health.ok ? "ready" : "not ready"}`,
        `detail: ${health.detail ?? "-"}`,
        `helper: ${helper}`,
      ].join("\n"),
      health.ok ? "info" : "warning",
    );
  }
  if (command.kind === "doctor") {
    const result = await services.doctor();
    return notify(JSON.stringify(result, null, 2), result.ok ? "info" : "warning");
  }
  if (command.kind === "ask") {
    if (!command.text) return notify("Usage: /chatgpt ask <request>", "warning");
    const result = await services.ask(command.text);
    if (result.status !== "completed" || !result.text) {
      return notify(`ChatGPT ask did not complete: ${result.status}${result.text ? `\n${result.text}` : ""}`, "warning");
    }
    return notify(result.text, "info");
  }
  return null;
}
