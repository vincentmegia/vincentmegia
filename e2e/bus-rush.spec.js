// /bus-rush: canvas game, HUD, start/run-over/shop overlays and the
// Postgres-backed leaderboard (docs/features/bus-rush.md). A natural crash
// depends on random traffic, so tests that need a finished run call
// window.__busRushTestHooks.crash(), which applies real hits through the
// game's own hit()/endRun() path.
const { test, expect } = require('@playwright/test');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Same resolution as fishing-game.spec.js: process env wins, else .env.
function databaseURL() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const envPath = path.join(__dirname, '..', '.env');
	if (!fs.existsSync(envPath)) return undefined;
	for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
		const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/);
		if (match) return match[1];
	}
	return undefined;
}

// Deletes exactly the row this test submitted (no LIKE), in whichever
// schema the e2e server wrote it to.
async function deleteTestScore(playerName) {
	const client = new Client({ connectionString: databaseURL() });
	await client.connect();
	try {
		for (const table of ['bus_e2e.bus_rush_scores', 'public.bus_rush_scores']) {
			await client.query(`DELETE FROM ${table} WHERE player_name = $1`, [playerName]).catch(() => {});
		}
	} finally {
		await client.end();
	}
}

test('renders canvas, HUD and start screen with the other overlays hidden', async ({ page }) => {
	await page.goto('/bus-rush');
	await expect(page.locator('#bus-rush-canvas')).toBeVisible();
	await expect(page.locator('#bus-rush-start-screen')).toBeVisible();
	await expect(page.locator('#bus-rush-run-over-screen')).toBeHidden();
	await expect(page.locator('#bus-rush-shop-screen')).toBeHidden();
	await expect(page.locator('#bus-rush-leaderboard')).not.toContainText('Loading leaderboard');
});

test('Start Run begins a run: distance advances and ↑ raises speed', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await expect(page.locator('#bus-rush-start-screen')).toBeHidden();

	const distance = page.locator('#bus-rush-hud-distance');
	await expect.poll(async () => parseInt(await distance.textContent(), 10), { timeout: 5000 }).toBeGreaterThan(0);

	const speed = page.locator('#bus-rush-hud-speed');
	const before = parseInt(await speed.textContent(), 10);
	await page.keyboard.down('ArrowUp');
	await expect.poll(async () => parseInt(await speed.textContent(), 10), { timeout: 5000 }).toBeGreaterThan(before);
	await page.keyboard.up('ArrowUp');
});

test('crashing ends the run, awards tokens, and the shop spends them', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.crash());
	await expect(page.locator('#bus-rush-run-over-screen')).toBeVisible();
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText('0');

	await page.evaluate(() => window.__busRushTestHooks.grantTokens(100));
	await page.locator('#bus-rush-run-over-shop-button').click();
	const engine = page.locator('[data-upgrade-key="engine"]');
	await engine.locator('[data-upgrade-buy]').click();
	await expect(engine.locator('[data-upgrade-level]')).toHaveText('1');

	// Persisted across a reload.
	await page.reload();
	await page.locator('#bus-rush-start-shop-button').click();
	await expect(page.locator('[data-upgrade-key="engine"] [data-upgrade-level]')).toHaveText('1');
});

for (const kind of ['truck', 'semi']) {
	test(`hitting a ${kind} ends the run instantly, whatever lives are left`, async ({ page }) => {
		await page.goto('/bus-rush');
		await page.locator('#bus-rush-start-button').click();
		await expect(page.locator('#bus-rush-hud-lives')).not.toHaveText('0');
		await page.evaluate((k) => window.__busRushTestHooks.spawn(k), kind);
		await expect(page.locator('#bus-rush-run-over-screen')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('#bus-rush-run-over-title')).toContainText(`Flattened by a ${kind}!`);
		await expect(page.locator('#bus-rush-hud-lives')).toHaveText('0');
	});
}

for (const kind of ['schoolbus', 'citybus', 'doubledecker', 'bendy']) {
	test(`hitting an oncoming ${kind} costs one life, not the run`, async ({ page }) => {
		await page.goto('/bus-rush');
		await page.locator('#bus-rush-start-button').click();
		const lives = parseInt(await page.locator('#bus-rush-hud-lives').textContent(), 10);
		await page.evaluate((k) => window.__busRushTestHooks.spawn(k), kind);
		await expect(page.locator('#bus-rush-hud-lives')).toHaveText(String(lives - 1), { timeout: 5000 });
		await expect(page.locator('#bus-rush-run-over-screen')).toBeHidden();
	});
}

