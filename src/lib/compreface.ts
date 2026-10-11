const COMPREFACE_URL = 'http://localhost:8000';
let API_KEY = 'REPLACE_WITH_YOUR_COMPREFACE_API_KEY';
// Load local secret at runtime if present (dev only)
try {
  // @ts-ignore — optional local file, may not exist in production
  const local = await import('./compreface.local');
  if (local?.LOCAL_API_KEY) API_KEY = local.LOCAL_API_KEY;
} catch {
  // no local override — use placeholder
}

// Similarity threshold for accepting a match (ArcFace typically 0.85+ for same person)
export const SIMILARITY_THRESHOLD = 0.97;

async function fileFromDataURL(dataURL: string, filename = 'face.jpg'): Promise<File> {
  const res = await fetch(dataURL);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

// ── Enroll a face image under a subject ID (employee UUID) ──
export async function enrollFace(subjectId: string, dataURL: string): Promise<boolean> {
  const formData = new FormData();
  formData.append('file', await fileFromDataURL(dataURL));

  try {
    const res = await fetch(
      `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
      { method: 'POST', headers: { 'x-api-key': API_KEY }, body: formData }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('[compreface] enroll failed:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[compreface] enroll error:', e);
    return false;
  }
}

// ── Recognize faces in an image ─────────────────────────────
export interface RecognitionResult {
  subject: string;
  similarity: number;
  box: { x: number; y: number; width: number; height: number };
}

export async function recognizeFace(dataURL: string): Promise<RecognitionResult[]> {
  const formData = new FormData();
  formData.append('file', await fileFromDataURL(dataURL));

  try {
    // CompreFace rejects matches below this threshold
    const threshold = 0.97;
    const res = await fetch(
      `${COMPREFACE_URL}/api/v1/recognition/recognize?limit=1&prediction_count=1&threshold=${threshold}`,
      { method: 'POST', headers: { 'x-api-key': API_KEY }, body: formData }
    );
    if (!res.ok) {
      console.error('[compreface] recognize failed:', res.status);
      return [];
    }
    const data = await res.json();
    const results: RecognitionResult[] = [];
    for (const r of data.result ?? []) {
      const top = r.subjects?.[0];
      results.push({
        subject: top?.subject ?? 'unknown',
        similarity: top?.similarity ?? 0,
        box: {
          x: r.box.x_min,
          y: r.box.y_min,
          width: r.box.x_max - r.box.x_min,
          height: r.box.y_max - r.box.y_min,
        },
      });
    }
    return results;
  } catch (e) {
    console.error('[compreface] recognize error:', e);
    return [];
  }
}

// ── Delete a subject ────────────────────────────────────────
export async function deleteSubject(subjectId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${COMPREFACE_URL}/api/v1/recognition/subjects/${encodeURIComponent(subjectId)}`,
      { method: 'DELETE', headers: { 'x-api-key': API_KEY } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ── Helper: capture current video frame as JPEG data URL ───
export function captureFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}
