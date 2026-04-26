// A* Pathfinding for grid-based tower defense

export interface GridPos {
  x: number;
  y: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

// Cells that are walkable (EMPTY=0, SPAWN=3, BASE=4)
function isWalkable(cell: number): boolean {
  return cell === 0 || cell === 3 || cell === 4;
}

export function findPath(
  grid: number[][],
  start: GridPos,
  end: GridPos,
  cols: number,
  rows: number
): GridPos[] | null {
  if (!isWalkable(grid[start.y][start.x]) || !isWalkable(grid[end.y][end.x])) {
    return null;
  }

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };

  openSet.push(startNode);

  while (openSet.length > 0) {
    // Find node with lowest f
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) {
        lowestIdx = i;
      }
    }
    const current = openSet[lowestIdx];

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    openSet.splice(lowestIdx, 1);
    closedSet.add(`${current.x},${current.y}`);

    // Check 4 neighbors (no diagonals for cleaner pathing)
    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
      if (!isWalkable(grid[n.y][n.x])) continue;
      if (closedSet.has(`${n.x},${n.y}`)) continue;

      const gScore = current.g + 1;
      const existing = openSet.find(node => node.x === n.x && node.y === n.y);

      if (!existing) {
        const h = heuristic(n, end);
        openSet.push({
          x: n.x,
          y: n.y,
          g: gScore,
          h,
          f: gScore + h,
          parent: current,
        });
      } else if (gScore < existing.g) {
        existing.g = gScore;
        existing.f = gScore + existing.h;
        existing.parent = current;
      }
    }
  }

  return null; // No path found
}

function heuristic(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(node: AStarNode): GridPos[] {
  const path: GridPos[] = [];
  let current: AStarNode | null = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}

// Check if placing a tower at (x,y) would block all paths
// spawnPoints and basePoints are arrays of grid positions
export function wouldBlockPath(
  grid: number[][],
  towerX: number,
  towerY: number,
  spawnPoints: GridPos[],
  basePoints: GridPos[],
  cols: number,
  rows: number
): boolean {
  // Temporarily block the cell
  const original = grid[towerY][towerX];
  grid[towerY][towerX] = 1;

  let blocked = false;
  for (const spawn of spawnPoints) {
    let hasPath = false;
    for (const base of basePoints) {
      const path = findPath(grid, spawn, base, cols, rows);
      if (path) {
        hasPath = true;
        break;
      }
    }
    if (!hasPath) {
      blocked = true;
      break;
    }
  }

  // Restore
  grid[towerY][towerX] = original;
  return blocked;
}

// Find the shortest path from any spawn to any base
export function findBestPath(
  grid: number[][],
  spawnPoints: GridPos[],
  basePoints: GridPos[],
  cols: number,
  rows: number
): GridPos[] | null {
  let bestPath: GridPos[] | null = null;

  for (const spawn of spawnPoints) {
    for (const base of basePoints) {
      const path = findPath(grid, spawn, base, cols, rows);
      if (path && (!bestPath || path.length < bestPath.length)) {
        bestPath = path;
      }
    }
  }

  return bestPath;
}