test('hitting a car costs one life, not the run', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	const lives = parseInt(await page.locator('#bus-rush-hud-lives').textContent(), 10);
	await page.evaluate(() => window.__busRushTestHooks.spawn('car'));
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(String(lives - 1), { timeout: 5000 });
	await expect(page.locator('#bus-rush-run-over-screen')).toBeHidden();
});

test('a finished run can be submitted to the leaderboard', async ({ page }) => {
	const playerName = `e2e-${Date.now() % 1_000_000}`;
	try {
		await page.goto('/bus-rush');
		await page.locator('#bus-rush-start-button').click();
		await page.evaluate(() => window.__busRushTestHooks.crash());
		await page.locator('#bus-rush-name-input').fill(playerName);
		await page.locator('#bus-rush-submit-button').click();
		await expect(page.locator('#bus-rush-leaderboard')).toContainText(playerName);
		await expect(page.locator('#bus-rush-submit-button')).toBeDisabled();
	} finally {
		await deleteTestScore(playerName);
	}
});

test('revisiting via HTMX still wires the game', async ({ page }) => {
	await page.goto('/projects');
	const card = page.locator('.project-card').filter({ hasText: 'Bus Rush' });
	await card.getByRole('link', { name: 'Play now' }).click();
	await expect(page).toHaveURL(/\/bus-rush$/);
	await page.goBack();
	await page.locator('.project-card').filter({ hasText: 'Bus Rush' }).getByRole('link', { name: 'Play now' }).click();
	await page.locator('#bus-rush-start-button').click();
	await expect.poll(async () => parseInt(await page.locator('#bus-rush-hud-distance').textContent(), 10), { timeout: 5000 }).toBeGreaterThan(0);
});

test('police are lethal: one ram is Busted, whatever lives are left', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await expect(page.locator('#bus-rush-hud-wanted')).toHaveText('★☆☆☆☆');
	await expect(page.locator('#bus-rush-hud-lives')).not.toHaveText('0');
	await page.evaluate(() => window.__busRushTestHooks.policeRam());
	await expect(page.locator('#bus-rush-run-over-screen')).toBeVisible({ timeout: 5000 });
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('Busted!');
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText('0');
});

test('crossing 800 m enters level 2: faster, and a higher wanted level', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await expect(page.locator('#bus-rush-hud-level')).toHaveText('1');
	const speed = page.locator('#bus-rush-hud-speed');
	const before = parseInt(await speed.textContent(), 10);
	await page.evaluate(() => window.__busRushTestHooks.warp(800));
	await expect(page.locator('#bus-rush-hud-level')).toHaveText('2');
	await expect.poll(async () => parseInt(await speed.textContent(), 10)).toBeGreaterThan(before);
	await expect(page.locator('#bus-rush-hud-wanted')).toHaveText('★★☆☆☆');
	await page.evaluate(() => window.__busRushTestHooks.crash());
	await expect(page.locator('#bus-rush-run-over-level')).toHaveText('2 · Heartland');
});

test('entering a new level refills lives', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	const lives = page.locator('#bus-rush-hud-lives');
	const full = parseInt(await lives.textContent(), 10);
	await page.evaluate(() => window.__busRushTestHooks.spawn('car'));
	await expect(lives).toHaveText(String(full - 1), { timeout: 5000 });
	await page.evaluate(() => window.__busRushTestHooks.warp(800));
	await expect(page.locator('#bus-rush-hud-level')).toHaveText('2');
	await expect(lives).toHaveText(String(full));
});

test('at full throttle with no damage, level 2 police fall behind instead of catching up', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => {
		window.__busRushTestHooks.noTraffic();
		window.__busRushTestHooks.warp(800);
	});
	await page.keyboard.down('ArrowUp');
	const gap = async () => (await page.evaluate(() => window.__busRushTestHooks.snapshot())).police[0];
	await expect.poll(gap, { timeout: 8000 }).not.toBeUndefined();
	const first = await gap();
	await page.waitForTimeout(3000);
	const snap = await page.evaluate(() => window.__busRushTestHooks.snapshot());
	expect(snap.status).toBe('playing');
	expect(snap.level).toBe(2);
	expect(snap.police[0]).toBeGreaterThan(first);
});

