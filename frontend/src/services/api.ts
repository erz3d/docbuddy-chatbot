const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `Server error (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const documentFileUrl = (id: string) => `${API_URL}/api/documents/${id}/file`;
