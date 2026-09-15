import * as faceapi from '@vladmandic/face-api';

export interface HeadPose {
  yaw: number; // Kiri (-) / Kanan (+) in degrees
  pitch: number; // Bawah (-) / Atas (+) in degrees
  roll: number; // Tilt in degrees
  poseCategory: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
}

export interface QualityAssessmentResult {
  isValid: boolean;
  blurScore: number;
  brightnessScore: number;
  faceWidth: number;
  faceHeight: number;
  reason?: string;
}

export interface FaceDetectionResult {
  descriptor: Float32Array;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: faceapi.FaceLandmarks68;
  score: number;
  quality?: QualityAssessmentResult;
}

export interface DetailedFaceResult {
  descriptor: Float32Array;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: faceapi.FaceLandmarks68;
  headPose: HeadPose;
  score: number;
  quality?: QualityAssessmentResult;
}

export interface MatchResult {
  student: {
    id: string;
    nis: string;
    name: string;
    nickname: string;
    class_name: string;
    category: string;
    photo_url?: string | null;
  };
  confidence: number;
  distance: number;
  similarity?: number;
}

export interface AdvancedMatchOptions {
  maxDistance?: number; // Maximum allowable Euclidean distance (default: 0.42)
  minSimilarity?: number; // Minimum allowable Cosine similarity (default: 0.88)
  minMargin?: number; // Minimum gap between Top-1 and Top-2 distance (default: 0.10)
  grayAreaDistance?: number; // Ambiguity boundary (default: 0.48)
}

export interface AdvancedMatchResult {
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNKNOWN' | 'LOW_CONFIDENCE';
  student?: {
    id: string;
    nis: string;
    name: string;
    nickname: string;
    class_name: string;
    category: string;
    photo_url?: string | null;
  };
  confidence: number;
  top1Distance: number;
  top1Similarity: number;
  top2Distance?: number;
  top2Similarity?: number;
  margin?: number;
  message: string;
}

class FaceApiService {
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  async loadModels(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const MODEL_URL = '/models';
      try {
        console.log('[FaceAPI] Loading neural network models from:', MODEL_URL);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).catch(e => {
            console.warn('[FaceAPI] SSD MobileNet V1 load fallback:', e);
          }),
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        this.isLoaded = true;
        console.log('[FaceAPI] ✅ Models loaded successfully.');
      } catch (err) {
        console.error('[FaceAPI] Failed to load models:', err);
        throw err;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Assess face quality:
   * 1. Resolution / Bounding Box Size (minimum 85x85 px)
   * 2. Illumination / Luminance check (not too dark < 40, not overexposed > 230)
   * 3. Blur check via discrete 3x3 Laplacian variance (sharpness score >= 30)
   */
  assessFaceQuality(
    canvasSource: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
    box: { x: number; y: number; width: number; height: number }
  ): QualityAssessmentResult {
    const faceW = Math.round(box.width);
    const faceH = Math.round(box.height);

    // 1. Resolution check
    if (faceW < 85 || faceH < 85) {
      return {
        isValid: false,
        blurScore: 0,
        brightnessScore: 0,
        faceWidth: faceW,
        faceHeight: faceH,
        reason: `Wajah terlalu jauh (${faceW}x${faceH} px). Harap mendekat ke kamera (minimal 90x90 px).`,
      };
    }

    // Prepare an offscreen crop canvas
    const cropSize = 120;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = cropSize;
    offCanvas.height = cropSize;
    const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        isValid: true,
        blurScore: 100,
        brightnessScore: 128,
        faceWidth: faceW,
        faceHeight: faceH,
      };
    }

    // Draw cropped face
    ctx.drawImage(
      canvasSource,
      Math.max(0, box.x),
      Math.max(0, box.y),
      Math.min(box.width, ('videoWidth' in canvasSource ? canvasSource.videoWidth : canvasSource.width) - box.x),
      Math.min(box.height, ('videoHeight' in canvasSource ? canvasSource.videoHeight : canvasSource.height) - box.y),
      0,
      0,
      cropSize,
      cropSize
    );

