function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export class Camera {
	scale = 1;
	x = 0;
	y = 0;
	readonly minScale = 0.2;
	readonly maxScale = 4;

	reset(width: number, height: number): void {
		this.scale = 1;
		this.x = width / 2;
		this.y = height / 2;
	}

	pan(dx: number, dy: number): void {
		this.x += dx;
		this.y += dy;
	}

	toWorld(screenX: number, screenY: number): { x: number; y: number } {
		return {
			x: (screenX - this.x) / this.scale,
			y: (screenY - this.y) / this.scale,
		};
	}

	zoomAt(screenX: number, screenY: number, factor: number): void {
		const world = this.toWorld(screenX, screenY);
		this.scale = clamp(this.scale * factor, this.minScale, this.maxScale);
		this.x = screenX - world.x * this.scale;
		this.y = screenY - world.y * this.scale;
	}
}
