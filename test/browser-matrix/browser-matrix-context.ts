export type BrowserMatrixFactor = 1 | 1.5 | 2;

declare module "vitest" {
	export interface ProvidedContext {
		browserMatrixExpectedFactor: BrowserMatrixFactor;
	}
}
