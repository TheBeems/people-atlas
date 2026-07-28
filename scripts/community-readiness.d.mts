export interface CommunityReadinessOptions {
	rootDir?: string;
	checkGit?: boolean;
}

export interface CommunityReadinessResult {
	errors: string[];
	id: string | undefined;
	name: string | undefined;
	sourceFileCount: number;
	version: string | undefined;
}

export const COMMUNITY_REQUIRED_FILES: readonly string[];
export const README_REQUIRED_HEADINGS: readonly string[];

export function validateCommunityReadiness(options?: CommunityReadinessOptions): Promise<CommunityReadinessResult>;
