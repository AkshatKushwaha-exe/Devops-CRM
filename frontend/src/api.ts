export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const message =
        typeof data?.detail === "string"
          ? data.detail
          : Array.isArray(data?.detail)
            ? data.detail
                .map(
                  (d: { loc: string[]; msg: string }) =>
                    `${d.loc.slice(1).join(".")}: ${d.msg}`,
                )
                .join("; ")
            : "Unable to reach the CRM. Check that the backend is running.";
      throw new Error(message);
    }
    return response.status === 204 ? (undefined as T) : await response.json();
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(
        "Unable to reach the CRM. Check your connection and try again.",
      );
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error("The request timed out. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
