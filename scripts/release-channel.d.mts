export type ReleaseChannel = "stable" | "alpha" | "beta" | "rc";

export interface ReleaseChannelResolution {
	channel: ReleaseChannel;
	prerelease: boolean;
	title: string;
}

export function resolveReleaseChannel(notes: string, tag: string): ReleaseChannelResolution;
