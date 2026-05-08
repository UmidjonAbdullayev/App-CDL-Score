import { useEffect, useRef } from 'react';

interface Props {
  onDone?: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  width: number; height: number;
  alpha: number;
  gravity: number;
}

export function Confetti({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      width: 8 + Math.random() * 8,
      height: 4 + Math.random() * 4,
      alpha: 1,
      gravity: 0.08 + Math.random() * 0.06,
    }));

    let frame: number;
    let allDone = false;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = 0;
      for (const p of particles) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.7) p.alpha = Math.max(0, p.alpha - 0.018);
        if (p.alpha > 0) active++;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }
      if (active > 0) {
        frame = requestAnimationFrame(tick);
      } else if (!allDone) {
        allDone = true;
        onDone?.();
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
    />
  );
}
