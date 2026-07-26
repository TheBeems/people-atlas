import type { NodeId } from "../domain/types";
import type { LayoutCamera } from "./layout-state";

export interface TouchPoint {
	x: number;
	y: number;
}

export interface TouchContact extends TouchPoint {
	pointerId: number;
	time: number;
	targetId?: NodeId | undefined;
}

export interface TouchGestureUpdate {
	camera?: LayoutCamera | undefined;
	cancelLongPress: boolean;
	tapTargetId?: NodeId | null | undefined;
	persistLayout: boolean;
}

interface TrackedTouch extends TouchContact {
	startX: number;
	startY: number;
}

interface PinchBaseline {
	pointerIds: [number, number];
	first: TouchPoint;
	second: TouchPoint;
	camera: LayoutCamera;
}

const MOVEMENT_LIMIT = 8;
const TAP_TIME_LIMIT = 500;

function distance(left: TouchPoint, right: TouchPoint): number {
	return Math.hypot(right.x - left.x, right.y - left.y);
}

function centroid(left: TouchPoint, right: TouchPoint): TouchPoint {
	return {
		x: (left.x + right.x) / 2,
		y: (left.y + right.y) / 2,
	};
}

function cameraChanged(left: LayoutCamera, right: LayoutCamera): boolean {
	return left.x !== right.x || left.y !== right.y || left.scale !== right.scale;
}

export function calculatePinchCamera(
	baselineCamera: LayoutCamera,
	baselineFirst: TouchPoint,
	baselineSecond: TouchPoint,
	currentFirst: TouchPoint,
	currentSecond: TouchPoint,
	minScale: number,
	maxScale: number,
): LayoutCamera {
	const baselineCentroid = centroid(baselineFirst, baselineSecond);
	const currentCentroid = centroid(currentFirst, currentSecond);
	const baselineDistance = Math.max(Number.EPSILON, distance(baselineFirst, baselineSecond));
	const currentDistance = distance(currentFirst, currentSecond);
	const scale = Math.min(maxScale, Math.max(minScale, baselineCamera.scale * (currentDistance / baselineDistance)));
	const worldX = (baselineCentroid.x - baselineCamera.x) / baselineCamera.scale;
	const worldY = (baselineCentroid.y - baselineCamera.y) / baselineCamera.scale;
	return {
		x: currentCentroid.x - worldX * scale,
		y: currentCentroid.y - worldY * scale,
		scale,
	};
}

export class TouchGestureController {
	private readonly touches = new Map<number, TrackedTouch>();
	private camera: LayoutCamera = { x: 0, y: 0, scale: 1 };
	private gestureStartCamera: LayoutCamera = { x: 0, y: 0, scale: 1 };
	private singleBaseline: { pointerId: number; point: TouchPoint; camera: LayoutCamera } | undefined;
	private pinchBaseline: PinchBaseline | undefined;
	private tapEligible = false;
	private longPressConsumed = false;
	private continuationOnly = false;

	constructor(
		private readonly minScale: number,
		private readonly maxScale: number,
	) {}

	begin(contact: TouchContact, camera: LayoutCamera): TouchGestureUpdate {
		if (this.touches.size === 0) {
			this.camera = { ...camera };
			this.gestureStartCamera = { ...camera };
			this.tapEligible = true;
			this.longPressConsumed = false;
			this.continuationOnly = false;
			this.singleBaseline = {
				pointerId: contact.pointerId,
				point: { x: contact.x, y: contact.y },
				camera: { ...camera },
			};
			this.pinchBaseline = undefined;
		}
		this.touches.set(contact.pointerId, {
			...contact,
			startX: contact.x,
			startY: contact.y,
		});

		if (this.touches.size >= 2) {
			this.tapEligible = false;
			this.continuationOnly = true;
			if (!this.pinchBaseline) this.rebaselinePinch();
			return { cancelLongPress: true, persistLayout: false };
		}
		return { cancelLongPress: false, persistLayout: false };
	}

