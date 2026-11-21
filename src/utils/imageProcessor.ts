import { createWorker } from 'tesseract.js';

export interface CropRect {
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
}

export interface ImageEnhanceOptions {
  rotationDeg: number; // 0, 90, 180, 270
  crop: CropRect;
  enhanceClarity: boolean;
  contrast: number; // -50..100
  brightness: number; // -50..50
  grayscale: boolean;
}

/**
 * Processes an image using HTML5 Canvas: rotation, cropping, contrast/brightness/clarity enhancement.
 */
export async function processMathImage(
  sourceDataUrl: string,
  options: ImageEnhanceOptions
): Promise<{ processedDataUrl: string; thumbnailDataUrl: string }> {
  const img = await loadImage(sourceDataUrl);

  // Step 1: Rotate onto intermediate canvas
  const rotCanvas = document.createElement('canvas');
  const rotCtx = rotCanvas.getContext('2d');
  if (!rotCtx) throw new Error('Canvas 2D context unavailable');

  const rad = ((options.rotationDeg % 360) * Math.PI) / 180;
  const swap = options.rotationDeg % 180 !== 0;
  const rw = swap ? img.height : img.width;
  const rh = swap ? img.width : img.height;

  rotCanvas.width = rw;
  rotCanvas.height = rh;
  rotCtx.translate(rw / 2, rh / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(img, -img.width / 2, -img.height / 2);

  // Step 2: Crop & resize to optimal OCR/AI resolution (max 1400px)
  const sx = Math.max(0, Math.round(options.crop.x * rw));
  const sy = Math.max(0, Math.round(options.crop.y * rh));
  const sw = Math.max(20, Math.round(options.crop.width * rw));
  const sh = Math.max(20, Math.round(options.crop.height * rh));

  const maxDim = 1400;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = dw;
  outCanvas.height = dh;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas 2D context unavailable');

  outCtx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, dw, dh);

  // Step 3: Pixel-level clarity, brightness, contrast & adaptive enhancement
  if (
    options.enhanceClarity ||
    options.grayscale ||
    options.contrast !== 0 ||
    options.brightness !== 0
  ) {
    const imgData = outCtx.getImageData(0, 0, dw, dh);
    const data = imgData.data;

    const cVal = options.enhanceClarity ? options.contrast + 35 : options.contrast;
    const bVal = options.brightness * 2.2;
    const contrastFactor = (259 * (cVal + 255)) / (255 * (259 - cVal));

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (options.grayscale || options.enhanceClarity) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = lum;
      }

      r = clampByte(contrastFactor * (r + bVal - 128) + 128);
      g = clampByte(contrastFactor * (g + bVal - 128) + 128);
      b = clampByte(contrastFactor * (b + bVal - 128) + 128);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    outCtx.putImageData(imgData, 0, 0);
  }

  const processedDataUrl = outCanvas.toDataURL('image/jpeg', 0.9);

  // Small thumbnail for history storage
  const thumbCanvas = document.createElement('canvas');
  const thumbScale = Math.min(1, 240 / Math.max(dw, dh));
  thumbCanvas.width = Math.max(1, Math.round(dw * thumbScale));
  thumbCanvas.height = Math.max(1, Math.round(dh * thumbScale));
  const tCtx = thumbCanvas.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(outCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.65);

  return { processedDataUrl, thumbnailDataUrl };
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Lightweight on-device frame scanner for "Continuous Math Scan".
 * Measures local edge transitions inside the scanning reticle without uploading any frames.
 */
export function analyzeFrameForMathContent(video: HTMLVideoElement): {
  hasClearContent: boolean;
  edgeScore: number;
} {
  if (!video.videoWidth || !video.videoHeight) {
    return { hasClearContent: false, edgeScore: 0 };
  }

  const canvas = document.createElement('canvas');
  const w = 160;
  const h = 90;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { hasClearContent: false, edgeScore: 0 };

  // Sample central scanning window (60% of frame)
  const sx = Math.round(video.videoWidth * 0.15);
  const sy = Math.round(video.videoHeight * 0.25);
  const sw = Math.round(video.videoWidth * 0.7);
  const sh = Math.round(video.videoHeight * 0.5);

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let sharpEdges = 0;
  let totalPairs = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const nextIdx = (y * w + (x + 1)) * 4;
      const nextLum = 0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];
      if (Math.abs(lum - nextLum) > 28) {
        sharpEdges++;
      }
      totalPairs++;
    }
  }

  const edgeScore = totalPairs > 0 ? sharpEdges / totalPairs : 0;
  return {
    hasClearContent: edgeScore > 0.045 && edgeScore < 0.65,
    edgeScore,
  };
}

/**
 * Runs real client-side OCR via Tesseract.js and normalizes math characters.
 */
export async function extractMathOCR(
  imageDataUrl: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl);

    // Clean common math OCR confusions lightly while preserving equations
    const cleaned = text
      .replace(/[|]/g, '1')
      .replace(/[—–]/g, '-')
      .replace(/\s*[xX]\s+(?=\d)/g, ' × ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  } finally {
    await worker.terminate();
  }
}
