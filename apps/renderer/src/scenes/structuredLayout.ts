export type Point = {x: number; y: number};

export const getAdaptiveGridColumns = (
  itemCount: number,
  maxColumns = 4,
): number => {
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    throw new Error("itemCount must be a positive integer");
  }
  if (!Number.isInteger(maxColumns) || maxColumns < 1) {
    throw new Error("maxColumns must be a positive integer");
  }

  if (itemCount <= maxColumns) return itemCount;
  if (itemCount <= 6 && maxColumns >= 3) return 3;
  return Math.min(maxColumns, Math.ceil(itemCount / 2));
};

export const getFlowchartPositions = (
  nodeCount: number,
  width = 1500,
  height = 500,
): Point[] => {
  const columns = getAdaptiveGridColumns(nodeCount, 4);
  const rows = Math.ceil(nodeCount / columns);
  const horizontalPadding = 170;
  const verticalPadding = rows === 1 ? height / 2 : 80;
  const usableWidth = width - horizontalPadding * 2;
  const usableHeight = Math.max(1, height - verticalPadding * 2);

  return Array.from({length: nodeCount}, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const nodesInRow = Math.min(columns, nodeCount - row * columns);
    const rowWidth =
      nodesInRow === 1 ? 0 : usableWidth * ((nodesInRow - 1) / Math.max(1, columns - 1));
    const rowStart = width / 2 - rowWidth / 2;
    const x =
      nodesInRow === 1
        ? width / 2
        : rowStart + (rowWidth * col) / (nodesInRow - 1);
    const y =
      rows === 1
        ? height / 2
        : verticalPadding + (usableHeight * row) / Math.max(1, rows - 1);
    return {x, y};
  });
};

export const getOrbitPositions = (
  itemCount: number,
  center: Point,
  radiusX: number,
  radiusY: number,
): Point[] => {
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    throw new Error("itemCount must be a positive integer");
  }

  return Array.from({length: itemCount}, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / itemCount;
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
  });
};