test('running over a banana skids the bus one lane over, locks steering, and costs no life', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	const snap = () => page.evaluate(() => window.__busRushTestHooks.snapshot());
	const lives = await page.locator('#bus-rush-hud-lives').textContent();
	const before = (await snap()).lane;
	await page.evaluate(() => window.__busRushTestHooks.banana());
	await expect.poll(async () => (await snap()).skidding, { timeout: 3000 }).toBe(true);
	const skidded = (await snap()).lane;
	expect(Math.abs(skidded - before)).toBe(1);
	// Steering is locked mid-skid: a lane change keypress is ignored.
	await page.keyboard.press(skidded > before ? 'ArrowLeft' : 'ArrowRight');
	expect((await snap()).lane).toBe(skidded);
	await expect.poll(async () => (await snap()).skidding).toBe(false);
	expect((await snap()).status).toBe('playing');
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(lives);
});

test('a police car that runs over a banana skids one lane over', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	const snap = () => page.evaluate(() => window.__busRushTestHooks.snapshot());
	const busLane = (await snap()).lane;
	await page.evaluate(() => window.__busRushTestHooks.policeBanana());
	await expect.poll(async () => (await snap()).policeSkidding, { timeout: 3000 }).toBe(1);
	const s = await snap();
	expect(s.policeLanes).toHaveLength(1);
	expect(Math.abs(s.policeLanes[0] - busLane)).toBe(1);
	expect(s.bananas).toBe(0);
	expect(s.status).toBe('playing');
});

test('buying a bus in the depot drives it, changes its lives, and persists', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	await expect(page.locator('#bus-rush-start-bus')).toHaveText('Single-decker');
	await page.evaluate(() => window.__busRushTestHooks.grantTokens(100));
	await page.locator('#bus-rush-start-shop-button').click();
	const single = page.locator('[data-bus-key="single"] [data-bus-select]');
	const minibus = page.locator('[data-bus-key="minibus"] [data-bus-select]');
	await expect(single).toHaveText('Driving');
	await expect(single).toBeDisabled();
	await minibus.click();
	await expect(minibus).toHaveText('Driving');
	await expect(single).toHaveText('Drive');
	await expect(page.locator('#bus-rush-shop-tokens')).toHaveText('40');
	await expect(page.locator('[data-bus-key="electric"] [data-bus-select]')).toBeDisabled(); // 150 > 40

	await page.reload();
	await expect(page.locator('#bus-rush-start-bus')).toHaveText('Minibus');
	await page.locator('#bus-rush-start-button').click();
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText('2'); // one fewer than the single-decker's 3
	expect((await page.evaluate(() => window.__busRushTestHooks.snapshot())).bus).toBe('minibus');
});

test('running over garbage halves top speed for a while, then it recovers, costing no life', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	// No traffic or police: a slowed bus that never steers would otherwise be
	// caught by a cruiser (police run at 80% of stock top speed; slowed is 50%).
	await page.evaluate(() => {
		window.__busRushTestHooks.noTraffic();
		window.__busRushTestHooks.noPolice();
	});
	const snap = () => page.evaluate(() => window.__busRushTestHooks.snapshot());
	await page.keyboard.down('ArrowUp');
	await expect.poll(async () => (await snap()).kmh).toBe(58); // stock top speed, level 1
	const lives = (await snap()).lives;
	await page.evaluate(() => window.__busRushTestHooks.garbage());
	await expect.poll(async () => (await snap()).slowed, { timeout: 3000 }).toBe(true);
	// Bleeds down to the slowed cap (half of 58, floored at 29 km/h) even with ↑ held.
	await expect.poll(async () => (await snap()).kmh, { timeout: 3000 }).toBe(29);
	await expect.poll(async () => (await snap()).slowed, { timeout: 8000 }).toBe(false);
	await expect.poll(async () => (await snap()).kmh, { timeout: 5000 }).toBe(58);
	const after = await snap();
	expect(after.status).toBe('playing');
	expect(after.lives).toBe(lives);
	expect(after.garbage).toBe(0);
});

// --- Fuel tankers, Ram Plating, power-ups, hazards, bosses, missions --------

const snapshot = (page) => page.evaluate(() => window.__busRushTestHooks.snapshot());

async function startQuietRun(page) {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => {
		window.__busRushTestHooks.noTraffic();
		window.__busRushTestHooks.noPolice();
	});
}

