"use client";

import { useEffect, useRef, useState } from "react";

type Bullet = { x: number; y: number };
type EnemyBullet = { x: number; y: number };

type Enemy = {
  id: number;
  x: number;
  y: number;
  row: number;
  exploding: boolean;
  explodeAt: number | null;
};

export default function Page() {
  const [shipX, setShipX] = useState(380);
  const [direction, setDirection] = useState<"left" | "center" | "right">("center");

  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemyBullets, setEnemyBullets] = useState<EnemyBullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [shipExploding, setShipExploding] = useState(false);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [finalTime, setFinalTime] = useState<number | null>(null);

  const keysRef = useRef<Record<string, boolean>>({});
  const shipXRef = useRef(380);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyBulletsRef = useRef<EnemyBullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const rowDirectionsRef = useRef<number[]>([1, -1, 1]);

  const BOARD_WIDTH = 800;
  const PADDING = 20;

  function initGame() {
    const newEnemies: Enemy[] = [];

    let id = 1;
    const rows = 3;
    const cols = 7;

    const enemySize = 50;
    const gap = 50;
    const step = enemySize + gap;

    const startY = 35;
    const gapY = 70;

    for (let row = 0; row < rows; row++) {
      const fromLeft = row === 0 || row === 2;

      const rowWidth = cols * enemySize + (cols - 1) * gap;
      const startX = fromLeft
        ? PADDING
        : BOARD_WIDTH - PADDING - rowWidth;

      for (let col = 0; col < cols; col++) {
        newEnemies.push({
          id: id++,
          x: startX + col * step,
          y: startY + row * gapY,
          row,
          exploding: false,
          explodeAt: null,
        });
      }
    }

    enemiesRef.current = newEnemies;
    bulletsRef.current = [];
    enemyBulletsRef.current = [];
    shipXRef.current = 380;
    rowDirectionsRef.current = [1, -1, 1];

    setEnemies(newEnemies);
    setBullets([]);
    setEnemyBullets([]);
    setScore(0);
    setGameOver(false);
    setWin(false);
    setShipExploding(false);

    setStartTime(Date.now());
    setFinalTime(null);
  }

  useEffect(() => {
    initGame();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      keysRef.current[e.key] = true;

      if (e.code === "Space" && !gameOver) {
        const b = { x: shipXRef.current + 30, y: 460 };
        bulletsRef.current = [...bulletsRef.current, b];
        setBullets(bulletsRef.current);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      keysRef.current[e.key] = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const interval = setInterval(() => {
      if (gameOver) return;

      const now = Date.now();

      // 🚀 STATEK
      let nextX = shipXRef.current;
      let dir: "left" | "center" | "right" = "center";

      if (keysRef.current["ArrowLeft"]) {
        nextX = Math.max(nextX - 6, PADDING);
        dir = "left";
      } else if (keysRef.current["ArrowRight"]) {
        nextX = Math.min(nextX + 6, BOARD_WIDTH - 64 - PADDING);
        dir = "right";
      }

      shipXRef.current = nextX;
      setShipX(nextX);
      setDirection(dir);

      // 💥 BULLETS
      let nextBullets = bulletsRef.current
        .map((b) => ({ ...b, y: b.y - 8 }))
        .filter((b) => b.y > 0);

      let nextEnemyBullets = enemyBulletsRef.current
        .map((b) => ({ ...b, y: b.y + 6 }))
        .filter((b) => b.y < 500);

      // 👾 STRZAŁY WROGÓW
      if (Math.random() < 0.02 && enemiesRef.current.length > 0) {
        const shooter =
          enemiesRef.current[
          Math.floor(Math.random() * enemiesRef.current.length)
          ];

        nextEnemyBullets.push({
          x: shooter.x + 25,
          y: shooter.y + 40,
        });
      }

      // 👾 RUCH
      let nextEnemies = [...enemiesRef.current];
      const dirs = [...rowDirectionsRef.current];

      for (let r = 0; r < 3; r++) {
        const rowEnemies = nextEnemies.filter(e => e.row === r && !e.exploding);
        if (!rowEnemies.length) continue;

        const minX = Math.min(...rowEnemies.map(e => e.x));
        const maxX = Math.max(...rowEnemies.map(e => e.x + 50));

        if (dirs[r] === 1 && maxX >= BOARD_WIDTH - PADDING) dirs[r] = -1;
        if (dirs[r] === -1 && minX <= PADDING) dirs[r] = 1;
      }

      nextEnemies = nextEnemies.map(e =>
        e.exploding ? e : { ...e, x: e.x + dirs[e.row] * 1.5 }
      );

      rowDirectionsRef.current = dirs;

      // 💥 TRAFIENIA WROGÓW
      const updatedEnemies = [...nextEnemies];
      const remainingBullets: Bullet[] = [];

      for (const b of nextBullets) {
        let hit = -1;

        for (let i = 0; i < updatedEnemies.length; i++) {
          const e = updatedEnemies[i];
          if (e.exploding) continue;

          if (
            b.x >= e.x &&
            b.x <= e.x + 50 &&
            b.y >= e.y &&
            b.y <= e.y + 50
          ) {
            hit = i;
            break;
          }
        }

        if (hit >= 0) {
          updatedEnemies[hit] = {
            ...updatedEnemies[hit],
            exploding: true,
            explodeAt: now,
          };
          setScore(s => s + 10);
        } else {
          remainingBullets.push(b);
        }
      }

      // 💀 TRAFIENIE GRACZA
      for (const b of nextEnemyBullets) {
        if (
          b.x >= shipXRef.current &&
          b.x <= shipXRef.current + 64 &&
          b.y >= 440
        ) {
          setShipExploding(true);

          setTimeout(() => {
            setGameOver(true);
          }, 150);
        }
      }

      // 🧨 USUWANIE
      nextEnemies = updatedEnemies.filter(e =>
        !e.exploding || (e.explodeAt && now - e.explodeAt < 150)
      );

      if (nextEnemies.length === 0) {
        setWin(true);
        setGameOver(true);

        if (startTime) {
          setFinalTime(Date.now() - startTime);
        }
      }

      bulletsRef.current = remainingBullets;
      enemyBulletsRef.current = nextEnemyBullets;
      enemiesRef.current = nextEnemies;

      setBullets(remainingBullets);
      setEnemyBullets(nextEnemyBullets);
      setEnemies(nextEnemies);
    }, 16);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(interval);
    };
  }, [gameOver, startTime]);

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const msPart = Math.floor((ms % 1000) / 10);
    return `${s}.${msPart.toString().padStart(2, "0")}s`;
  }

  return (
    <main className="flex h-screen flex-col items-center justify-center bg-black text-white">
      <h1 className="mb-2 text-4xl">Space Invaders</h1>
      <div className="mb-2 text-xl">Score: {score}</div>

      <div className="relative h-[500px] w-[800px] border border-white overflow-hidden">

        {enemies.map(e => (
          <img
            key={e.id}
            src={
              e.exploding
                ? "/images/space-invaders/boom.png"
                : "/images/space-invaders/retro-rocket.png"
            }
            className="absolute w-[50px]"
            style={{ left: e.x, top: e.y, imageRendering: "pixelated" }}
          />
        ))}

        <img
          src={
            shipExploding
              ? "/images/space-invaders/boom.png"
              : `/images/space-invaders/ship-${direction}.png`
          }
          className="absolute bottom-2 w-[64px]"
          style={{ left: shipX, imageRendering: "pixelated" }}
        />

        {bullets.map((b, i) => (
          <div key={i} className="absolute w-[4px] h-[10px] bg-white"
            style={{ left: b.x, top: b.y }} />
        ))}

        {enemyBullets.map((b, i) => (
          <div key={i} className="absolute w-[4px] h-[10px] bg-red-500"
            style={{ left: b.x, top: b.y }} />
        ))}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <img
              src={
                win
                  ? "/images/space-invaders/win.png"
                  : "/images/space-invaders/game-over.png"
              }
              className="mb-4 w-[400px]"
            />

            <div className="mb-2 text-2xl">Score: {score}</div>

            {finalTime && (
              <div className="mb-4 text-xl">
                Time: {formatTime(finalTime)}
              </div>
            )}

            <img
              src="/images/space-invaders/restart.png"
              className="cursor-pointer w-[150px]"
              onClick={initGame}
            />
          </div>
        )}
      </div>
    </main>
  );
}