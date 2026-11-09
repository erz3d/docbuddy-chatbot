import { api } from "./api";

export async function uploadDocument(
  file: File
): Promise<{ id: string; name: string; size: number; pages: number }> {
  const formData = new FormData();
  formData.append("file", file);

  return api<{ id: string; name: string; size: number; pages: number }>("/api/documents", {
    method: "POST",
    body: formData,
  });
}