test('a fuel tanker stuns the bus (steering locked, no life lost), then staying close is WASTED', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.noPolice());
	const lives = await page.locator('#bus-rush-hud-lives').textContent();
	await page.evaluate(() => window.__busRushTestHooks.spawn('fuel'));
	await expect.poll(async () => (await snapshot(page)).crash, { timeout: 5000 }).toBe('stun');
	await expect(page.locator('#bus-rush-hud-speed')).toHaveText('0 km/h');
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(lives);
	const lane = (await snapshot(page)).lane;
	await page.keyboard.press(lane > 0 ? 'ArrowLeft' : 'ArrowRight');
	expect((await snapshot(page)).lane).toBe(lane); // stunned: steering ignored

	await page.evaluate(() => window.__busRushTestHooks.stunLeft(0.05));
	await expect.poll(async () => (await snapshot(page)).crash).toBe('fuse');
	// Stay put: the tanker blows with the bus inside the blast.
	await expect.poll(async () => (await snapshot(page)).cutscene, { timeout: 4000 }).toBe(true);
	await expect(page.locator('#bus-rush-run-over-screen')).toBeHidden();
	await page.keyboard.press('Enter'); // skip to WASTED
	await page.keyboard.press('Enter'); // on to Run Over
	await expect(page.locator('#bus-rush-run-over-screen')).toBeVisible();
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('WASTED');
	await expect(page.locator('#bus-rush-run-over-unlocks')).toContainText('Scenic Route');
	await expect(page.locator('[data-achievement-key="wasted"] [data-achievement-mark]')).toHaveText('✓');
});

test('steering two lanes clear of a tanker during the fuse escapes the blast', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.noPolice());
	await page.evaluate(() => window.__busRushTestHooks.spawn('fuel'));
	await expect.poll(async () => (await snapshot(page)).crash, { timeout: 5000 }).toBe('stun');
	await page.evaluate(() => window.__busRushTestHooks.stunLeft(0.05));
	await expect.poll(async () => (await snapshot(page)).crash).toBe('fuse');
	const key = (await snapshot(page)).lane <= 1 ? 'ArrowRight' : 'ArrowLeft';
	await page.keyboard.press(key);
	await page.keyboard.press(key);
	await expect.poll(async () => (await snapshot(page)).tankerEscapes, { timeout: 4000 }).toBe(1);
	const s = await snapshot(page);
	expect(s.status).toBe('playing');
	expect(s.crash).toBeNull();
});

test('Ram Plating: level 1 wrecks a ramming cruiser for one life instead of Busted', async ({ page }) => {
	await startQuietRun(page);
	await page.evaluate(() => window.__busRushTestHooks.upgrade('ram', 1));
	const lives = (await snapshot(page)).lives;
	await page.evaluate(() => window.__busRushTestHooks.policeRam());
	await expect.poll(async () => (await snapshot(page)).rammed, { timeout: 3000 }).toBe(1);
	const s = await snapshot(page);
	expect(s.status).toBe('playing');
	expect(s.wrecked).toBe(1);
	expect(s.lives).toBe(lives - 1);
});

test('Ram Plating: a SWAT van still busts below level 3, and is wrecked at level 3', async ({ page }) => {
	await startQuietRun(page);
	await page.evaluate(() => window.__busRushTestHooks.upgrade('ram', 3));
	await page.evaluate(() => window.__busRushTestHooks.swatRam());
	await expect.poll(async () => (await snapshot(page)).rammed, { timeout: 3000 }).toBe(1);
	expect((await snapshot(page)).status).toBe('playing');

	await page.evaluate(() => window.__busRushTestHooks.upgrade('ram', 2));
	await page.evaluate(() => window.__busRushTestHooks.swatRam());
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('Busted!', { timeout: 3000 });
});

test('Ram Plating is sold in the depot', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	await page.evaluate(() => window.__busRushTestHooks.grantTokens(60));
	await page.locator('#bus-rush-start-shop-button').click();
	const ram = page.locator('[data-upgrade-key="ram"]');
	await expect(ram.locator('[data-upgrade-cost]')).toHaveText('50');
	await ram.locator('[data-upgrade-buy]').click();
	await expect(ram.locator('[data-upgrade-level]')).toHaveText('1');
});

