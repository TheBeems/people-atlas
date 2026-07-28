import esbuild from "esbuild";
import { rm } from "node:fs/promises";
import process from "node:process";
import { builtinModules } from "node:module";

const mode = process.argv[2];
const production = mode === "production";
const oneShotDevelopment = mode === "development";

if (production) {
	await rm("main.js.map", { force: true });
}

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	minify: production,
	sourcemap: production ? false : "external",
	treeShaking: true,
	outfile: "main.js",
});

if (production || oneShotDevelopment) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
}
