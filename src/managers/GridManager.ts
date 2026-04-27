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

    // Procedurally generate blocked terrain — different layout each game
    this.generateProceduralObstacles();
  }

  /**
   * Generate random obstacles on the map.
   * Strategy: place ~4-6 cluster obstacles + scattered single tiles.
   * After each placement, verify all spawn-to-base paths still exist.
   */
  private generateProceduralObstacles(): void {
    const targetClusters = 4 + Math.floor(Math.random() * 3); // 4-6 clusters
    const targetSingles = 5 + Math.floor(Math.random() * 4); // 5-8 scattered

    let clustersPlaced = 0;
    let singlesPlaced = 0;
    let attempts = 0;
    const maxAttempts = 200;

    // Place cluster obstacles (2-5 tiles in random shapes)
    while (clustersPlaced < targetClusters && attempts < maxAttempts) {
      attempts++;
      const cx = 2 + Math.floor(Math.random() * (GRID_COLS - 4));
      const cy = 1 + Math.floor(Math.random() * (GRID_ROWS - 2));

      // Random cluster shape
      const shape = this.randomClusterShape();
      const tiles: GridPos[] = shape.map(p => ({ x: cx + p.x, y: cy + p.y }))
        .filter(p => p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS);

      // Skip if any tile is occupied or too close to spawn/base lanes
      const valid = tiles.every(t => {
        if (this.grid[t.y][t.x] !== CellType.EMPTY) return false;
        // Don't block right next to spawn (column 0-1) or base (last 2 columns)
        if (t.x <= 1 || t.x >= GRID_COLS - 2) return false;
        return true;
      });
      if (!valid) continue;

      // Try to place the cluster
      for (const t of tiles) this.grid[t.y][t.x] = CellType.BLOCKED;

      // Verify paths still exist
      if (this.allPathsExist()) {
        clustersPlaced++;
      } else {
        // Revert
        for (const t of tiles) this.grid[t.y][t.x] = CellType.EMPTY;
      }
    }

    // Place scattered single tiles
    attempts = 0;
    while (singlesPlaced < targetSingles && attempts < maxAttempts) {
      attempts++;
      const x = 2 + Math.floor(Math.random() * (GRID_COLS - 4));
      const y = Math.floor(Math.random() * GRID_ROWS);

      if (this.grid[y][x] !== CellType.EMPTY) continue;

      this.grid[y][x] = CellType.BLOCKED;
      if (this.allPathsExist()) {
        singlesPlaced++;
      } else {
        this.grid[y][x] = CellType.EMPTY;
      }
    }
  }

  /** Random cluster shape — 2-5 tiles around (0,0) */
  private randomClusterShape(): GridPos[] {
    const shapes: GridPos[][] = [
      // Vertical wall (3 tiles)
      [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
      // Horizontal wall (3 tiles)
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      // L-shape
      [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      // Square (2x2)
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      // Plus
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }],
      // Diagonal pair
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      // T-shape
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
      // Long horizontal (4 tiles)
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      // Z-shape
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      // Single
      [{ x: 0, y: 0 }],
    ];
    return shapes[Math.floor(Math.random() * shapes.length)];
  }

  /** Verify a path exists from every spawn to at least one base */
  private allPathsExist(): boolean {
    for (const spawn of this.spawnPoints) {
      let found = false;
      for (const base of this.basePoints) {
        const path = findPath(this.grid, spawn, base, GRID_COLS, GRID_ROWS);
        if (path) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
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
