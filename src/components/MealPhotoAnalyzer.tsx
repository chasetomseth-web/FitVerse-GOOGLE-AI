import React, { useState, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, Loader2, Image as ImageIcon, CameraOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeMealPhotos } from '../services/gemini';

interface MealPhotoAnalyzerProps {
  onAnalysisComplete: (foods: any[], photos: { data: string; mimeType: string }[]) => void;
  onCancel: () => void;
}

export const MealPhotoAnalyzer: React.FC<MealPhotoAnalyzerProps> = ({ onAnalysisComplete, onCancel }) => {
  const [step, setStep] = useState<'top' | 'side' | 'analyzing'>('top');
  const [topPhoto, setTopPhoto] = useState<string | null>(null);
  const [sidePhoto, setSidePhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Unable to access camera. Please ensure permissions are granted.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (step === 'top') {
          setTopPhoto(dataUrl);
          setStep('side');
        } else {
          setSidePhoto(dataUrl);
          handleAnalysis(topPhoto!, dataUrl);
        }
      }
    }
  };

  const handleAnalysis = async (top: string, side: string) => {
    setStep('analyzing');
    stopCamera();
    
    try {
      const images = [
        { data: top.split(',')[1], mimeType: 'image/jpeg' },
        { data: side.split(',')[1], mimeType: 'image/jpeg' }
      ];
      
      const results = await analyzeMealPhotos(images);
      onAnalysisComplete(results, images);
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Failed to analyze meal. Please try again.");
      setStep('top');
      setTopPhoto(null);
      setSidePhoto(null);
    }
  };

  const reset = () => {
    setTopPhoto(null);
    setSidePhoto(null);
    setStep('top');
    setError(null);
    startCamera();
  };

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="flex flex-col h-full max-h-[80vh] w-full max-w-md bg-brand-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-display font-black text-white uppercase italic tracking-tighter leading-none">
            {step === 'analyzing' ? 'Analyzing...' : 'Photo Analysis'}
          </h3>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
            {step === 'top' ? 'Step 1: Top View' : step === 'side' ? 'Step 2: Side View' : 'Processing Meal Data'}
          </p>
        </div>
        <button onClick={onCancel} className="p-2 text-white/40 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {step === 'analyzing' ? (
          <div className="flex flex-col items-center justify-center space-y-6 p-8 text-center">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-brand-pink/20 border-t-brand-pink rounded-full animate-spin" />
              <Loader2 className="w-8 h-8 text-brand-pink absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-white uppercase tracking-widest">Estimating Portions...</p>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                Our coach is calculating volumes and cross-referencing nutrition databases for maximum precision.
              </p>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {!cameraActive && !error && (
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-brand-pink animate-spin" />
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Initializing Camera...</p>
              </div>
            )}

            {error && (
              <div className="p-8 text-center space-y-4">
                <CameraOff className="w-12 h-12 text-brand-pink mx-auto" />
                <p className="text-xs text-white/60 font-medium">{error}</p>
                <button 
                  onClick={startCamera}
                  className="px-6 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Retry Camera
                </button>
              </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
              <div className="w-full h-full border border-white/20 rounded-2xl flex items-center justify-center">
                <div className="w-48 h-48 border border-brand-pink/20 rounded-full flex items-center justify-center">
                  <div className="w-32 h-32 border border-brand-pink/40 rounded-full opacity-50" />
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-0 right-0 flex justify-center px-6">
              <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <p className="text-[8px] font-black text-white uppercase tracking-widest">
                  {step === 'top' ? 'Position camera directly above plate' : 'Position camera at 45° side angle'}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-8 bg-brand-black border-t border-white/5">
        <div className="flex items-center justify-between gap-6">
          <div className="flex gap-2">
            <div className={`w-12 h-12 rounded-xl border-2 overflow-hidden transition-all ${topPhoto ? 'border-brand-pink' : 'border-white/5 bg-white/5'}`}>
              {topPhoto && <img src={topPhoto} alt="Top" className="w-full h-full object-cover" />}
            </div>
            <div className={`w-12 h-12 rounded-xl border-2 overflow-hidden transition-all ${sidePhoto ? 'border-brand-pink' : 'border-white/5 bg-white/5'}`}>
              {sidePhoto && <img src={sidePhoto} alt="Side" className="w-full h-full object-cover" />}
            </div>
          </div>

          {step !== 'analyzing' && (
            <button 
              onClick={capturePhoto}
              disabled={!cameraActive}
              className="w-16 h-16 bg-brand-pink rounded-full flex items-center justify-center shadow-lg shadow-brand-pink/40 active:scale-90 transition-all disabled:opacity-50"
            >
              <Camera className="w-8 h-8 text-white" />
            </button>
          )}

          <button 
            onClick={reset}
            className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