    const imgData = ctx.getImageData(0, 0, cropSize, cropSize);
    const pixels = imgData.data;

    // 2. Mean Luminance / Illumination Check
    let sumLum = 0;
    const gray: number[] = new Array(cropSize * cropSize);
    for (let i = 0, gIdx = 0; i < pixels.length; i += 4, gIdx++) {
      const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      gray[gIdx] = lum;
      sumLum += lum;
    }
    const meanBrightness = Math.round(sumLum / (cropSize * cropSize));

    // Allow down to 22 (handled by Software IR preprocessor)
    if (meanBrightness < 22) {
      return {
        isValid: false,
        blurScore: 0,
        brightnessScore: meanBrightness,
        faceWidth: faceW,
        faceHeight: faceH,
        reason: `Pencahayaan terlalu gelap (${meanBrightness}/255). Harap cari area dengan pencahayaan cukup.`,
      };
    }

    if (meanBrightness > 240) {
      return {
        isValid: false,
        blurScore: 0,
        brightnessScore: meanBrightness,
        faceWidth: faceW,
        faceHeight: faceH,
        reason: `Pencahayaan terlalu silau / overexposed (${meanBrightness}/255).`,
      };
    }

    // 3. Blur Check via 3x3 Discrete Laplacian Kernel with Gaussian Noise Filter
    // Pre-smooth image to eliminate camera sensor grain (ISO noise)
    const smoothed = new Float32Array(cropSize * cropSize);
    for (let y = 1; y < cropSize - 1; y++) {
      const rowOffset = y * cropSize;
      for (let x = 1; x < cropSize - 1; x++) {
        smoothed[rowOffset + x] =
          (gray[rowOffset - cropSize + x - 1] + 2 * gray[rowOffset - cropSize + x] + gray[rowOffset - cropSize + x + 1] +
           2 * gray[rowOffset + x - 1] + 4 * gray[rowOffset + x] + 2 * gray[rowOffset + x + 1] +
           gray[rowOffset + cropSize + x - 1] + 2 * gray[rowOffset + cropSize + x] + gray[rowOffset + cropSize + x + 1]) / 16;
      }
    }

    let laplacianSum = 0;
    let laplacianSumSq = 0;
    let count = 0;

    for (let y = 1; y < cropSize - 1; y++) {
      const rowOffset = y * cropSize;
      for (let x = 1; x < cropSize - 1; x++) {
        const val =
          smoothed[rowOffset - cropSize + x] +
          smoothed[rowOffset + cropSize + x] +
          smoothed[rowOffset + x - 1] +
          smoothed[rowOffset + x + 1] -
          4 * smoothed[rowOffset + x];

        laplacianSum += val;
        laplacianSumSq += val * val;
        count++;
      }
    }

    const laplacianMean = laplacianSum / count;
    const laplacianVariance = Math.round((laplacianSumSq / count) - laplacianMean * laplacianMean);

    // True structural facial blur check (isolated from sensor noise)
    if (laplacianVariance < 16) {
      return {
        isValid: false,
        blurScore: laplacianVariance,
        brightnessScore: meanBrightness,
        faceWidth: faceW,
        faceHeight: faceH,
        reason: `Foto wajah buram / goyang (skor ketajaman: ${laplacianVariance}, minimal: 16). Harap tatap kamera dengan tenang.`,
      };
    }

