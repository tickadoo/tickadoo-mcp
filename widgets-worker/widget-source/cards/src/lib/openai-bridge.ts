type OpenAIBridge = {
  toolInput?: unknown;
  metadata?: Record<string, unknown>;
  callTool?: (name: string, args: unknown) => Promise<unknown>;
};

declare global {
  interface Window {
    openai?: OpenAIBridge;
  }
}

export function getToolInput<T>(): T | null {
  return (window.openai?.toolInput ?? window.openai?.metadata?.['openai/toolInput'] ?? null) as T | null;
}

export function getMeta<T>(key: string): T | null {
  return (window.openai?.metadata?.[key] ?? null) as T | null;
}

export async function callTool<T>(name: string, args: unknown): Promise<T> {
  if (!window.openai?.callTool) {
    throw new Error('OpenAI bridge is not available');
  }
  return (await window.openai.callTool(name, args)) as T;
}
