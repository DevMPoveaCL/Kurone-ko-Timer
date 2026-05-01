import { Volume2, VolumeX } from "lucide-react";
import { useMusicStore } from "../store";

export function MusicToggle() {
  const enabled = useMusicStore((state) => state.enabled);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const loading = useMusicStore((state) => state.loading);
  const toggle = useMusicStore((state) => state.toggle);
  const active = enabled && isPlaying;

  return (
    <button
      className="icon-button"
      type="button"
      aria-label={active ? "Stop Kurone-ko Playlist" : "Play Kurone-ko Playlist"}
      aria-pressed={active}
      disabled={loading}
      onClick={() => void toggle()}
    >
      {active ? <Volume2 aria-hidden="true" size={13} /> : <VolumeX aria-hidden="true" size={13} />}
    </button>
  );
}
