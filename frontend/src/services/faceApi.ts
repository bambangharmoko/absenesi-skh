import * as faceapi from '@vladmandic/face-api';

export interface HeadPose {
  yaw: number; // Kiri (-) / Kanan (+) in degrees
  pitch: number; // Bawah (-) / Atas (+) in degrees
  roll: number; // Tilt in degrees
  poseCategory: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
}

export interface FaceDetectionResult {
  descriptor: Float32Array;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score: number;
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
   * Estimate 3D Head Rotation (Yaw, Pitch, Roll) from 68 facial landmark coordinates
   */
  estimateHeadPose(landmarks: faceapi.FaceLandmarks68): HeadPose {
    const pts = landmarks.positions;
    // Landmark indices:
    // 0: Left jaw edge, 16: Right jaw edge
    // 30: Nose tip, 27: Nose bridge top, 8: Chin bottom
    // 36: Left eye corner, 45: Right eye corner

    const leftJawX = pts[0].x;
    const rightJawX = pts[16].x;
    const noseTipX = pts[30].x;
    const noseTipY = pts[30].y;
    const chinY = pts[8].y;
    const noseBridgeY = pts[27].y;

    const jawWidth = Math.max(1, rightJawX - leftJawX);
    const leftDist = noseTipX - leftJawX;

    // Yaw ratio: In front camera perspective, turning to user's RIGHT moves nose towards pts[0] (lower x in image).
    // So (0.5 - yawRatio) becomes POSITIVE (> 10) when turning RIGHT, and NEGATIVE (< -10) when turning LEFT.
    const yawRatio = leftDist / jawWidth;
    const yaw = (0.5 - yawRatio) * 80;

    // Pitch ratio: vertical position of nose tip between nose bridge and chin
    const faceHeight = Math.max(1, chinY - noseBridgeY);
    const noseToChin = chinY - noseTipY;
    const pitchRatio = noseToChin / faceHeight;
    const pitch = (pitchRatio - 0.58) * 90;

    // Roll angle (Tilt)
    const leftEye = pts[36];
    const rightEye = pts[45];
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    let poseCategory: 'CENTER' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' = 'CENTER';
    if (yaw > 10) poseCategory = 'RIGHT';
    else if (yaw < -10) poseCategory = 'LEFT';
    else if (pitch > 8) poseCategory = 'UP';
    else if (pitch < -8) poseCategory = 'DOWN';
    else poseCategory = 'CENTER';

    return { yaw, pitch, roll, poseCategory };
  }

  /**
   * Detect face with 3D Head Pose and 128-dimensional descriptor
   */
  async detectFaceWithPose(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<DetailedFaceResult | null> {
    await this.loadModels();

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.45,
    });

    const detection = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    const headPose = this.estimateHeadPose(detection.landmarks);

    return {
      descriptor: detection.descriptor,
      box: { x, y, width, height },
      landmarks: detection.landmarks,
      headPose,
      score: detection.detection.score,
    };
  }

  /**
   * Detect single face with landmarks and 128-dimensional descriptor
   */
  async detectFace(
    input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  ): Promise<FaceDetectionResult | null> {
    await this.loadModels();

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const detection = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    return {
      descriptor: detection.descriptor,
      box: { x, y, width, height },
      score: detection.detection.score,
    };
  }

  /**
   * Extract descriptor from an image (HTMLImageElement or Data URL)
   */
  async extractDescriptorFromDataUrl(dataUrl: string): Promise<Float32Array | null> {
    await this.loadModels();

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const res = await this.detectFace(img);
          resolve(res ? res.descriptor : null);
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

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < length; i++) {
      norm += centroid[i] * centroid[i];
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < length; i++) {
        centroid[i] /= norm;
      }
    }

    return centroid;
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
   * Euclidean distance between two 128-d vectors
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
   * Match a detected descriptor against enrolled students
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
    threshold = 0.58
  ): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    let minDistance = Infinity;

    for (const item of enrolledStudents) {
      if (!item.embeddings || item.embeddings.length === 0) continue;

      for (const emb of item.embeddings) {
        const dist = this.euclideanDistance(detected, emb);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = {
            student: item.student,
            distance: dist,
            confidence: Math.max(0, Math.min(1, 1 - dist * 0.85)),
          };
        }
      }
    }

    if (bestMatch && minDistance <= threshold) {
      return bestMatch;
    }

    return null;
  }
}

export const faceApi = new FaceApiService();
