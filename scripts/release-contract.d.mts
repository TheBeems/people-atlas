export const REQUIRED_MIN_APP_VERSION: string;
export const RELEASE_ASSETS: readonly string[];
export const REQUIRED_INPUTS: readonly string[];

export interface ReleaseContractOptions {
	rootDir?: string;
	tag?: string;
}

export interface ReleaseContractResult {
	assets: string[];
	bundleBytes: number | undefined;
	errors: string[];
	version: string | undefined;
}

export function validateReleaseContract(options?: ReleaseContractOptions): Promise<ReleaseContractResult>;
