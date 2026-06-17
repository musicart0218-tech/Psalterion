import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { LegendsScene, PhaserEventBus } from './PhaserGame';
import { PlayerState } from '@/packages/shared/src/index';

interface GameContainerProps {
  socket: Socket | null;
  selfId: string | null;
  onTargetSelected: (targetId: string | null) => void;
  onStatsUpdated: (stats: PlayerState) => void;
}

export const GameContainer: React.FC<GameContainerProps> = ({
  socket,
  selfId,
  onTargetSelected,
  onStatsUpdated,
}) => {
  const parentElRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<LegendsScene | null>(null);

  useEffect(() => {
    if (!socket || !selfId || !parentElRef.current) return;

    // Canvas container sizing
    const rect = parentElRef.current.getBoundingClientRect();

    // Phaser Config
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: rect.width || 800,
      height: rect.height || 500,
      parent: parentElRef.current,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [LegendsScene],
    };

    // Instantiate Phaser
    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Start scene with Socket inject
    const onSceneReady = (scene: LegendsScene) => {
      if (!scene.getHasSocketLoaded()) {
        game.scene.start('LegendsScene', { socket, selfId });
      } else {
        sceneRef.current = scene;
      }
    };

    PhaserEventBus.on('sceneReady', onSceneReady);

    // Capture selections and stat syncs to report to React HUD
    const handleTargetSelected = (id: string | null) => {
      onTargetSelected(id);
    };

    const handleSelfStatsUpdated = (stats: PlayerState) => {
      onStatsUpdated(stats);
    };

    PhaserEventBus.on('targetSelected', handleTargetSelected);
    PhaserEventBus.on('selfStatsUpdated', handleSelfStatsUpdated);

    // Setup ResizeObserver for responsive canvas sizing (as required by rules)
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !gameRef.current) return;
      const { width, height } = entries[0].contentRect;
      
      // Update canvas dimensions dynamically
      gameRef.current.scale.resize(width, height);
    });

    resizeObserver.observe(parentElRef.current);

    // Clean up
    return () => {
      resizeObserver.disconnect();
      PhaserEventBus.off('sceneReady', onSceneReady);
      PhaserEventBus.off('targetSelected', handleTargetSelected);
      PhaserEventBus.off('selfStatsUpdated', handleSelfStatsUpdated);
      
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      sceneRef.current = null;
    };
  }, [socket, selfId]);

  return (
    <div className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
      {/* Target Canvas Insertion */}
      <div id="phaser-game-canvas" ref={parentElRef} className="w-full h-full" />

      {/* Touch Control HUD overlay triggers for mobile users */}
      <div className="absolute right-4 bottom-4 flex flex-col items-end gap-3 pointer-events-none md:hidden">
        <div className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded">
          Swipe/WASD to move
        </div>
      </div>
    </div>
  );
};
