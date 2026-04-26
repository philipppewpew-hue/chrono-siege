import * as Phaser from 'phaser';
import {
  TILE_SIZE, GRID_COLS, GRID_ROWS, GRID_OFFSET_X, GRID_OFFSET_Y, COLORS
} from '../config';
import { findPath, wouldBlockPath, GridPos } from '../utils/Pathfinding';

export enum CellType {
  EMPTY = 0,
  TOWER = 1,
  BLOCKED = 2,
  SPAWN = 3,
  BASE = 4,
}

export class GridManager {
  public grid: number[][];
  public spawnPoints: GridPos[] = [];
  public basePoints: GridPos[] = [];
  public currentPath: GridPos[] | null = null;

  private scene: Phaser.Scene;
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private pathOverlay: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.grid = [];
    this.pathOverlay = scene.add.graphics();

    this.initGrid();
    this.renderGrid();
    this.recalculatePath();
  }

  private initGrid(): void {
    // Initialize empty grid
    for (let y = 0; y < GRID_ROWS; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        this.grid[y][x] = CellType.EMPTY;
      }
    }

    // Set spawn points (left side, multiple entry points)
    const spawnYPositions = [2, 5, 9];
    for (const sy of spawnYPositions) {
      this.grid[sy][0] = CellType.SPAWN;
      this.spawnPoints.push({ x: 0, y: sy });
    }

    // Set base points (right side)
    const baseYPositions = [3, 5, 8];
    for (const by of baseYPositions) {
      this.grid[by][GRID_COLS - 1] = CellType.BASE;
      this.basePoints.push({ x: GRID_COLS - 1, y: by });
    }

    // Blocked terrain — forces maze building and creates strategic choke points
    const blockedPositions: GridPos[] = [
      // Top water feature (larger)
      { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 1 }, { x: 6, y: 1 },
      // Upper rock wall (forces early pathing decisions)
      { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
      // Central rock formation (bigger — key obstacle)
      { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 },
      { x: 9, y: 6 }, { x: 10, y: 6 },
      // Lower corridor blocker
      { x: 5, y: 8 }, { x: 6, y: 8 },
      { x: 13, y: 7 }, { x: 14, y: 7 },
      // Bottom water feature (larger)
      { x: 13, y: 10 }, { x: 14, y: 10 }, { x: 15, y: 10 },
      { x: 14, y: 11 }, { x: 15, y: 11 },
      // Scattered rocks for flavor
      { x: 3, y: 10 }, { x: 7, y: 1 }, { x: 16, y: 2 }, { x: 17, y: 8 },
      { x: 12, y: 1 }, { x: 2, y: 6 },
    ];

    for (const pos of blockedPositions) {
      if (pos.x >= 0 && pos.x < GRID_COLS && pos.y >= 0 && pos.y < GRID_ROWS) {
        this.grid[pos.y][pos.x] = CellType.BLOCKED;
      }
    }
  }

  private renderGrid(): void {
    for (let y = 0; y < GRID_ROWS; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        const px = GRID_OFFSET_X + x * TILE_SIZE;
        const py = GRID_OFFSET_Y + y * TILE_SIZE;

        let texture: string;
        switch (this.grid[y][x]) {
          case CellType.SPAWN:
            texture = 'tile_spawn';
            break;
          case CellType.BASE:
            texture = 'tile_base';
            break;
          case CellType.BLOCKED:
            texture = 'tile_blocked';
            break;
          default:
            texture = 'tile_grass';
        }

        const tile = this.scene.add.image(px, py, texture).setOrigin(0, 0);
        this.tileSprites[y][x] = tile;
      }
    }
  }

  canPlace(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
    if (this.grid[y][x] !== CellType.EMPTY) return false;

    // Check if placing here would block the path
    return !wouldBlockPath(this.grid, x, y, this.spawnPoints, this.basePoints, GRID_COLS, GRID_ROWS);
  }

  placeTower(x: number, y: number): boolean {
    if (!this.canPlace(x, y)) return false;
    this.grid[y][x] = CellType.TOWER;
    this.recalculatePath();
    return true;
  }

  removeTower(x: number, y: number): void {
    if (this.grid[y][x] === CellType.TOWER) {
      this.grid[y][x] = CellType.EMPTY;
      this.tileSprites[y][x].setTexture('tile_grass');
      this.recalculatePath();
    }
  }

  recalculatePath(): void {
    // Find paths from all spawns to all bases
    // We use the first valid path for visualization
    let bestPath: GridPos[] | null = null;

    for (const spawn of this.spawnPoints) {
      for (const base of this.basePoints) {
        const path = findPath(this.grid, spawn, base, GRID_COLS, GRID_ROWS);
        if (path && (!bestPath || path.length < bestPath.length)) {
          bestPath = path;
        }
      }
    }

    this.currentPath = bestPath;
    this.drawPathOverlay();
  }

  getPathForSpawn(spawnIndex: number): GridPos[] | null {
    const spawn = this.spawnPoints[spawnIndex % this.spawnPoints.length];
    let bestPath: GridPos[] | null = null;

    for (const base of this.basePoints) {
      const path = findPath(this.grid, spawn, base, GRID_COLS, GRID_ROWS);
      if (path && (!bestPath || path.length < bestPath.length)) {
        bestPath = path;
      }
    }

    return bestPath;
  }

  getRandomSpawnPath(): { path: GridPos[]; spawnIndex: number } | null {
    const spawnIndex = Math.floor(Math.random() * this.spawnPoints.length);
    const path = this.getPathForSpawn(spawnIndex);
    if (path) return { path, spawnIndex };

    // Try all spawns
    for (let i = 0; i < this.spawnPoints.length; i++) {
      const p = this.getPathForSpawn(i);
      if (p) return { path: p, spawnIndex: i };
    }
    return null;
  }

  worldToGrid(wx: number, wy: number): GridPos | null {
    const x = Math.floor((wx - GRID_OFFSET_X) / TILE_SIZE);
    const y = Math.floor((wy - GRID_OFFSET_Y) / TILE_SIZE);
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return null;
    return { x, y };
  }

  gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: GRID_OFFSET_X + gx * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + gy * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  private drawPathOverlay(): void {
    this.pathOverlay.clear();
    if (!this.currentPath) return;

    // Draw subtle path indicators
    for (let i = 0; i < this.currentPath.length; i++) {
      const p = this.currentPath[i];
      const px = GRID_OFFSET_X + p.x * TILE_SIZE;
      const py = GRID_OFFSET_Y + p.y * TILE_SIZE;

      // Skip spawn and base tiles
      if (this.grid[p.y][p.x] === CellType.SPAWN || this.grid[p.y][p.x] === CellType.BASE) continue;

      this.pathOverlay.fillStyle(0xffa500, 0.08);
      this.pathOverlay.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      // Directional dots
      if (i < this.currentPath.length - 1) {
        const next = this.currentPath[i + 1];
        const cx = px + TILE_SIZE / 2;
        const cy = py + TILE_SIZE / 2;
        const nx = GRID_OFFSET_X + next.x * TILE_SIZE + TILE_SIZE / 2;
        const ny = GRID_OFFSET_Y + next.y * TILE_SIZE + TILE_SIZE / 2;
        const mx = (cx + nx) / 2;
        const my = (cy + ny) / 2;

        this.pathOverlay.fillStyle(0xffa500, 0.15);
        this.pathOverlay.fillCircle(mx, my, 2);
      }
    }
  }
}
