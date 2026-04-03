/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Camera, Upload, ShieldCheck, AlertTriangle, Loader2, RefreshCw, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface AnalysisResult {
  safe: boolean;
  score: number;
  explanation: string;
  detectedIssues: string[];
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please ensure you have granted permission.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Data = image.split(',')[1];
      const model = "gemini-3-flash-preview";
      
      const prompt = `Analyze this food image for safety. 
      Check specifically for fungus, mold, rot, or any signs of spoilage.
      Return the analysis in JSON format with the following structure:
      {
        "safe": boolean,
        "score": number (0-100, where 100 is perfectly safe),
        "explanation": "string explaining the findings",
        "detectedIssues": ["string list of specific issues found, or empty if none"]
      }
      If fungus is detected, the score must be low (below 40). If it looks perfectly safe, the score should be high (above 90).`;

      const response = await genAI.models.generateContent({
        model: model,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        const parsedResult = JSON.parse(text) as AnalysisResult;
        setResult(parsedResult);
      } else {
        throw new Error("No analysis received from AI.");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze the image. Please try again with a clearer photo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      <header className="max-w-2xl mx-auto pt-12 px-6 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-black/5 mb-6"
        >
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
        </motion.div>
        <h1 className="text-4xl font-semibold tracking-tight mb-2">Food Safety Scanner</h1>
        <p className="text-neutral-500">AI-powered detection for fungus and spoilage</p>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {isCameraOpen ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-black shadow-lg border border-black/5">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-6 inset-x-0 flex justify-center gap-4">
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <div className="w-12 h-12 border-4 border-emerald-600 rounded-full" />
                  </button>
                </div>
              </div>
              <button
                onClick={stopCamera}
                className="w-full bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200 font-medium py-4 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          ) : !image ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div
                className="bg-white rounded-3xl p-12 border border-dashed border-neutral-300 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-400 transition-colors group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-emerald-50 transition-colors">
                  <Upload className="w-10 h-10 text-neutral-400 group-hover:text-emerald-500 transition-colors" />
                </div>
                <h2 className="text-xl font-medium mb-2">Upload a Photo</h2>
                <p className="text-neutral-400 max-w-xs">
                  Select an existing image from your gallery.
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <button
                onClick={startCamera}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-6 rounded-3xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
              >
                <Camera className="w-6 h-6" />
                Open Camera
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-lg border border-black/5">
                <img src={image} alt="Food to analyze" className="w-full h-full object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                    <p className="font-medium">Analyzing food safety...</p>
                  </div>
                )}
              </div>

              {!result && !isAnalyzing && (
                <div className="flex gap-4">
                  <button
                    onClick={analyzeImage}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                  >
                    Start Analysis
                  </button>
                  <button
                    onClick={reset}
                    className="w-16 bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98]"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 text-red-700">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-1">Safety Score</h3>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-bold ${result.score > 70 ? 'text-emerald-600' : result.score > 40 ? 'text-amber-500' : 'text-red-600'}`}>
                          {result.score}
                        </span>
                        <span className="text-neutral-300 text-xl">/ 100</span>
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${result.safe ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {result.safe ? 'Likely Safe' : 'Warning: Spoilage'}
                    </div>
                  </div>

                  <div className="h-px bg-neutral-100" />

                  <div>
                    <div className="flex items-center gap-2 mb-3 text-neutral-800 font-medium">
                      <Info className="w-4 h-4" />
                      <h4>AI Findings</h4>
                    </div>
                    <p className="text-neutral-600 leading-relaxed">
                      {result.explanation}
                    </p>
                  </div>

                  {result.detectedIssues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Detected Issues</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.detectedIssues.map((issue, i) => (
                          <span key={i} className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-lg text-sm">
                            {issue}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={reset}
                    className="w-full bg-neutral-900 hover:bg-black text-white font-medium py-4 rounded-2xl transition-all active:scale-[0.98]"
                  >
                    Scan Another Item
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <section className="mt-12 p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
          <h3 className="text-emerald-900 font-medium mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Safety Disclaimer
          </h3>
          <p className="text-emerald-800/70 text-sm leading-relaxed">
            This tool uses AI to analyze visual patterns. It is not a substitute for professional food safety testing. If you suspect food is spoiled, even if the AI marks it as safe, do not consume it. "When in doubt, throw it out."
          </p>
        </section>
      </main>
    </div>
  );
}
