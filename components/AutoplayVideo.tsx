"use client";

import { useEffect, useRef } from "react";

// Muted autoplay is allowed in most browsers, but some (Safari, locked-down
// automation profiles) only start playback from an explicit play() call.
export function AutoplayVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    const start = () => void video.play().catch(() => undefined);
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) start();
    else video.addEventListener("canplay", start, { once: true });
    return () => video.removeEventListener("canplay", start);
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
    />
  );
}