test('a shield power-up absorbs a lethal truck', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.noPolice());
	await page.evaluate(() => window.__busRushTestHooks.powerup('shield'));
	await expect.poll(async () => (await snapshot(page)).shield, { timeout: 3000 }).toBe(true);
	const lives = (await snapshot(page)).lives;
	await page.evaluate(() => window.__busRushTestHooks.spawn('truck'));
	await expect.poll(async () => (await snapshot(page)).shield, { timeout: 5000 }).toBe(false);
	const s = await snapshot(page);
	expect(s.status).toBe('playing');
	expect(s.lives).toBe(lives);
	expect(s.powerups).toBe(1);
});

test('an EMP power-up wrecks the pursuing police', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.noTraffic());
	await expect.poll(async () => (await snapshot(page)).police.length, { timeout: 8000 }).toBeGreaterThan(0);
	await page.evaluate(() => window.__busRushTestHooks.powerup('emp'));
	await expect.poll(async () => (await snapshot(page)).wrecked, { timeout: 3000 }).toBeGreaterThan(0);
	expect((await snapshot(page)).police).toHaveLength(0);
});

test('a pothole knocks the bus to the speed floor without costing a life', async ({ page }) => {
	await startQuietRun(page);
	await page.keyboard.down('ArrowUp');
	await expect.poll(async () => (await snapshot(page)).kmh).toBe(58);
	const lives = (await snapshot(page)).lives;
	await page.evaluate(() => window.__busRushTestHooks.pothole());
	await expect.poll(async () => (await snapshot(page)).kmh, { timeout: 2000 }).toBeLessThan(40);
	expect((await snapshot(page)).lives).toBe(lives);
	await page.keyboard.up('ArrowUp');
});

test('a jaywalker or a spike strip costs one life', async ({ page }) => {
	await startQuietRun(page);
	const lives = (await snapshot(page)).lives;
	await page.evaluate(() => window.__busRushTestHooks.pedestrian());
	await expect.poll(async () => (await snapshot(page)).lives, { timeout: 3000 }).toBe(lives - 1);
	await expect.poll(async () => (await snapshot(page)).status).toBe('playing');
	await page.waitForTimeout(1700); // let post-hit grace run out
	await page.evaluate(() => window.__busRushTestHooks.spikes());
	await expect.poll(async () => (await snapshot(page)).lives, { timeout: 3000 }).toBe(lives - 2);
});

test('construction barriers cost a life and shove the bus a lane inward', async ({ page }) => {
	await startQuietRun(page);
	await page.keyboard.press('ArrowLeft'); // lane 0, an edge lane
	await expect.poll(async () => (await snapshot(page)).lane).toBe(0);
	const lives = (await snapshot(page)).lives;
	await page.evaluate(() => window.__busRushTestHooks.zone());
	await expect.poll(async () => (await snapshot(page)).lives, { timeout: 3000 }).toBe(lives - 1);
	expect((await snapshot(page)).lane).toBe(1);
	expect((await snapshot(page)).zoneLane).toBe(0);
});

test('at five stars a police helicopter joins and drops spike strips', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => {
		window.__busRushTestHooks.noTraffic();
		window.__busRushTestHooks.warp(3300); // Changi: five stars
	});
	await page.keyboard.down('ArrowUp');
	await expect.poll(async () => (await snapshot(page)).wanted).toBe(5);
	await expect.poll(async () => (await snapshot(page)).heli, { timeout: 3000 }).toBe(true);
	await expect.poll(async () => (await snapshot(page)).swat, { timeout: 10000 }).toBe(1);
	await expect.poll(async () => {
		const s = await snapshot(page);
		return s.spikes > 0 || s.lives < 3 || s.status !== 'playing';
	}, { timeout: 10000 }).toBe(true);
	await page.keyboard.up('ArrowUp');
});

test('three missions are shown and a finished run keeps three active', async ({ page }) => {
	await page.goto('/bus-rush');
	await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
	await page.reload();
	const labels = page.locator('[data-mission-slot] [data-mission-label]');
	await expect(labels).toHaveCount(3);
	await expect(labels.first()).not.toHaveText('—');
	await page.locator('#bus-rush-start-button').click();
	await page.evaluate(() => window.__busRushTestHooks.crash());
	await expect(page.locator('#bus-rush-run-over-unlocks')).toContainText('Joyrider');
	expect(new Set((await snapshot(page)).missions).size).toBe(3);
	await expect(page.locator('#bus-rush-achievement-count')).toHaveText('1 / 14');
});

