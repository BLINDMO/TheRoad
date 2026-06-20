import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

// Mounts a Phaser.Game inside a ref'd container and tears it down on unmount.
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
    if (!ref.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      backgroundColor: '#0a0805',
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: ref.current.clientWidth,
        height: ref.current.clientHeight,
      },
      render: { antialias: true, powerPreference: 'high-performance' },
      scene: [scene],
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [scene]);

  return <div ref={ref} className={className} />;
}
