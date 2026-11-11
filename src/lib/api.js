const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export async function requestAPI(path, body, { signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${BASE}/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data)
      throw new Error(
        data?.error?.message ||
          "This service isn’t connected right now. You can continue with the tools on this device.",
      );
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.name === "AbortError")
      throw new Error(
        "That took too long. Try again or paste the text instead.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "The online service isn’t available. Check your connection, or paste the text instead.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fallback for local or native views */
    }
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied)
    throw new Error(
      "Copy isn’t available here. Select the text and copy it manually.",
    );
}
export function safeURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
