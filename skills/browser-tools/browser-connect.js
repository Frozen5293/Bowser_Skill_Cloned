#!/usr/bin/env node

// Shared CDP connection helper for the browser-tools scripts.
//
// Why this exists:
//   - `puppeteer.connect({ browserURL })` first fetches /json/version, then opens a
//     websocket. When Chrome has accumulated extra targets (chrome:// pages, recaptcha
//     workers) that discovery step can hang, producing the "connect timeout" failures.
//   - The old scripts used a hard 5s timeout and picked `(await b.pages()).at(-1)`,
//     which could select a non-page target.
//
// This helper connects straight to the webSocketDebuggerUrl from /json/version, uses a
// configurable timeout, and selects only real page targets.

import puppeteer from "puppeteer-core";

const HOST = (process.env.CDP_HOST || "http://localhost:9222").replace(/\/$/, "");
const CONNECT_TIMEOUT = Number(process.env.CDP_CONNECT_TIMEOUT || 15000);
const PROBE_TIMEOUT = Number(process.env.CDP_PROBE_TIMEOUT || 2000);

/**
 * Quickly check whether a CDP endpoint is reachable. Avoids the old 5s hang when the
 * Chrome instance has died: we fail fast with a clear message instead.
 * @returns {Promise<{webSocketDebuggerUrl: string, Browser: string} | null>}
 */
export async function probeBrowser() {
	try {
		const res = await fetch(`${HOST}/json/version`, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT),
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/**
 * Connect to the running Chrome over CDP, or exit with a helpful message.
 * @returns {Promise<import("puppeteer-core").Browser>}
 */
export async function connectBrowser() {
	const info = await probeBrowser();
	if (!info?.webSocketDebuggerUrl) {
		console.error(`✗ Chrome is not running on ${HOST}`);
		console.error("  Run: browser-start.js");
		process.exit(1);
	}

	return puppeteer.connect({
		browserWSEndpoint: info.webSocketDebuggerUrl,
		defaultViewport: null,
		protocolTimeout: CONNECT_TIMEOUT,
	});
}

/**
 * Return the most relevant page target:
 *   - prefer the last non-blank, non-chrome:// page
 *   - fall back to the last real page
 *   - if none exists, open a new one
 * @param {import("puppeteer-core").Browser} browser
 * @returns {Promise<import("puppeteer-core").Page>}
 */
export async function getActivePage(browser) {
	const pages = (await browser.pages()).filter((p) => {
		const url = p.url();
		return url !== "about:blank" && !url.startsWith("chrome://");
	});
	if (pages.length > 0) return pages.at(-1);

	const allPages = await browser.pages();
	if (allPages.length > 0) return allPages.at(-1);

	return browser.newPage();
}
