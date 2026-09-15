#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Chrome profile (cookies, logins)");
	process.exit(1);
}

const platform = os.platform(); // "darwin" | "win32" | "linux"
const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();

// --- Locate the Chrome executable per platform ---
function findChrome() {
	if (platform === "darwin") {
		return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
	}
	if (platform === "win32") {
		const candidates = [
			process.env.ProgramFiles,
			process.env["ProgramFiles(x86)"],
			process.env.LOCALAPPDATA,
		]
			.filter(Boolean)
			.map((base) => path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
		for (const c of candidates) {
			if (fs.existsSync(c)) return c;
		}
		return "chrome.exe"; // fall back to PATH
	}
	// linux
	const linuxCandidates = [
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	];
	for (const c of linuxCandidates) {
		if (fs.existsSync(c)) return c;
	}
	return "google-chrome";
}

const CHROME = findChrome();

// --- Where the automated Chrome keeps its user-data-dir ---
const SCRAPING_DIR = path.join(HOME, ".cache", "browser-tools");

// Check if already running on :9222
try {
	const browser = await puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	});
	await browser.disconnect();
	console.log("✓ Chrome already running on :9222");
	process.exit(0);
} catch {}

// --- Cross-platform recursive copy (replaces macOS-only rsync) ---
const LOCK_FILES = new Set(["SingletonLock", "SingletonSocket", "SingletonCookie"]);
const SESSION_FILES = new Set(["Current Session", "Current Tabs", "Last Session", "Last Tabs"]);

function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		if (LOCK_FILES.has(entry.name)) continue;
		// Skip volatile session files / the Sessions directory to avoid lock issues
		if (SESSION_FILES.has(entry.name)) continue;
		if (entry.name === "Sessions") continue;

		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else if (entry.isFile()) {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// Setup profile directory
fs.mkdirSync(SCRAPING_DIR, { recursive: true });

// Remove SingletonLock to allow a new instance
for (const f of LOCK_FILES) {
	try {
		fs.rmSync(path.join(SCRAPING_DIR, f), { force: true });
	} catch {}
}

if (useProfile) {
	console.log("Syncing profile...");
	let srcProfile;
	if (platform === "darwin") {
		srcProfile = path.join(HOME, "Library", "Application Support", "Google", "Chrome");
	} else if (platform === "win32") {
		const local = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
		srcProfile = path.join(local, "Google", "Chrome", "User Data");
	} else {
		srcProfile = path.join(HOME, ".config", "google-chrome");
	}

	if (!fs.existsSync(srcProfile)) {
		console.log(`⚠ Source profile not found at ${srcProfile}; starting without profile`);
	} else {
		// Mimic rsync --delete: start from a clean copy of the profile
		fs.rmSync(SCRAPING_DIR, { recursive: true, force: true });
		copyDir(srcProfile, SCRAPING_DIR);
		console.log("✓ Profile synced");
	}
}

// Start Chrome with remote debugging enabled (force a fresh, separate instance)
spawn(
	CHROME,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${SCRAPING_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
	{ detached: true, stdio: "ignore" },
).unref();

// Wait for Chrome to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

console.log(`✓ Chrome started on :9222${useProfile ? " with your profile" : ""} (${CHROME})`);
