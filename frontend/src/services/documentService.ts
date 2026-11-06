const API_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001";

export async function uploadDocument(
  file: File
): Promise<{ id: string; pages: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/documents`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `Server error (${response.status})`);
  }

  return response.json();
}