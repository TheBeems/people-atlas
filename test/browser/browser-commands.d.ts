interface CdpTouchPoint {
	id: number;
	x: number;
	y: number;
}

interface CdpTouchStep {
	type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel";
	points: CdpTouchPoint[];
	delayAfterMs?: number | undefined;
}

declare module "vitest/browser" {
	interface BrowserCommands {
		dispatchTouch(selector: string, steps: CdpTouchStep[]): Promise<void>;
	}
}

export {};
