import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

// Mounts a Phaser.Game inside a ref'd container and tears it down on unmount.
// Waits for the container to have a real size before booting (so the canvas
// never inits at 0x0), and keeps the renderer matched to the container via a
// ResizeObserver.
export function PhaserMount({
  scene,
  className = '',
}: {
  scene: new () => Phaser.Scene;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = ref.current;
    if (!parent) return;
    let game: Phaser.Game | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;

    const boot = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) {
        // Container not laid out yet — try again next frame.
        raf = requestAnimationFrame(boot);
        return;
      }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        transparent: true,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: w,
          height: h,
        },
        render: { antialias: true, powerPreference: 'high-performance' },
        scene: [scene],
      });
      gameRef.current = game;

      ro = new ResizeObserver(() => {
        const cw = parent.clientWidth;
        const ch = parent.clientHeight;
        if (game && cw > 0 && ch > 0) game.scale.resize(cw, ch);
      });
      ro.observe(parent);
    };
    boot();

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [scene]);

  return <div ref={ref} className={className} />;
}
