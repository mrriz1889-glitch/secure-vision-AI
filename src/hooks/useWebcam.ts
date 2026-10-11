import { useEffect, useRef, useState } from 'react';

export function useWebcam(enabled: boolean = true, deviceIndex?: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function start() {
      try {
        // Get all cameras
        const all = await navigator.mediaDevices.enumerateDevices();
        let cams = all.filter((d) => d.kind === 'videoinput');

        // If no labels yet (permission not granted), request once to unlock
        if (cams.length === 0 || !cams[0].label) {
          const temp = await navigator.mediaDevices.getUserMedia({ video: true });
          temp.getTracks().forEach((t) => t.stop());
          const refreshed = await navigator.mediaDevices.enumerateDevices();
          cams = refreshed.filter((d) => d.kind === 'videoinput');
        }

        if (cams.length === 0) {
          setError('No cameras detected');
          return;
        }

        // Pick this tile's camera (or default to first)
        const idx = deviceIndex ?? 0;
        const cam = cams[idx % cams.length];

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: cam.deviceId ? { exact: cam.deviceId } : undefined,
            width: 1280,
            height: 720,
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e: any) {
        console.error('[useWebcam] error:', e);
        setError(e?.message ?? 'Camera error');
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setReady(false);
    };
  }, [enabled, deviceIndex]);

  return { videoRef, ready, error };
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    let cams = all.filter((d) => d.kind === 'videoinput');
    if (cams.length === 0 || !cams[0].label) {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true });
      temp.getTracks().forEach((t) => t.stop());
      const refreshed = await navigator.mediaDevices.enumerateDevices();
      cams = refreshed.filter((d) => d.kind === 'videoinput');
    }
    return cams;
  } catch {
    return [];
  }
}
