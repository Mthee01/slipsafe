import { useState, useCallback } from "react";

export interface ImageQualityResult {
  sharpness: number;
  brightness: number;
  contrast: number;
  overallScore: number;
  status: "good" | "acceptable" | "poor";
  issues: string[];
  suggestions: string[];
}

const THRESHOLDS = {
  sharpness: { good: 150, acceptable: 80 },
  brightness: { min: 0.35, max: 0.75 },
  contrast: { good: 0.5, acceptable: 0.3 },
};

function calculateLaplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const gray: number[] = [];
  
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  let variance = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian = 
        gray[idx - width] + gray[idx + width] + 
        gray[idx - 1] + gray[idx + 1] - 
        4 * gray[idx];
      variance += laplacian * laplacian;
      count++;
    }
  }

  return count > 0 ? variance / count : 0;
}

function calculateBrightness(imageData: ImageData): number {
  const { data } = imageData;
  let totalBrightness = 0;
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    totalBrightness += max;
  }

  return totalBrightness / pixelCount;
}

function calculateContrast(imageData: ImageData): number {
  const { data } = imageData;
  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
  }

  return (max - min) / 255;
}

export function analyzeImageQuality(canvas: HTMLCanvasElement): ImageQualityResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      sharpness: 0,
      brightness: 0,
      contrast: 0,
      overallScore: 0,
      status: "poor",
      issues: ["Could not analyze image"],
      suggestions: ["Please try again"],
    };
  }

  const sampleWidth = Math.min(canvas.width, 800);
  const sampleHeight = Math.min(canvas.height, 600);
  
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sampleWidth;
  tempCanvas.height = sampleHeight;
  const tempCtx = tempCanvas.getContext("2d");
  
  if (!tempCtx) {
    return {
      sharpness: 0,
      brightness: 0,
      contrast: 0,
      overallScore: 0,
      status: "poor",
      issues: ["Could not analyze image"],
      suggestions: ["Please try again"],
    };
  }

  tempCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const imageData = tempCtx.getImageData(0, 0, sampleWidth, sampleHeight);

  const sharpness = calculateLaplacianVariance(imageData);
  const brightness = calculateBrightness(imageData);
  const contrast = calculateContrast(imageData);

  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  if (sharpness >= THRESHOLDS.sharpness.good) {
    score += 40;
  } else if (sharpness >= THRESHOLDS.sharpness.acceptable) {
    score += 25;
    issues.push("Image is slightly blurry");
    suggestions.push("Hold camera steady and ensure good focus");
  } else {
    score += 5;
    issues.push("Image is too blurry");
    suggestions.push("Hold camera steady, tap to focus, ensure good lighting");
  }

  if (brightness >= THRESHOLDS.brightness.min && brightness <= THRESHOLDS.brightness.max) {
    score += 30;
  } else if (brightness < THRESHOLDS.brightness.min) {
    score += 10;
    issues.push("Image is too dark");
    suggestions.push("Move to better lighting or use flash");
  } else {
    score += 10;
    issues.push("Image is too bright/overexposed");
    suggestions.push("Reduce lighting or move away from direct light");
  }

  if (contrast >= THRESHOLDS.contrast.good) {
    score += 30;
  } else if (contrast >= THRESHOLDS.contrast.acceptable) {
    score += 20;
    issues.push("Low contrast");
    suggestions.push("Place receipt on a contrasting background");
  } else {
    score += 5;
    issues.push("Very low contrast");
    suggestions.push("Use a dark background for white receipts, ensure receipt is flat");
  }

  let status: "good" | "acceptable" | "poor";
  if (score >= 80) {
    status = "good";
  } else if (score >= 50) {
    status = "acceptable";
  } else {
    status = "poor";
  }

  return {
    sharpness,
    brightness,
    contrast,
    overallScore: score,
    status,
    issues,
    suggestions,
  };
}

export function useImageQuality() {
  const [quality, setQuality] = useState<ImageQualityResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeImage = useCallback((canvas: HTMLCanvasElement) => {
    setIsAnalyzing(true);
    const result = analyzeImageQuality(canvas);
    setQuality(result);
    setIsAnalyzing(false);
    return result;
  }, []);

  const resetQuality = useCallback(() => {
    setQuality(null);
  }, []);

  return {
    quality,
    isAnalyzing,
    analyzeImage,
    resetQuality,
  };
}