test('a semi carrying gasoline stuns for 20 s with a 4 s fuse, then staying close is WASTED', async ({ page }) => {
	await startQuietRun(page);
	const lives = await page.locator('#bus-rush-hud-lives').textContent();
	await page.evaluate(() => window.__busRushTestHooks.spawn('semi', { hazmat: true }));
	await expect.poll(async () => (await snapshot(page)).crash, { timeout: 5000 }).toBe('stun');
	expect((await snapshot(page)).stun).toBeGreaterThan(19);
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(lives);
	await page.evaluate(() => window.__busRushTestHooks.stunLeft(0.05));
	await expect.poll(async () => (await snapshot(page)).crash).toBe('fuse');
	expect((await snapshot(page)).fuse).toBeGreaterThan(3);
	await expect.poll(async () => (await snapshot(page)).cutscene, { timeout: 6000 }).toBe(true);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('WASTED');
});

test('a tow truck costs one life, not the run', async ({ page }) => {
	await startQuietRun(page);
	const lives = parseInt(await page.locator('#bus-rush-hud-lives').textContent(), 10);
	await page.evaluate(() => window.__busRushTestHooks.spawn('tow'));
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(String(lives - 1), { timeout: 5000 });
	expect((await snapshot(page)).status).toBe('playing');
});

test('a ramp truck launches the bus onto the MRT track, where ← → switch tracks, then it drops back to the road', async ({ page }) => {
	await startQuietRun(page);
	await page.keyboard.press('ArrowLeft'); // into lane 0, where the ramp parks
	await page.evaluate(() => window.__busRushTestHooks.ramp(0));
	await expect.poll(async () => (await snapshot(page)).track, { timeout: 5000 }).toBe('jump');
	await expect.poll(async () => (await snapshot(page)).track, { timeout: 5000 }).toBe('ride');
	let snap = await snapshot(page);
	expect(snap.trackRides).toBe(1);
	expect(snap.trackLeft).toBeGreaterThan(45);
	expect(snap.trackLane).toBe(0);
	await page.evaluate(() => window.__busRushTestHooks.quietTrack());
	await page.keyboard.press('ArrowRight');
	expect((await snapshot(page)).trackLane).toBe(1);
	await page.keyboard.press('ArrowRight'); // only two tracks
	expect((await snapshot(page)).trackLane).toBe(1);

	const lives = await page.locator('#bus-rush-hud-lives').textContent();
	await page.evaluate(() => window.__busRushTestHooks.trackLeft(0.2));
	await expect.poll(async () => (await snapshot(page)).track, { timeout: 5000 }).toBe(null);
	snap = await snapshot(page);
	expect(snap.status).toBe('playing');
	expect(snap.lane).toBe(2);
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(lives);
});

test('an MRT train hitting the bus on the track ends the run', async ({ page }) => {
	await startQuietRun(page);
	await page.keyboard.press('ArrowLeft');
	await page.evaluate(() => window.__busRushTestHooks.ramp(0));
	await expect.poll(async () => (await snapshot(page)).track, { timeout: 5000 }).toBe('ride');
	await page.evaluate(() => {
		window.__busRushTestHooks.quietTrack();
		window.__busRushTestHooks.train(0, 300);
	});
	await expect(page.locator('#bus-rush-run-over-screen')).toBeVisible({ timeout: 3000 });
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('Hit by an MRT train!');
});

test('shoving a cement mixer and steering clear topples it onto the police', async ({ page }) => {
	await startQuietRun(page);
	// Bus in lane 1, mixer alongside in lane 2: it falls into lane 1, lane 0 is the way out.
	const shoved = await page.evaluate(() => {
		window.__busRushTestHooks.mixer(2);
		const could = window.__busRushTestHooks.snapshot().canShove;
		window.__busRushTestHooks.shove();
		return could;
	});
	expect(shoved).toBe(true);
	expect((await snapshot(page)).tipping).toBe(true);
	await page.keyboard.press('ArrowLeft');
	await expect.poll(async () => (await snapshot(page)).scene, { timeout: 6000 }).toBe(true);
	await expect.poll(async () => (await snapshot(page)).wrecked, { timeout: 4000 }).toBeGreaterThan(0);
	await page.keyboard.press('Enter'); // on to the laugh
	await page.keyboard.press('Enter'); // back to the road
	const snap = await snapshot(page);
	expect(snap.scene).toBe(false);
	expect(snap.mixerTopples).toBe(1);
	expect(snap.status).toBe('playing');
	expect(snap.police).toEqual([]);
});

