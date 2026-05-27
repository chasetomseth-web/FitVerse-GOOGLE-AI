import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Dumbbell } from 'lucide-react';

interface ExerciseMediaProps {
  exerciseName: string;
  className?: string;
  muted?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const ExerciseMedia: React.FC<ExerciseMediaProps> = ({ 
  exerciseName, 
  className, 
  muted = true,
  onPlay,
  onPause,
  videoRef: externalRef
}) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const internalRef = React.useRef<HTMLVideoElement>(null);
  const videoRef = externalRef || internalRef;
  
  useEffect(() => {
    let isMounted = true;
    const fetchVideo = async () => {
      if (!exerciseName) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      
      const cleanName = exerciseName.toLowerCase()
        .replace(/["’'"]/g, '')
        .trim();

      // Try multiple ID variations
      const id1 = cleanName.replace(/[^a-z0-9]/g, '_');
      const id2 = cleanName.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const id3 = cleanName.replace(/[^a-z0-9]/g, ''); // No separators

      try {
        // 1. Try direct ID matches
        const idsToTry = [id1, id2, id3];
        for (const id of idsToTry) {
          const exRef = doc(db, 'exercise_library', id);
          const exSnap = await getDoc(exRef);
          if (exSnap.exists()) {
            const data = exSnap.data();
            if (data.videoUrl && isMounted) {
              setVideoUrl(data.videoUrl);
              setLoading(false);
              return;
            }
          }
        }

        // 2. Try fuzzy match by removing common prefixes
        const coreName = cleanName
          .replace(/^(barbell|dumbbell|db|bb|kb|kettlebell|weighted|bodyweight|air|assisted|supported|single\s+arm|single\s+leg|alternating|alt|seated|standing|lying|prone|supine|banded|band|resistance\s+band|cable|suspension|ring|stability\s+ball|medicine\s+ball|mb|slam\s+ball|wall\s+ball|box|bench|floor|smith\s+machine|machine|iso|isometric|isometric\s+isometric)\s+/g, '')
          .replace(/\s+(iso|isometric|hold|isometric\s+isometric)$/g, '')
          .trim();
        
        if (coreName !== cleanName && coreName.length > 2) {
          const fuzzyId = coreName.replace(/[^a-z0-9]/g, '_');
          const fuzzyRef = doc(db, 'exercise_library', fuzzyId);
          const fuzzySnap = await getDoc(fuzzyRef);
          if (fuzzySnap.exists()) {
            const data = fuzzySnap.data();
            if (data.videoUrl && isMounted) {
              setVideoUrl(data.videoUrl);
              setLoading(false);
              return;
            }
          }
        }

        // 3. Collection queries
        const libRef = collection(db, 'exercise_library');
        
        // Try exact name match variations
        const nameVariations = [
          exerciseName,
          exerciseName.toLowerCase(),
          exerciseName.charAt(0).toUpperCase() + exerciseName.slice(1).toLowerCase(),
          cleanName
        ];

        for (const variant of nameVariations) {
          const qName = query(libRef, where('name', '==', variant), limit(1));
          const snapName = await getDocs(qName);
          if (!snapName.empty) {
            const data = snapName.docs[0].data();
            if (data.videoUrl && isMounted) {
              setVideoUrl(data.videoUrl);
              setLoading(false);
              return;
            }
          }
        }

        // 4. Direct Cloud Storage Guessing (THE ULTIMATE FALLBACK)
        const baseUrl = "https://storage.googleapis.com/exercise-videos-fit/";
        const filenameGuess = encodeURIComponent(cleanName)
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
          .replace(/'/g, '%27')
          .replace(/\*/g, '%2A')
          .replace(/!/g, '%21');
        
        if (isMounted) {
          setVideoUrl(`${baseUrl}${filenameGuess}.mp4`);
          setLoading(false);
          return;
        }

      } catch (err) {
        console.error('Error fetching video:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };
    fetchVideo();
    return () => { isMounted = false; };
  }, [exerciseName]);

  // Handle explicit play state
  useEffect(() => {
    if (videoRef?.current && videoUrl && !loading && !error) {
      const video = videoRef.current;
      video.muted = muted;
      video.loop = true;
      video.playsInline = true;

      const attemptPlay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silencing error, common if autoplay is blocked
            if (!muted) {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
        }
      };

      const timer = setTimeout(attemptPlay, 150);
      return () => clearTimeout(timer);
    }
  }, [videoUrl, loading, error, muted, videoRef]);

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-white/5 animate-pulse ${className || ''}`}>
        <Dumbbell className="w-8 h-8 text-white/10" />
      </div>
    );
  }

  if (videoUrl && !error) {
    return (
      <video 
        ref={videoRef}
        key={videoUrl}
        src={videoUrl}
        autoPlay
        loop
        muted={muted}
        playsInline
        preload="auto"
        referrerPolicy="no-referrer"
        onPlay={onPlay}
        onPause={onPause}
        onError={() => {
          // If mp4 guess failed, try mov
          if (videoUrl.endsWith('.mp4') && videoUrl.includes('storage.googleapis.com')) {
            setVideoUrl(videoUrl.replace('.mp4', '.mov'));
          } else {
            setError(true);
          }
        }}
        className={`w-full h-full object-cover ${className || ''}`}
      >
        <source src={videoUrl} type={videoUrl.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'} />
      </video>
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center bg-white/5 ${className || ''}`}>
      <Dumbbell className="w-8 h-8 text-white/5" />
    </div>
  );
};