	move(pointerId: number, point: TouchPoint): TouchGestureUpdate {
		const touch = this.touches.get(pointerId);
		if (!touch || this.longPressConsumed) return { cancelLongPress: false, persistLayout: false };
		touch.x = point.x;
		touch.y = point.y;

		if (this.pinchBaseline) {
			const [firstId, secondId] = this.pinchBaseline.pointerIds;
			const first = this.touches.get(firstId);
			const second = this.touches.get(secondId);
			if (!first || !second) return { cancelLongPress: true, persistLayout: false };
			this.camera = calculatePinchCamera(
				this.pinchBaseline.camera,
				this.pinchBaseline.first,
				this.pinchBaseline.second,
				first,
				second,
				this.minScale,
				this.maxScale,
			);
			return { camera: { ...this.camera }, cancelLongPress: true, persistLayout: false };
		}

		const baseline = this.singleBaseline;
		if (!baseline || baseline.pointerId !== pointerId) return { cancelLongPress: false, persistLayout: false };
		const totalMovement = distance({ x: touch.startX, y: touch.startY }, touch);
		if (!this.continuationOnly && totalMovement <= MOVEMENT_LIMIT) {
			return { cancelLongPress: false, persistLayout: false };
		}
		this.tapEligible = false;
		this.camera = {
			x: baseline.camera.x + point.x - baseline.point.x,
			y: baseline.camera.y + point.y - baseline.point.y,
			scale: baseline.camera.scale,
		};
		return { camera: { ...this.camera }, cancelLongPress: true, persistLayout: false };
	}

	end(pointerId: number, point: TouchPoint, time: number): TouchGestureUpdate {
		const moved = this.move(pointerId, point);
		const touch = this.touches.get(pointerId);
		if (!touch) return { cancelLongPress: true, persistLayout: false };
		const wasLongPress = this.longPressConsumed;
		const wasActivePinch = this.pinchBaseline?.pointerIds.includes(pointerId) ?? false;
		const tapTargetId = this.tapEligible
			&& !wasLongPress
			&& this.touches.size === 1
			&& time - touch.time <= TAP_TIME_LIMIT
			&& distance({ x: touch.startX, y: touch.startY }, touch) <= MOVEMENT_LIMIT
				? touch.targetId ?? null
				: undefined;

		this.touches.delete(pointerId);
		if (this.touches.size === 0) {
			const persistLayout = cameraChanged(this.gestureStartCamera, this.camera) && !wasLongPress;
			this.reset();
			return { camera: moved.camera, cancelLongPress: true, tapTargetId, persistLayout };
		}

		this.tapEligible = false;
		this.continuationOnly = true;
		if (this.touches.size >= 2) {
			if (wasActivePinch) this.rebaselinePinch();
		} else {
			this.pinchBaseline = undefined;
			const remaining = this.touches.values().next().value as TrackedTouch | undefined;
			if (remaining) {
				remaining.startX = remaining.x;
				remaining.startY = remaining.y;
				this.singleBaseline = {
					pointerId: remaining.pointerId,
					point: { x: remaining.x, y: remaining.y },
					camera: { ...this.camera },
				};
			}
		}
		return { camera: moved.camera, cancelLongPress: true, persistLayout: false };
	}

	consumeLongPress(pointerId: number): NodeId | undefined {
		if (!this.tapEligible || this.touches.size !== 1) return undefined;
		const touch = this.touches.get(pointerId);
		if (!touch?.targetId) return undefined;
		if (distance({ x: touch.startX, y: touch.startY }, touch) > MOVEMENT_LIMIT) return undefined;
		this.longPressConsumed = true;
		this.tapEligible = false;
		return touch.targetId;
	}

	cancel(): number[] {
		const pointerIds = [...this.touches.keys()];
		this.reset();
		return pointerIds;
	}

	get activePointerIds(): number[] {
		return [...this.touches.keys()];
	}

	private rebaselinePinch(): void {
		const [first, second] = [...this.touches.values()];
		if (!first || !second) {
			this.pinchBaseline = undefined;
			return;
		}
		this.pinchBaseline = {
			pointerIds: [first.pointerId, second.pointerId],
			first: { x: first.x, y: first.y },
			second: { x: second.x, y: second.y },
			camera: { ...this.camera },
		};
		this.singleBaseline = undefined;
	}

	private reset(): void {
		this.touches.clear();
		this.singleBaseline = undefined;
		this.pinchBaseline = undefined;
		this.tapEligible = false;
		this.longPressConsumed = false;
		this.continuationOnly = false;
	}
}
