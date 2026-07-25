import type { AtlasViewState } from "./view-state";

export const VIEW_STATE_WRITE_DELAY_MS = 120;

interface Waiter {
	resolve(): void;
	reject(error: unknown): void;
}

interface PendingWrite {
	state: AtlasViewState;
	timer?: ReturnType<typeof setTimeout>;
	waiters: Waiter[];
}

export class ViewStateWriteCoordinator {
	private readonly pending = new Map<string, PendingWrite>();
	private readonly latest = new Map<string, AtlasViewState>();
	// 10x: one queue is sufficient for low-volume plugin-data writes; split by
	// view key only if measured persistence latency makes serialization visible.
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(
		private readonly write: (viewConfigurationKey: string, state: AtlasViewState) => Promise<void>,
		private readonly delayMs = VIEW_STATE_WRITE_DELAY_MS,
	) {}

	getLatest(viewConfigurationKey: string): AtlasViewState | undefined {
		const state = this.latest.get(viewConfigurationKey);
		return state ? structuredClone(state) : undefined;
	}

	schedule(viewConfigurationKey: string, state: AtlasViewState): Promise<void> {
		const snapshot = structuredClone(state);
		this.latest.set(viewConfigurationKey, snapshot);
		const existing = this.pending.get(viewConfigurationKey);
		if (existing?.timer) clearTimeout(existing.timer);

		return new Promise<void>((resolve, reject) => {
			const pending = existing ?? {
				state: snapshot,
				waiters: [],
			};
			pending.state = snapshot;
			pending.waiters.push({ resolve, reject });
			pending.timer = setTimeout(() => void this.commit(viewConfigurationKey), this.delayMs);
			this.pending.set(viewConfigurationKey, pending);
		});
	}

	flush(viewConfigurationKey: string): Promise<void> {
		const pending = this.pending.get(viewConfigurationKey);
		if (!pending) return this.writeQueue;
		if (pending.timer) clearTimeout(pending.timer);
		return this.commit(viewConfigurationKey);
	}

	serialize<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.writeQueue.then(operation, operation);
		this.writeQueue = result.then(() => undefined, () => undefined);
		return result;
	}

	private commit(viewConfigurationKey: string): Promise<void> {
		const pending = this.pending.get(viewConfigurationKey);
		if (!pending) return this.writeQueue;
		this.pending.delete(viewConfigurationKey);
		const operation = () => this.write(viewConfigurationKey, structuredClone(pending.state));
		const result = this.serialize(operation);
		result.then(
			() => pending.waiters.forEach((waiter) => waiter.resolve()),
			(error) => pending.waiters.forEach((waiter) => waiter.reject(error)),
		);
		return result;
	}
}
