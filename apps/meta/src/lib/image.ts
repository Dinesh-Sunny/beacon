"use client";

// Shrinks a photo in the browser before it is sent: long edge 1600px, JPEG. Keeps uploads small
// and strips camera metadata (location, device) because the canvas never copies it.
export async function shrink(file: File, max = 1600): Promise<{ dataUrl: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: w, height: h };
}
