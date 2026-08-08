export function collectIntegrationTestFiles(rootDir?: string): Promise<string[]>;

export function runIntegrationTests(options?: {
	rootDir?: string;
	vitestCli?: string;
	runTestFile?: (filePath: string) => Promise<number> | number;
	log?: (...args: unknown[]) => void;
	error?: (...args: unknown[]) => void;
}): Promise<number>;
