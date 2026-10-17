// Frontend end-to-end config. Drives a real browser against the actual
// running server (not a mock) — see docs/features/home.md and
// docs/features/resume.md for the behavior these specs cover, and
// cmd/server/e2e_test.go for the backend half of this coverage.
//
// Requires DATABASE_URL (or .env — see .env.example) exactly like the
// server itself, since `webServer` below boots the real app via `make
// run`, migrations and all — there is no mocked backend here.
const { defineConfig, devices } = require('@playwright/test');

// E2E_BASE_URL points the suite at an already-running server (e.g.
// `PORT=8090 go run ./cmd/server`, then
// `E2E_BASE_URL=http://localhost:8090 npx playwright test -c e2e/playwright.config.js`).
// When it's set, no webServer is started or reused, so nothing touches
// :8080 (a developer's own server may be running there). The caller owns
// that server, including the fake LTA if e2e/bus-stops.spec.js is in scope.
// Unset, behavior is unchanged: :8080, started or reused below.
const externalBaseURL = process.env.E2E_BASE_URL;

module.exports = defineConfig({
	testDir: '.',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: 'list',
	use: {
		baseURL: externalBaseURL || 'http://localhost:8080',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		// WebKit is Safari's actual engine — worth running against
		// directly rather than assuming Chromium coverage transfers,
		// since this site is developed and used on macOS/Safari.
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
	// Two processes: the dev-only fake LTA DataMall (cmd/fakelta) that the
	// Bus Stop Finder spec needs, and the real server pointed at it via
	// `make run-e2e`, which also isolates the bus tables in a bus_e2e schema
	// so the fake fixtures never mix with real synced LTA data. With
	// reuseExistingServer, an already-running server on :8080 is used as-is
	// — start it with `make run-e2e` (not `make run`) for
	// e2e/bus-stops.spec.js to pass. See docs/features/bus-stop-finder.md's
	// Testing Plan.
	webServer: externalBaseURL ? undefined : [
		{
			command: 'go run ./cmd/fakelta',
			cwd: '..',
			url: 'http://127.0.0.1:8099/healthz',
			reuseExistingServer: true,
			timeout: 60_000,
		},
		{
			command: 'make run-e2e',
			cwd: '..',
			url: 'http://localhost:8080/healthz',
			reuseExistingServer: true,
			timeout: 60_000,
		},
	],
});
