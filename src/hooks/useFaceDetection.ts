import { useEffect, useRef, useState } from 'react';
import { recognizeFace, captureFrame, type RecognitionResult } from '../lib/compreface';

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  intervalMs: number = 1200
) {
  const [faces, setFaces] = useState<RecognitionResult[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;

    async function loop(now: number) {
      if (stopped) return;
      if (now - lastRunRef.current > intervalMs && !busyRef.current) {
        lastRunRef.current = now;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          busyRef.current = true;
          try {
            const frame = captureFrame(video);
            if (frame) {
              const detected = await recognizeFace(frame);
              if (!stopped) setFaces(detected);
            }
          } catch (e) {
            // ignore transient
          }
          busyRef.current = false;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, videoRef, intervalMs]);

  return { faces, modelReady: true, busy };
}