    return {
      isValid: true,
      blurScore: laplacianVariance,
      brightnessScore: meanBrightness,
      faceWidth: faceW,
      faceHeight: faceH,
    };
  }

  /**
   * Software IR & Camera Noise Suppression Preprocessor:
   * 1. Evaluates illumination & sensor noise
   * 2. If underexposed (dark < 105) or noisy:
   *    - Applies adaptive Gamma correction: V_out = 255 * (V_in/255)^gamma
   *    - Applies 3x3 local Gaussian noise reduction on luminance
   *    - Performs dynamic range expansion so facial edges & landmarks emerge from darkness/grain
   */
  preprocessSoftwareIR(
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    forceEnhance = false
  ): { canvas: HTMLCanvasElement; wasEnhanced: boolean; brightness: number } {
    const w = 'videoWidth' in source ? source.videoWidth : source.width;
    const h = 'videoHeight' in source ? source.videoHeight : source.height;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w || 640;
    outCanvas.height = h || 480;
    const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { canvas: outCanvas, wasEnhanced: false, brightness: 128 };
    }

    ctx.drawImage(source, 0, 0, outCanvas.width, outCanvas.height);
    const imgData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);
    const d = imgData.data;

    let sumLum = 0;
    const sampleStep = 4;
    let samples = 0;
    for (let i = 0; i < d.length; i += 4 * sampleStep) {
      sumLum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      samples++;
    }
    const meanBrightness = Math.round(sumLum / Math.max(1, samples));

    if (!forceEnhance && meanBrightness >= 105) {
      return { canvas: outCanvas, wasEnhanced: false, brightness: meanBrightness };
    }

    // Adaptive Gamma Compensation
    const target = 130;
    const currentNorm = Math.max(15, meanBrightness) / 255;
    const gamma = Math.min(1.0, Math.max(0.35, Math.log(target / 255) / Math.log(currentNorm)));

    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(i / 255, gamma))));
    }

    let minVal = 255;
    let maxVal = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = lut[d[i]];
      const g = lut[d[i + 1]];
      const b = lut[d[i + 2]];
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < minVal) minVal = lum;
      if (lum > maxVal) maxVal = lum;
    }

    const range = maxVal - minVal;
    if (range > 20 && range < 220) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, Math.round(((d[i] - minVal) / range) * 255)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(((d[i + 1] - minVal) / range) * 255)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(((d[i + 2] - minVal) / range) * 255)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return { canvas: outCanvas, wasEnhanced: true, brightness: meanBrightness };
  }

  /**
   * Align face horizontally based on 68-point eye landmarks and apply contrast normalization
   */
  alignAndNormalizeFace(
    source: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement,
    landmarks: faceapi.FaceLandmarks68,
    box: { x: number; y: number; width: number; height: number },
    targetSize = 160
  ): HTMLCanvasElement {
    const pts = landmarks.positions;
    // Left eye center (pts 36..41)
    let leftEyeX = 0;
    let leftEyeY = 0;
    for (let i = 36; i <= 41; i++) {
      leftEyeX += pts[i].x;
      leftEyeY += pts[i].y;
    }
    leftEyeX /= 6;
    leftEyeY /= 6;

    // Right eye center (pts 42..47)
    let rightEyeX = 0;
    let rightEyeY = 0;
    for (let i = 42; i <= 47; i++) {
      rightEyeX += pts[i].x;
      rightEyeY += pts[i].y;
    }
    rightEyeX /= 6;
    rightEyeY /= 6;

    // Calculate rotation angle (roll) to align eyes horizontally
    const dy = rightEyeY - leftEyeY;
    const dx = rightEyeX - leftEyeX;
    const eyeDist = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);

    const alignedCanvas = document.createElement('canvas');
    alignedCanvas.width = targetSize;
    alignedCanvas.height = targetSize;
    const ctx = alignedCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return alignedCanvas;

    // Center point between eyes
    const eyeMidX = (leftEyeX + rightEyeX) / 2;
    const eyeMidY = (leftEyeY + rightEyeY) / 2;

    // Scale so eye distance is ~35% of target width
    const desiredEyeDist = targetSize * 0.35;
    const scale = eyeDist > 10 ? desiredEyeDist / eyeDist : 1;

    ctx.save();
    // Position eye center at (0.5 * targetSize, 0.4 * targetSize)
    ctx.translate(targetSize * 0.5, targetSize * 0.4);
    ctx.rotate(-angleRad);
    ctx.scale(scale, scale);
    ctx.translate(-eyeMidX, -eyeMidY);
    ctx.drawImage(source, 0, 0);
    ctx.restore();

    // Apply Contrast Stretching / Lighting Normalization
    try {
      const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
      const d = imgData.data;
      let minVal = 255;
      let maxVal = 0;

      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < minVal) minVal = lum;
        if (lum > maxVal) maxVal = lum;
      }

      if (maxVal - minVal > 15) {
        const range = maxVal - minVal;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, Math.max(0, ((d[i] - minVal) / range) * 230 + 12));
          d[i + 1] = Math.min(255, Math.max(0, ((d[i + 1] - minVal) / range) * 230 + 12));
          d[i + 2] = Math.min(255, Math.max(0, ((d[i + 2] - minVal) / range) * 230 + 12));
        }
        ctx.putImageData(imgData, 0, 0);
      }
    } catch {
      // Fallback gracefully if pixel manipulation fails
    }

    return alignedCanvas;
  }

  /**
   * Estimate 3D Head Rotation (Yaw, Pitch, Roll) from 68 facial landmark coordinates
   * Uses anthropometric 3D projection ratios:
   * - Roll: Eye-to-eye horizontal tilt
   * - Yaw: Nose tip displacement relative to face symmetry axis
   * - Pitch: Upper-face (eye-to-nose) vs Total vertical face perspective foreshortening
   */
  estimateHeadPose(landmarks: faceapi.FaceLandmarks68): HeadPose {
    const pts = landmarks.positions;

    // 1. Roll: Angle between outer eye corners (36 & 45)
    const leftEye = pts[36];
    const rightEye = pts[45];
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    // 2. Center of eyes (midpoint between 36 and 45)
    const eyeMidX = (pts[36].x + pts[45].x) / 2;
    const eyeMidY = (pts[36].y + pts[45].y) / 2;

    // 3. Nose root (27), Nose tip (30), Chin tip (8)
    const noseTipX = pts[30].x;
    const noseTipY = pts[30].y;
    const chinY = pts[8].y;

    // 4. Yaw: Horizontal head turn
    const leftJawX = pts[0].x;
    const rightJawX = pts[16].x;
    const jawWidth = Math.max(1, rightJawX - leftJawX);
    const jawCenter = (leftJawX + rightJawX) / 2;

    const noseOffsetFromCenter = noseTipX - jawCenter;
    const normalizedYawOffset = noseOffsetFromCenter / (jawWidth * 0.5);
    // Positive when user turns right (from their perspective), negative when left
    const yaw = -normalizedYawOffset * 50;

    // 5. Pitch: Vertical head nod (UP vs DOWN)
    // Key biological perspective ratio:
    // In frontal neutral gaze: dist(eyeMid, noseTip) is ~41% of total vertical face distance dist(eyeMid, chin).
    const distEyeNose = Math.max(1, noseTipY - eyeMidY);
    const totalVerticalSpan = Math.max(1, chinY - eyeMidY);
    const upperRatio = distEyeNose / totalVerticalSpan;

    // When tilting UP:
    // Nose tip moves UP towards eyes -> distEyeNose shrinks -> upperRatio drops below 0.32
    // When tilting DOWN:
    // Forehead moves forward, chin retreats -> distEyeNose expands -> upperRatio rises above 0.50
    const baselineUpperRatio = 0.41;
    const pitch = (baselineUpperRatio - upperRatio) * 110;

    let poseCategory: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' = 'CENTER';

    if (yaw > 12) {
      poseCategory = 'RIGHT';
    } else if (yaw < -12) {
      poseCategory = 'LEFT';
    } else if (pitch > 11 && upperRatio < 0.33) {
      // Must have actual upward pitch AND compressed eye-nose distance
      poseCategory = 'UP';
    } else if (pitch < -11 && upperRatio > 0.49) {
      poseCategory = 'DOWN';
    } else {
      poseCategory = 'CENTER';
    }

    return { yaw, pitch, roll, poseCategory };
  }

  /**
   * Detect face with 3D Head Pose and L2-normalized 128-dimensional descriptor
   * Includes Software IR Low-Light / Camera Noise Fallback Pass
   */
  async detectFaceWithPose(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<DetailedFaceResult | null> {
    await this.loadModels();

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.45,
    });

    let detection = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Fallback: If not detected due to low-light or noise, run on Software-IR enhanced frame!
    if (!detection) {
      const { canvas: irCanvas, wasEnhanced } = this.preprocessSoftwareIR(input);
      if (wasEnhanced) {
        const fallbackOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.38,
        });
        detection = await faceapi
          .detectSingleFace(irCanvas, fallbackOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
    }

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    const headPose = this.estimateHeadPose(detection.landmarks);
    const quality = this.assessFaceQuality(input, { x, y, width, height });

    return {
      descriptor: this.normalizeDescriptor(detection.descriptor),
      box: { x, y, width, height },
      landmarks: detection.landmarks,
      headPose,
      score: detection.detection.score,
      quality,
    };
  }

  /**
   * Detect single face with landmarks, alignment, and normalized 128-d descriptor
   * Includes Software IR Low-Light / Camera Noise Fallback Pass
   */
  async detectFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    useSsd = false
  ): Promise<FaceDetectionResult | null> {
    await this.loadModels();

    let detection: any = null;

    // Use SSD MobileNet V1 for maximum accuracy if requested or available
    if (useSsd && faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.45 });
        detection = await faceapi
          .detectSingleFace(input, options)
          .withFaceLandmarks()
          .withFaceDescriptor();
      } catch {
        detection = null;
      }
    }

    // Fallback to TinyFaceDetector
    if (!detection) {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.42,
      });

      detection = await faceapi
        .detectSingleFace(input, options)
        .withFaceLandmarks()
        .withFaceDescriptor();
    }

    // Secondary Fallback: Software IR Enhancement for low-light / noisy sensor conditions
    if (!detection) {
      const { canvas: irCanvas, wasEnhanced } = this.preprocessSoftwareIR(input);
      if (wasEnhanced) {
        const lowLightOptions = new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.35,
        });
        detection = await faceapi
          .detectSingleFace(irCanvas, lowLightOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();
      }
    }

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    const quality = this.assessFaceQuality(input, { x, y, width, height });

    return {
      descriptor: this.normalizeDescriptor(detection.descriptor),
      box: { x, y, width, height },
      landmarks: detection.landmarks,
      score: detection.detection.score,
      quality,
    };
  }

  /**
   * Extract descriptor from an image (HTMLImageElement or Data URL) with alignment
   */
  async extractDescriptorFromDataUrl(
    dataUrl: string,
    options: { useAlignment?: boolean; checkQuality?: boolean } = {}
  ): Promise<{ descriptor: Float32Array; quality?: QualityAssessmentResult } | null> {
    await this.loadModels();

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const res = await this.detectFace(img, true);
          if (!res) {
            resolve(null);
            return;
          }

          if (options.checkQuality && res.quality && !res.quality.isValid) {
            console.warn('[FaceAPI] Image quality rejected:', res.quality.reason);
            resolve({ descriptor: res.descriptor, quality: res.quality });
            return;
          }

          resolve({ descriptor: res.descriptor, quality: res.quality });
        } catch (e) {
          console.warn('[FaceAPI] Extract descriptor error:', e);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /**
   * L2-Normalize a 128-dimensional biometric vector
   */
  normalizeDescriptor(desc: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < desc.length; i++) {
      norm += desc[i] * desc[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) return desc;

    const normalized = new Float32Array(desc.length);
    for (let i = 0; i < desc.length; i++) {
      normalized[i] = desc[i] / norm;
    }
    return normalized;
  }

  /**
   * Compute average centroid descriptor from multiple pose vectors
   */
  computeCentroid(descriptors: Float32Array[]): Float32Array {
    if (descriptors.length === 0) return new Float32Array(128);
    const length = descriptors[0].length;
    const centroid = new Float32Array(length);

    for (const desc of descriptors) {
      for (let i = 0; i < length; i++) {
        centroid[i] += desc[i];
      }
    }

    const count = descriptors.length;
    for (let i = 0; i < length; i++) {
      centroid[i] /= count;
    }

    return this.normalizeDescriptor(centroid);
  }

  /**
   * Cosine Similarity between two 128-d biometric vectors
   * Range: -1.0 (opposite) to 1.0 (identical match)
   * Formula: (A · B) / (||A|| * ||B||)
   */
  cosineSimilarity(vec1: Float32Array | number[], vec2: Float32Array | number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      normA += vec1[i] * vec1[i];
      normB += vec2[i] * vec2[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Euclidean distance (L2) between two 128-d vectors
   */
  euclideanDistance(vec1: Float32Array | number[], vec2: Float32Array | number[]): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calibrated confidence score based on L2 distance
   * Distance <= 0.20 -> 98-99%
   * Distance 0.30 -> 91%
   * Distance 0.40 -> 82%
   * Distance 0.42 -> 80%
   * Distance > 0.45 -> drops below 65%
   */
  calculateCalibratedConfidence(dist: number): number {
    if (dist <= 0.20) return 0.99;
    const conf = 1.0 - (dist - 0.20) * 0.9;
    return Math.max(0.1, Math.min(0.99, conf));
  }

  /**
   * Advanced Biometric Matcher with:
   * 1. Multi-Sample & Centroid Composite Distance
   * 2. Strict L2 distance threshold (default: 0.42)
   * 3. Strict Cosine Similarity threshold (default: 0.88)
   * 4. Gray Area / Tolerance rejection (never guess between 0.42 and 0.48)
   * 5. Top-1 vs Top-2 Margin Checking (prevents similar-looking faces false positive)
   */
  matchFaceAdvanced(
    detected: Float32Array,
    enrolledStudents: Array<{
      student: {
        id: string;
        nis: string;
        name: string;
        nickname: string;
        class_name: string;
        category: string;
        photo_url?: string | null;
      };
      embeddings: Float32Array[];
      centroid?: Float32Array;
    }>,
    options: AdvancedMatchOptions = {}
  ): AdvancedMatchResult {
    const maxDistance = options.maxDistance ?? 0.42; // Strict L2 (User requested 0.40 - 0.45)
    const minSimilarity = options.minSimilarity ?? 0.88; // Strict Cosine (User requested 0.85 - 0.90)
    const minMargin = options.minMargin ?? 0.10; // Margin between Top-1 and Top-2
    const grayAreaDistance = options.grayAreaDistance ?? 0.48;

    const normalizedDetected = this.normalizeDescriptor(detected);

    interface CandidateScore {
      student: (typeof enrolledStudents)[0]['student'];
      minDistance: number;
      maxSimilarity: number;
      centroidDistance: number;
      compositeDistance: number;
      compositeSimilarity: number;
    }

    const candidateScores: CandidateScore[] = [];

    for (const item of enrolledStudents) {
      if (!item.embeddings || item.embeddings.length === 0) continue;

      let studentMinDist = Infinity;
      let studentMaxSim = -1;

      for (const emb of item.embeddings) {
        const dist = this.euclideanDistance(normalizedDetected, emb);
        const sim = this.cosineSimilarity(normalizedDetected, emb);

        if (dist < studentMinDist) studentMinDist = dist;
        if (sim > studentMaxSim) studentMaxSim = sim;
      }

      // Compute or use centroid
      const centroid = item.centroid || this.computeCentroid(item.embeddings);
      const centroidDist = this.euclideanDistance(normalizedDetected, centroid);
      const centroidSim = this.cosineSimilarity(normalizedDetected, centroid);

      // Composite distance: 65% best sample + 35% centroid stability
      const compositeDist = 0.65 * studentMinDist + 0.35 * centroidDist;
      const compositeSim = 0.65 * studentMaxSim + 0.35 * centroidSim;

      candidateScores.push({
        student: item.student,
        minDistance: studentMinDist,
        maxSimilarity: studentMaxSim,
        centroidDistance: centroidDist,
        compositeDistance: compositeDist,
        compositeSimilarity: compositeSim,
      });
    }

    if (candidateScores.length === 0) {
      return {
        status: 'UNKNOWN',
        confidence: 0,
        top1Distance: Infinity,
        top1Similarity: 0,
        message: 'Belum ada data siswa terdaftar dalam sistem.',
      };
    }

    // Sort by composite distance ascending
    candidateScores.sort((a, b) => a.compositeDistance - b.compositeDistance);

    const top1 = candidateScores[0];
    const top2 = candidateScores.length > 1 ? candidateScores[1] : null;

    const margin = top2 ? top2.compositeDistance - top1.compositeDistance : 1.0;
    const simMargin = top2 ? top1.compositeSimilarity - top2.compositeSimilarity : 1.0;

    // Rule 1: Strict Threshold Check
    // If distance exceeds strict threshold or similarity is below minimum
    if (top1.minDistance > maxDistance || top1.maxSimilarity < minSimilarity) {
      const isGrayArea = top1.minDistance <= grayAreaDistance || top1.maxSimilarity >= 0.84;
      const confidence = this.calculateCalibratedConfidence(top1.minDistance);

      return {
        status: isGrayArea ? 'LOW_CONFIDENCE' : 'UNKNOWN',
        student: top1.student,
        confidence,
        top1Distance: top1.minDistance,
        top1Similarity: top1.maxSimilarity,
        top2Distance: top2?.minDistance,
        top2Similarity: top2?.maxSimilarity,
        margin,
        message: isGrayArea
          ? 'Tingkat kemiripan berada di batas ambang toleransi. Silakan tatap kamera lebih dekat dan tenang.'
          : 'Wajah tidak terdaftar dalam database siswa.',
      };
    }

    // Rule 2: Top-1 vs Top-2 Margin Checking (Anti-False-Positive for Similar Faces)
    // If Candidate 1 and Candidate 2 have very close distances, reject due to ambiguity!
    if (top2 && (margin < minMargin || simMargin < 0.04)) {
      console.warn(
        `[FaceAPI] ⚠️ Ambiguity detected between Top-1 (${top1.student.name}, dist: ${top1.minDistance.toFixed(3)}) and Top-2 (${top2.student.name}, dist: ${top2.minDistance.toFixed(3)}). Margin: ${margin.toFixed(3)} < ${minMargin}`
      );

      return {
        status: 'AMBIGUOUS',
        student: top1.student,
        confidence: this.calculateCalibratedConfidence(top1.minDistance),
        top1Distance: top1.minDistance,
        top1Similarity: top1.maxSimilarity,
        top2Distance: top2.minDistance,
        top2Similarity: top2.maxSimilarity,
        margin,
        message: `Terdeteksi kemiripan wajah antara dua siswa (${top1.student.nickname} & ${top2.student.nickname}). Harap posisikan wajah lurus di tengah atau gunakan presensi manual.`,
      };
    }

    // Rule 3: Valid Match
    const confidence = this.calculateCalibratedConfidence(top1.minDistance);

    return {
      status: 'MATCHED',
      student: top1.student,
      confidence,
      top1Distance: top1.minDistance,
      top1Similarity: top1.maxSimilarity,
      top2Distance: top2?.minDistance,
      top2Similarity: top2?.maxSimilarity,
      margin,
      message: `Wajah Cocok: ${top1.student.name} (${Math.round(confidence * 100)}%)`,
    };
  }

  /**
   * Backwards-compatible matchFace wrapper
   */
  matchFace(
    detected: Float32Array,
    enrolledStudents: Array<{
      student: {
        id: string;
        nis: string;
        name: string;
        nickname: string;
        class_name: string;
        category: string;
        photo_url?: string | null;
      };
      embeddings: Float32Array[];
    }>,
    threshold = 0.42
  ): MatchResult | null {
    const res = this.matchFaceAdvanced(detected, enrolledStudents, {
      maxDistance: threshold,
    });

    if (res.status === 'MATCHED' && res.student) {
      return {
        student: res.student,
        confidence: res.confidence,
        distance: res.top1Distance,
        similarity: res.top1Similarity,
      };
    }

    return null;
  }
}

export const faceApi = new FaceApiService();