test('staying under a shoved cement mixer flattens the bus into a pancake: WASTED', async ({ page }) => {
	await startQuietRun(page);
	await page.evaluate(() => {
		window.__busRushTestHooks.mixer(2);
		window.__busRushTestHooks.shove();
	});
	await expect.poll(async () => (await snapshot(page)).pancaked, { timeout: 6000 }).toBe(true);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(page.locator('#bus-rush-run-over-title')).toContainText('WASTED');
	await expect(page.locator('#bus-rush-run-over-unlocks')).toContainText('Pancake Day');
});

test('a cement mixer can’t be shoved from the edge lane (nowhere to escape)', async ({ page }) => {
	await startQuietRun(page);
	await page.keyboard.press('ArrowLeft');
	await expect.poll(async () => (await snapshot(page)).lane).toBe(0);
	await page.waitForTimeout(400); // finish the lane change
	const could = await page.evaluate(() => {
		window.__busRushTestHooks.mixer(1);
		return window.__busRushTestHooks.snapshot().canShove;
	});
	expect(could).toBe(false);
});

test('in a storm, a puddle splashes the windscreen without costing a life', async ({ page }) => {
	await startQuietRun(page);
	await page.evaluate(() => window.__busRushTestHooks.storm(true));
	expect((await snapshot(page)).raining).toBe(true);
	const lives = await page.locator('#bus-rush-hud-lives').textContent();
	await page.evaluate(() => window.__busRushTestHooks.puddle());
	await expect.poll(async () => (await snapshot(page)).splash, { timeout: 3000 }).toBe(true);
	await expect(page.locator('#bus-rush-hud-lives')).toHaveText(lives);
});

test('Sentosa is level 6, and its sand drifts slow the bus', async ({ page }) => {
	await startQuietRun(page);
	await page.evaluate(() => window.__busRushTestHooks.warp(4000));
	await expect.poll(async () => (await snapshot(page)).level, { timeout: 3000 }).toBe(6);
	await page.evaluate(() => window.__busRushTestHooks.sand());
	await expect.poll(async () => (await snapshot(page)).slowed, { timeout: 3000 }).toBe(true);
	await page.evaluate(() => window.__busRushTestHooks.crash());
	await expect(page.locator('#bus-rush-run-over-level')).toHaveText('6 · Sentosa');
});

test('the Daily Challenge drives the stock bus and submits to its own leaderboard', async ({ page }) => {
	const playerName = `daily-${Date.now() % 1_000_000}`;
	try {
		await page.goto('/bus-rush');
		await page.evaluate(() => window.localStorage.removeItem('bus-rush:v1'));
		await page.reload();
		await page.evaluate(() => window.__busRushTestHooks.upgrade('engine', 3));
		await page.locator('#bus-rush-daily-button').click();
		const today = new Date().toISOString().slice(0, 10);
		const snap = await snapshot(page);
		expect(snap.daily).toBe(today);
		expect(snap.bus).toBe('single');
		expect(snap.upgradesUsed.engine).toBe(0);

		await page.evaluate(() => window.__busRushTestHooks.crash());
		await expect(page.locator('#bus-rush-run-over-title')).toContainText('Daily Challenge');
		await expect(page.locator('#bus-rush-daily-input')).toHaveValue(today);
		await page.locator('#bus-rush-name-input').fill(playerName);
		await page.locator('#bus-rush-submit-button').click();
		const board = page.locator('#bus-rush-leaderboard');
		await expect(board).toHaveAttribute('data-board', 'daily');
		await expect(board).toContainText(playerName);
		await expect(board).toContainText(today);

		await board.getByRole('button', { name: 'All-time' }).click();
		await expect(page.locator('#bus-rush-leaderboard')).toHaveAttribute('data-board', 'all');
		await page.locator('#bus-rush-leaderboard').getByRole('button', { name: 'Daily Challenge' }).click();
		await expect(page.locator('#bus-rush-leaderboard')).toContainText(playerName);

		// "Drive Again" stays on the daily road; the start screen remembers today's best.
		await page.locator('#bus-rush-again-button').click();
		expect((await snapshot(page)).daily).toBe(today);
	} finally {
		await deleteTestScore(playerName);
	}
});
