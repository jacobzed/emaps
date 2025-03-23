/**
 * This file is AI generated.
 * Finds the Pole of Inaccessibility (visual center) of a polygon for optimal label placement.
 * Implementation based on the Polylabel algorithm by Vladimir Agafonkin:
 * https://github.com/mapbox/polylabel
 */
export class PoleLabelPlacement {
    private precision: number;

    constructor(precision = 1.0) {
        this.precision = precision;
    }

    /**
     * Find the best position for a label in the polygon
     * @param polygon Google Maps polygon to analyze
     * @returns LatLng position that is furthest from polygon edges
     */
    findPosition(polygon: google.maps.Polygon): google.maps.LatLng {
        // Get the bounds of the polygon
        const bounds = new google.maps.LatLngBounds();
        polygon.getPaths().getAt(0).forEach(point => bounds.extend(point));

        const width = bounds.getNorthEast().lng() - bounds.getSouthWest().lng();
        const height = bounds.getNorthEast().lat() - bounds.getSouthWest().lat();
        const cellSize = Math.min(width, height) / 10;

        let bestCell = this.findCandidate(polygon, bounds, cellSize);

        // Refine the best cell until we reach desired precision
        while (cellSize > this.precision) {
            bestCell = this.refineCell(polygon, bestCell, cellSize / 2);
        }

        return new google.maps.LatLng(bestCell.y, bestCell.x);
    }

    private findCandidate(
        polygon: google.maps.Polygon,
        bounds: google.maps.LatLngBounds,
        cellSize: number
    ): Cell {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        let bestCell: Cell = {
            x: 0,
            y: 0,
            distance: -Infinity
        };

        // Create a grid of points and find the one furthest from polygon edges
        for (let x = sw.lng(); x < ne.lng(); x += cellSize) {
            for (let y = sw.lat(); y < ne.lat(); y += cellSize) {
                const point = new google.maps.LatLng(y, x);

                if (!google.maps.geometry.poly.containsLocation(point, polygon)) {
                    continue;
                }

                const distance = this.getMinDistanceToEdge(point, polygon);
                if (distance > bestCell.distance) {
                    bestCell = { x, y, distance };
                }
            }
        }

        return bestCell;
    }

    private refineCell(polygon: google.maps.Polygon, cell: Cell, cellSize: number): Cell {
        let bestCell = cell;

        // Check 8 surrounding points at half the cell size
        for (let dx = -cellSize; dx <= cellSize; dx += cellSize) {
            for (let dy = -cellSize; dy <= cellSize; dy += cellSize) {
                const x = cell.x + dx;
                const y = cell.y + dy;
                const point = new google.maps.LatLng(y, x);

                if (!google.maps.geometry.poly.containsLocation(point, polygon)) {
                    continue;
                }

                const distance = this.getMinDistanceToEdge(point, polygon);
                if (distance > bestCell.distance) {
                    bestCell = { x, y, distance };
                }
            }
        }

        return bestCell;
    }

    private getMinDistanceToEdge(point: google.maps.LatLng, polygon: google.maps.Polygon): number {
        let minDistance = Infinity;

        // Check distance to each edge of the polygon
        polygon.getPaths().forEach(path => {
            const len = path.getLength();
            for (let i = 0; i < len; i++) {
                const p1 = path.getAt(i);
                const p2 = path.getAt((i + 1) % len);

                const distance = this.pointToSegmentDistance(
                    point.lat(), point.lng(),
                    p1.lat(), p1.lng(),
                    p2.lat(), p2.lng()
                );

                minDistance = Math.min(minDistance, distance);
            }
        });

        return minDistance;
    }

    private pointToSegmentDistance(
        px: number, py: number,
        x1: number, y1: number,
        x2: number, y2: number
    ): number {
        let dx = x2 - x1;
        let dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            return this.distance(px, py, x1, y1);
        }

        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);

        if (t < 0) {
            return this.distance(px, py, x1, y1);
        }
        if (t > 1) {
            return this.distance(px, py, x2, y2);
        }

        return this.distance(px, py, x1 + t * dx, y1 + t * dy);
    }

    private distance(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

interface Cell {
    x: number;
    y: number;
    distance: number;
}