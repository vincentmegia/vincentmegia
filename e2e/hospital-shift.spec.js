// /hospital-shift: canvas game shell, the ER loop (triage → bed treatments
// → discharge), Karen, coffee, hallucinations, handover/paycheck and the
// Postgres leaderboard (docs/features/hospital-shift.md). The shift clock
// runs 6–10 real minutes and arrivals are random, so — like
// library-game.spec.js — every test drives the real click/key paths but
// takes exact coordinates and forced spawns from
// `window.__hospitalShiftTestHooks`.
const { test, expect } = require('@playwright/test');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

// Throwaway leaderboard rows must be cleaned up: the dev Postgres is the
// real leaderboard (see fishing-game.spec.js).
function testPlayerName() {
	return `e2e-${Date.now() % 1_000_000}`;
}

async function deleteTestScore(playerName) {
	const client = new Client({ connectionString: databaseURL() });
	await client.connect();
	try {
		await client.query('DELETE FROM hospital_scores WHERE player_name = $1', [playerName]);
	} finally {
		await client.end();
	}
}

/**
 * Starting progress for the first page load. Nothing is saved between
 * visits, so this hands the game a one-time seed (`takeTestSeed` reads and
 * deletes it); the sessionStorage guard stops a reload from reseeding, so a
 * reload shows the real reset.
 */
async function seedProgress(page, fields) {
	await page.addInitScript((seed) => {
		if (window.sessionStorage.getItem('hospital-seeded')) return;
		window.sessionStorage.setItem('hospital-seeded', '1');
		window.__hospitalShiftTestSeed = seed;
	}, { karenSeed: 1, ...fields });
}

/** Starts the visit at a given shift (5+ so surgery cases can arrive). */
async function seedSave(page, currentShift = 5, monthToDateGard = 0) {
	await seedProgress(page, { currentShift, monthToDateGard });
}

async function startShift(page) {
	await page.locator('#hospital-start-shift-button').click();
	await page.waitForFunction(() => window.__hospitalShiftTestHooks?.getShiftState()?.phase === 'playing');
}

const hooks = (page, name, ...args) => page.evaluate(([n, a]) => window.__hospitalShiftTestHooks[n](...a), [name, args]);

/** Canvas world point -> page point, letterbox-aware (fullscreen engages on Start Shift). */
async function canvasToPage(page, point) {
	const box = await page.locator('#hospital-canvas').boundingBox();
	const worldAspect = 960 / 600;
	let contentWidth = box.width;
	let contentHeight = box.height;
	let offsetX = 0;
	let offsetY = 0;
	if (box.width / box.height > worldAspect) {
		contentWidth = box.height * worldAspect;
		offsetX = (box.width - contentWidth) / 2;
	} else {
		contentHeight = box.width / worldAspect;
		offsetY = (box.height - contentHeight) / 2;
	}
	return { x: box.x + offsetX + (point.x / 960) * contentWidth, y: box.y + offsetY + (point.y / 600) * contentHeight };
}

async function clickCanvasPoint(page, point) {
	const p = await canvasToPage(page, point);
	await page.mouse.click(p.x, p.y);
}

async function waitUntilArrived(page) {
	await page.waitForFunction(() => window.__hospitalShiftTestHooks.isPlayerMoving() === false, null, { timeout: 10000 });
}

/** A station on the player's current floor (Stairs/Elevator exist on both). */
async function station(page, kind, bedIndex) {
	const stations = await hooks(page, 'getStations');
	const floor = await hooks(page, 'getCurrentFloor');
	const matches = stations.filter((s) => s.kind === kind && (bedIndex === undefined || s.bedIndex === bedIndex));
	return matches.find((s) => s.floor === floor) || matches[0];
}

/** Up the Stairs to the Supply Room, take a bandage roll, back down in the Elevator. */
async function fetchBandageRoll(page) {
	await walkTo(page, 'stairs');
	expect(await hooks(page, 'getCurrentFloor')).toBe(2);
	await walkTo(page, 'supply-cart');
	expect((await shiftState(page)).hasBandage).toBe(true);
	await walkTo(page, 'elevator');
	expect(await hooks(page, 'getCurrentFloor')).toBe(1);
}

async function walkTo(page, kind, bedIndex) {
	await clickCanvasPoint(page, await station(page, kind, bedIndex));
	await waitUntilArrived(page);
}

async function waitForOverlay(page, kind) {
	await page.waitForFunction((k) => window.__hospitalShiftTestHooks.getOverlay()?.kind === k, kind, { timeout: 10000 });
	return hooks(page, 'getOverlay');
}

async function shiftState(page) {
	return hooks(page, 'getShiftState');
}

async function bedOf(page, patientId) {
	const s = await shiftState(page);
	return s.beds.findIndex((b) => b?.id === patientId);
}

/** Spawns a patient with a known condition and triages them correctly via the real click path; returns [id, bedIndex]. */
async function admit(page, conditionId, level) {
	const id = await hooks(page, 'spawnPatientNow', conditionId);
	const slot = (await hooks(page, 'getTriageSlots')).find((s) => s.id === id);
	await clickCanvasPoint(page, { x: slot.x, y: slot.y - 20 });
	await waitUntilArrived(page);
	const overlay = await waitForOverlay(page, 'triage');
	expect(overlay.patientId).toBe(id);
	await page.keyboard.press(String({ red: 1, yellow: 2, green: 3 }[level]));
	await page.waitForFunction((pid) => window.__hospitalShiftTestHooks.getShiftState().beds.some((b) => b?.id === pid), id);
	return [id, await bedOf(page, id)];
}

/** Passes the open skill check (gauge parked in the gold zone, then sampled with Space). */
async function passSkillCheck(page) {
	await hooks(page, 'setSkillGauge', 0.5);
	await page.keyboard.press('Space');
}

/** In an open tray/cooler/shelf close-up: clicks an item's card. */
async function clickPickCard(page, id) {
	await waitForOverlay(page, 'pick');
	const card = (await hooks(page, 'getPickCardRects')).find((c) => c.id === id);
	await clickCanvasPoint(page, { x: card.x + card.w / 2, y: card.y + card.h / 2 });
}

/** Picks an item and passes its grab check; the close-up then closes. */
async function pickItem(page, id) {
	await clickPickCard(page, id);
	await hooks(page, 'setPickGauge', 0.5);
	await page.keyboard.press('Space');
	await page.waitForFunction(() => !window.__hospitalShiftTestHooks.getOverlay(), null, { timeout: 5000 });
}

/** Passes the three table stages of an open surgery. */
async function operate(page) {
	await waitForOverlay(page, 'skill');
	for (let i = 0; i < 3; i++) {
		await passSkillCheck(page);
		await page.waitForTimeout(50);
	}
}

test.describe('/hospital-shift page', () => {
	test('renders canvas, HUD and start screen with the paycheck hidden', async ({ page }) => {
		await page.goto('/hospital-shift');
		await expect(page.locator('h1')).toHaveText('Hospital Shift');
		await expect(page.locator('#hospital-canvas')).toBeVisible();
		await expect(page.locator('#hospital-start-screen')).toBeVisible();
		await expect(page.locator('#hospital-paycheck-screen')).toBeHidden();
		await expect(page.locator('#hospital-hud-clock')).toHaveText('--:--');
	});

	test('leaderboard fragment loads', async ({ page }) => {
		await page.goto('/hospital-shift');
		await expect(page.locator('#hospital-leaderboard')).not.toContainText('Loading leaderboard');
	});

	test('Start Shift begins at 7 AM', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await expect(page.locator('#hospital-start-screen')).toBeHidden();
		await expect(page.locator('#hospital-hud-shift')).toHaveText('1/30');
		await expect(page.locator('#hospital-hud-clock')).toHaveText(/^7:0\d AM$/);
	});
});

test.describe('triage', () => {
	test('a correct call beds the patient with no mistake; a wrong one is corrected and counted', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [, bed] = await admit(page, 'asthma', 'red');
		expect(bed).toBeGreaterThanOrEqual(0);
		expect((await shiftState(page)).mistakeCount).toBe(0);

		const id = await hooks(page, 'spawnPatientNow', 'sprain');
		const slot = (await hooks(page, 'getTriageSlots')).find((s) => s.id === id);
		await clickCanvasPoint(page, { x: slot.x, y: slot.y - 20 });
		await waitUntilArrived(page);
		await waitForOverlay(page, 'triage');
		const red = (await hooks(page, 'getTriageButtonRects'))[0];
		await clickCanvasPoint(page, { x: red.x + 20, y: red.y + 20 });
		const s = await shiftState(page);
		expect(s.mistakeCount).toBe(1);
		expect(s.beds.find((b) => b?.id === id).level).toBe('green');
	});
});

test.describe('treatments', () => {
	test('vitals, bandage and meds: a deep cut is treated and discharged', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [id, bed] = await admit(page, 'cut', 'yellow');

		await walkTo(page, 'bed', bed);
		await waitForOverlay(page, 'skill');
		await passSkillCheck(page);
		await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(1);

		// Bandage: no roll in hand → the bed sends you upstairs for one.
		await walkTo(page, 'bed', bed);
		expect(await hooks(page, 'getOverlay')).toBeNull();
		await expect(page.locator('#hospital-toast')).toContainText('Supply Cart upstairs');
		await fetchBandageRoll(page);
		// Then trace the real path with the mouse held down.
		await walkTo(page, 'bed', bed);
		const bandage = await waitForOverlay(page, 'bandage');
		const pts = bandage.path;
		const start = await canvasToPage(page, pts[0]);
		await page.mouse.move(start.x, start.y);
		await page.mouse.down();
		for (let i = 1; i < pts.length; i++) {
			for (let k = 1; k <= 8; k++) {
				const p = await canvasToPage(page, { x: pts[i - 1].x + ((pts[i].x - pts[i - 1].x) * k) / 8, y: pts[i - 1].y + ((pts[i].y - pts[i - 1].y) * k) / 8 });
				await page.mouse.move(p.x, p.y);
			}
		}
		await page.mouse.up();
		await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(2);
		expect((await shiftState(page)).hasBandage).toBe(false); // the roll was used up
		await page.waitForFunction(() => window.__hospitalShiftTestHooks.getOverlay() === null);

		// Meds: search the cabinet — a wrong bottle is a mistake, the right
		// one plus the dose is carried to the bed.
		await walkTo(page, 'med-cabinet');
		const meds = await waitForOverlay(page, 'meds');
		const layout = await hooks(page, 'getMedsLayout');
		expect(layout.bottles.filter((b) => b.name === meds.order.drug)).toHaveLength(1);
		const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
		const decoy = layout.bottles.find((b) => b.name !== meds.order.drug);
		await clickCanvasPoint(page, center(decoy));
		expect((await shiftState(page)).mistakeCount).toBe(1);
		const right = layout.bottles.find((b) => b.name === meds.order.drug);
		await clickCanvasPoint(page, center(right));
		const dose = layout.doses.find((d) => d.dose === meds.order.dose);
		await clickCanvasPoint(page, { x: dose.x + 20, y: dose.y + 20 });
		expect((await shiftState(page)).carried).toMatchObject({ kind: 'meds', patientId: id });

		// Giving them at the bed is a skill check.
		await walkTo(page, 'bed', bed);
		const give = await waitForOverlay(page, 'skill');
		expect(give.task).toBe('meds');
		await passSkillCheck(page);
		await page.waitForFunction(() => window.__hospitalShiftTestHooks.getOverlay() === null);
		const s = await shiftState(page);
		expect(s.beds[bed]).toBeNull();
		expect(s.discharged).toBe(1);
	});

	test('oxygen: clicking a skull is a missed pump (a mistake), finding the three hearts finishes it', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [, bed] = await admit(page, 'allergy', 'red');
		await walkTo(page, 'bed', bed);
		const overlay = await waitForOverlay(page, 'oxygen');
		expect(overlay.items.filter((it) => it.kind === 'heart')).toHaveLength(3);
		const skull = overlay.items.find((it) => it.kind === 'skull');
		await clickCanvasPoint(page, skull);
		expect((await shiftState(page)).mistakeCount).toBe(1);
		// The same skull can't cost twice.
		await clickCanvasPoint(page, skull);
		expect((await shiftState(page)).mistakeCount).toBe(1);
		const hearts = overlay.items.filter((it) => it.kind === 'heart');
		await clickCanvasPoint(page, hearts[0]);
		expect((await hooks(page, 'getOverlay')).hits).toBe(1);
		for (const heart of hearts.slice(1)) await clickCanvasPoint(page, heart);
		await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(1);
		expect(await hooks(page, 'getOverlay')).toBeNull();
	});

	test('surgery: wheel the gurney to the OR and pass three stages', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [, bed] = await admit(page, 'appendicitis', 'red');
		for (let step = 0; step < 2; step++) {
			await walkTo(page, 'bed', bed);
			await waitForOverlay(page, 'skill');
			await passSkillCheck(page);
			await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(step + 1);
		}
		await walkTo(page, 'bed', bed);
		expect((await shiftState(page)).carried?.kind).toBe('gurney');
		// Into the walk-in OR: the table won't start without the kit.
		await walkTo(page, 'operating-room');
		expect(await hooks(page, 'getCurrentFloor')).toBe(3);
		await walkTo(page, 'or-table');
		await expect(page.locator('#hospital-toast')).toContainText("can't operate yet");
		expect(await hooks(page, 'getOverlay')).toBeNull();
		// The scalpel from the Instrument Tray…
		await walkTo(page, 'instrument-tray');
		await pickItem(page, 'scalpel');
		// …and appendicitis's mesh patch from the Implant Shelf upstairs.
		await walkTo(page, 'or-door');
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
		await walkTo(page, 'stairs');
		await walkTo(page, 'implant-shelf');
		await pickItem(page, 'mesh');
		expect((await shiftState(page)).surgeryKit).toEqual({ scalpel: true, item: 'mesh' });
		await walkTo(page, 'elevator');
		await walkTo(page, 'operating-room');
		await walkTo(page, 'or-table');
		await operate(page);
		const s = await shiftState(page);
		expect(s.beds[bed]).toBeNull();
		expect(s.carried).toBeNull();
		expect(s.discharged).toBe(1);
		expect(s.surgeryKit).toEqual({ scalpel: false, item: null });
		expect(s.mistakeCount).toBe(0);
	});

	test('a bandage roll in your pocket doesn\'t stop you taking the gurney and operating', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		await fetchBandageRoll(page);
		const [, bed] = await admit(page, 'appendicitis', 'red');
		for (let step = 0; step < 2; step++) {
			await walkTo(page, 'bed', bed);
			await waitForOverlay(page, 'skill');
			await passSkillCheck(page);
			await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(step + 1);
		}
		await walkTo(page, 'bed', bed);
		expect((await shiftState(page)).carried?.kind).toBe('gurney');
		// The item hunt has its own test; here the kit is handed over.
		await hooks(page, 'giveSurgeryKit', 'mesh');
		await walkTo(page, 'operating-room');
		await walkTo(page, 'or-table');
		await operate(page);
		const s = await shiftState(page);
		expect(s.beds[bed]).toBeNull();
		expect(s.hasBandage).toBe(true);
	});

	test('the × button backs out of a minigame without a mistake', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [, bed] = await admit(page, 'sprain', 'green');
		await walkTo(page, 'bed', bed);
		await waitForOverlay(page, 'skill');
		const close = await hooks(page, 'getCloseRect');
		await clickCanvasPoint(page, { x: close.x + 14, y: close.y + 14 });
		const s = await shiftState(page);
		expect(await hooks(page, 'getOverlay')).toBeNull();
		expect(s.activeTask).toBeNull();
		expect(s.mistakeCount).toBe(0);
	});
});

test.describe('surgery items (walk-in OR)', () => {
	test('a transplant needs its organ: the wrong organ or a decoy is a mistake, a dropped grab is not', async ({ page }) => {
		await seedSave(page, 6);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [, bed] = await admit(page, 'kidney-failure', 'red');
		for (let step = 0; step < 2; step++) {
			await walkTo(page, 'bed', bed);
			await waitForOverlay(page, 'skill');
			await passSkillCheck(page);
			await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(step + 1);
		}
		await expect(page.locator('#hospital-canvas')).toBeVisible();
		await walkTo(page, 'bed', bed);
		await walkTo(page, 'operating-room');

		// The Organ Cooler: the heart isn't needed (a mistake, greyed out)…
		await walkTo(page, 'organ-cooler');
		await clickPickCard(page, 'heart');
		expect((await shiftState(page)).mistakeCount).toBe(1);
		expect((await hooks(page, 'getOverlay')).wrong).toContain('heart');
		// …the kidney is; a missed grab drops it (no mistake) and a retry takes it.
		await clickPickCard(page, 'kidney');
		await hooks(page, 'setPickGauge', 0.02);
		await page.keyboard.press('Space');
		expect((await hooks(page, 'getOverlay')).flash.text).toContain('Dropped');
		expect((await shiftState(page)).mistakeCount).toBe(1);
		expect((await shiftState(page)).surgeryKit.item).toBeNull();
		await page.waitForTimeout(400);
		await hooks(page, 'setPickGauge', 0.5);
		await page.keyboard.press('Space');
		await page.waitForFunction(() => !window.__hospitalShiftTestHooks.getOverlay(), null, { timeout: 5000 });
		expect((await shiftState(page)).surgeryKit.item).toBe('kidney');

		// The Instrument Tray: forceps are a decoy.
		await walkTo(page, 'instrument-tray');
		await clickPickCard(page, 'Forceps');
		expect((await shiftState(page)).mistakeCount).toBe(2);
		await clickPickCard(page, 'scalpel');
		await hooks(page, 'setPickGauge', 0.5);
		await page.keyboard.press('Space');
		await page.waitForFunction(() => !window.__hospitalShiftTestHooks.getOverlay(), null, { timeout: 5000 });

		await walkTo(page, 'or-table');
		const surgery = await waitForOverlay(page, 'skill');
		expect(surgery.task).toBe('surgery');
		await operate(page);
		const s = await shiftState(page);
		expect(s.beds[bed]).toBeNull();
		expect(s.mistakeCount).toBe(2);
	});

	test('the HUD button leaves the OR back to the ER', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await walkTo(page, 'operating-room');
		expect(await hooks(page, 'getCurrentFloor')).toBe(3);
		await expect(page.locator('#hospital-floor-button')).toHaveText('Leave the OR');
		await page.locator('#hospital-floor-button').click();
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
		await expect(page.locator('#hospital-floor-button')).toHaveText('Go Upstairs');
	});
});

test.describe('the Supply Room (2nd Floor)', () => {
	test('the HUD button switches floors, and only that floor\'s stations are reachable', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await expect(page.locator('#hospital-floor-button')).toHaveText('Go Upstairs');
		await page.locator('#hospital-floor-button').click();
		expect(await hooks(page, 'getCurrentFloor')).toBe(2);
		await expect(page.locator('#hospital-floor-button')).toHaveText('Go Downstairs');
		await expect(page.locator('#hospital-floor-button')).toHaveAttribute('aria-pressed', 'true');
		// A bed sits where the empty stockroom floor is upstairs — clicking there
		// just walks, it doesn't reach the bed.
		const bed = (await hooks(page, 'getStations')).find((s) => s.kind === 'bed');
		await clickCanvasPoint(page, bed);
		await waitUntilArrived(page);
		expect(await hooks(page, 'getOverlay')).toBeNull();
		await page.locator('#hospital-floor-button').click();
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
	});

	test('you can come back down during handover to reach the office', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await walkTo(page, 'stairs');
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'stairs');
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-screen')).toBeVisible();
	});

	test('one roll at a time: no second roll while you already have one', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		await fetchBandageRoll(page);
		await walkTo(page, 'stairs');
		await walkTo(page, 'supply-cart');
		await expect(page.locator('#hospital-toast')).toContainText('already have a bandage roll');
	});
});

test.describe('helping staff', () => {
	async function clickStaff(page, key) {
		const member = (await hooks(page, 'getStaff')).find((a) => a.key === key);
		await clickCanvasPoint(page, { x: member.x, y: member.y - 20 });
	}

	test('Dr. Okafor steps in for a patient about to be transferred', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		const [id, bed] = await admit(page, 'sprain', 'green');
		await hooks(page, 'setBedPatienceFraction', bed, 0.2);
		await hooks(page, 'setDoctorCooldown', 0);
		await expect.poll(async () => (await shiftState(page)).doctorAssists, { timeout: 15000 }).toBe(1);
		const s = await shiftState(page);
		expect(s.beds[bed].id).toBe(id);
		expect(s.beds[bed].step).toBe(1);
		expect(s.beds[bed].patienceRemainingSeconds / s.beds[bed].patienceMaxSeconds).toBeGreaterThanOrEqual(0.45);
		await expect(page.locator('#hospital-toast')).toContainText('Dr. Okafor stepped in');
	});

	test('the Orderly wheels a surgery patient to the OR when clicked', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		const [id, bed] = await admit(page, 'appendicitis', 'red');
		for (let step = 0; step < 2; step++) {
			await walkTo(page, 'bed', bed);
			await waitForOverlay(page, 'skill');
			await passSkillCheck(page);
			await expect.poll(async () => (await shiftState(page)).beds[bed]?.step).toBe(step + 1);
		}
		await clickStaff(page, 'orderly');
		await expect(page.locator('#hospital-toast')).toContainText('Orderly is on his way');
		await expect.poll(async () => (await shiftState(page)).orPatient?.patientId, { timeout: 20000 }).toBe(id);
		await hooks(page, 'giveSurgeryKit', 'mesh');
		await walkTo(page, 'operating-room');
		await walkTo(page, 'or-table');
		await operate(page);
		const s = await shiftState(page);
		expect(s.beds[bed]).toBeNull();
		expect(s.orPatient).toBeNull();
	});

	test('the Orderly says so when nobody needs surgery', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await clickStaff(page, 'orderly');
		await expect(page.locator('#hospital-toast')).toContainText('Nobody needs wheeling');
	});

	test('the Stock tech comes downstairs and hands you a bandage roll', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'bringStockTechDownNow');
		await expect.poll(async () => (await hooks(page, 'getStaff')).find((a) => a.key === 'stockTech').floor).toBe(1);
		await hooks(page, 'freezeStaff', 'stockTech');
		await clickStaff(page, 'stockTech');
		await expect.poll(async () => (await shiftState(page)).hasBandage, { timeout: 10000 }).toBe(true);
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
	});
});

test.describe('Coffee Machine', () => {
	test('a perfect pour refills Sanity, lifts Ward Mood and tips', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setSanity', 30);
		await hooks(page, 'setWardMood', 50);
		await walkTo(page, 'coffee-machine');
		const overlay = await waitForOverlay(page, 'coffee-pour');
		await page.keyboard.down('Space');
		await hooks(page, 'setCoffeePourFill', (overlay.band.low + overlay.band.high) / 2);
		await page.keyboard.up('Space');
		const s = await shiftState(page);
		expect(s.sanity).toBeGreaterThan(95);
		expect(s.wardMood).toBe(70);
		expect(s.bonusGard).toBeGreaterThanOrEqual(10);
	});
});

test.describe('Karen', () => {
	test('explaining triage earns a tip; letting her cut in is a mistake', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'forceKarenShiftNow');
		await walkTo(page, 'triage-desk');
		await waitForOverlay(page, 'karen');
		const buttons = await hooks(page, 'getKarenButtonRects');
		await clickCanvasPoint(page, { x: buttons.letCut.x + 20, y: buttons.letCut.y + 20 });
		const s = await shiftState(page);
		expect(s.karen.outcome).toBe('letCut');
		expect(s.mistakeCount).toBe(1);
		expect(s.wardMood).toBe(50);
	});
});

test.describe('nurse career rank', () => {
	async function seedCareer(page, careerXp) {
		await seedProgress(page, { currentShift: 1, careerXp });
	}

	test('XP from a shift ranks you up, shows on the paycheck and lasts the visit', async ({ page }) => {
		await seedCareer(page, 90);
		await page.goto('/hospital-shift');
		await expect(page.locator('#hospital-rank-title')).toHaveText('Lv 1 · Student Nurse');
		await expect(page.locator('#hospital-rank-next')).toHaveText('90 / 100 XP to Nursing Intern');
		await startShift(page);
		await expect(page.locator('#hospital-hud-rank')).toHaveText('Lv 1');
		await hooks(page, 'addShiftXp', 20);
		await expect(page.locator('#hospital-toast')).toContainText('Promoted to Nursing Intern');
		// The perk waits for the next shift.
		expect((await shiftState(page)).perks.walk).toBe(1);
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-xp')).toHaveText('+20 XP · Lv 2 Nursing Intern');
		await expect(page.locator('#hospital-paycheck-rankup')).toContainText('Comfy Shoes');
		await expect(page.locator('#hospital-hud-rank')).toHaveText('Lv 2');
		expect(await hooks(page, 'getCareerXp')).toBe(110);
		await page.locator('#hospital-paycheck-next-shift-button').click();
		await page.waitForFunction(() => window.__hospitalShiftTestHooks.getShiftState()?.phase === 'playing');
		expect((await shiftState(page)).perks.walk).toBe(1.1);
		// Leaving resets everything, the rank included.
		await page.reload();
		await expect(page.locator('#hospital-rank-title')).toHaveText('Lv 1 · Student Nurse');
		await expect(page.locator('#hospital-rank-perks')).toHaveText('Earn XP to unlock perks.');
	});

	test('after handover the HUD shows the banked rank, not the shift XP counted twice', async ({ page }) => {
		await seedCareer(page, 380);
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'addShiftXp', 150);
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-xp')).toHaveText('+150 XP · Lv 3 Junior Nurse');
		await expect(page.locator('#hospital-hud-rank')).toHaveText('Lv 3');
		expect(await hooks(page, 'getCareerXp')).toBe(530);
	});

	test('a Charge Nurse starts the shift with every top perk', async ({ page }) => {
		await seedCareer(page, 6200);
		await page.goto('/hospital-shift');
		await expect(page.locator('#hospital-rank-next')).toHaveText('Top rank reached');
		await startShift(page);
		expect((await shiftState(page)).perks).toEqual({ walk: 1.2, skillZone: 1.3, patience: 1.2, sanityDrain: 0.85, pay: 1.25 });
		await expect(page.locator('#hospital-hud-rank')).toHaveText('Lv 10');
	});
});

test.describe('Mel (easter egg)', () => {
	test('typing "mel" brings her to triage; her card is a gift and the badge lasts the visit', async ({ page }) => {
		await page.goto('/hospital-shift');
		await expect(page.locator('#hospital-mel-badge')).toBeHidden();
		await startShift(page);
		await hooks(page, 'setSanity', 40);
		await hooks(page, 'setWardMood', 50);
		await page.keyboard.type('mel');
		const mel = (await hooks(page, 'getTriageSlots')).find((s) => s.kind === 'mel');
		expect(mel).toBeTruthy();
		await clickCanvasPoint(page, { x: mel.x, y: mel.y - 20 });
		await waitUntilArrived(page);
		await waitForOverlay(page, 'mel');
		const button = await hooks(page, 'getMelButtonRect');
		await clickCanvasPoint(page, { x: button.x + 20, y: button.y + 20 });
		const s = await shiftState(page);
		expect(s.mel).toEqual({ waiting: false, visited: true });
		expect(s.bonusGard).toBe(40);
		expect(s.sanity).toBeGreaterThan(65);
		expect(s.wardMood).toBe(70);
		expect(s.mistakeCount).toBe(0);
		await expect(page.locator('#hospital-toast')).toContainText('Easter egg found');

		// Once per shift: the code does nothing more after her visit.
		await page.keyboard.type('mel');
		expect((await hooks(page, 'getTriageSlots')).some((slot) => slot.kind === 'mel')).toBe(false);

		// The badge is set (it shows on the start screen, hidden behind play).
		await expect(page.locator('#hospital-mel-badge')).not.toHaveClass(/\bhidden\b/);

		// Leaving resets everything, the badge included.
		await page.reload();
		await expect(page.locator('#hospital-mel-badge')).toBeHidden();
	});

	test('five clicks on the dandelion vase bring her in', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		const vase = await hooks(page, 'getMelVaseRect');
		const center = { x: vase.x + vase.w / 2, y: vase.y + vase.h / 2 };
		for (let i = 0; i < 4; i++) await clickCanvasPoint(page, center);
		expect((await shiftState(page)).mel.waiting).toBe(false);
		await clickCanvasPoint(page, center);
		expect((await shiftState(page)).mel.waiting).toBe(true);
		expect(await hooks(page, 'isPlayerMoving')).toBe(false);
	});
});

test.describe('hallucinations', () => {
	test('at 0 Sanity a ghost appears in the triage line and startles you', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setSanity', 0);
		await hooks(page, 'spawnGhostNow');
		const ghost = (await hooks(page, 'getTriageSlots')).find((s) => s.kind === 'ghost');
		expect((await hooks(page, 'getHallucinations')).intensity).toBe(1);
		await hooks(page, 'setSanity', 20);
		await clickCanvasPoint(page, { x: ghost.x, y: ghost.y - 20 });
		await waitUntilArrived(page);
		expect((await shiftState(page)).sanity).toBeLessThanOrEqual(15.1);
		expect((await shiftState(page)).mistakeCount).toBe(0);
	});
});

test.describe('hunger, thirst and the Cafeteria', () => {
	test('the vending machine sells snacks and drinks off the shift pay, only if you can afford them', async ({ page }) => {
		await seedSave(page, 1, 100);
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setThirst', 10);
		await hooks(page, 'setHunger', 50);
		await walkTo(page, 'vending-machine');
		await waitForOverlay(page, 'vending');
		const cards = await hooks(page, 'getVendingCardRects');
		const water = cards.find((c) => c.id === 'water');
		await clickCanvasPoint(page, { x: water.x + water.w / 2, y: water.y + 20 });
		const onigiri = cards.find((c) => c.id === 'onigiri');
		await clickCanvasPoint(page, { x: onigiri.x + onigiri.w / 2, y: onigiri.y + 20 });
		const s = await shiftState(page);
		expect(s.thirst).toBeGreaterThanOrEqual(44);
		expect(s.hunger).toBeGreaterThanOrEqual(84);
		expect(s.bonusGard).toBe(-30);
		// The × closes the shop (in fullscreen, WebKit's Escape leaves fullscreen instead).
		const close = await hooks(page, 'getCloseRect');
		await clickCanvasPoint(page, { x: close.x + 14, y: close.y + 14 });
		await page.waitForFunction(() => !window.__hospitalShiftTestHooks.getOverlay(), null, { timeout: 5000 });

		// A fresh visit with no Gard: nothing can be bought.
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setThirst', 10);
		await walkTo(page, 'vending-machine');
		await waitForOverlay(page, 'vending');
		await clickCanvasPoint(page, { x: water.x + water.w / 2, y: water.y + 20 });
		const broke = await shiftState(page);
		expect(broke.bonusGard).toBe(0);
		expect(broke.thirst).toBeLessThan(11);
		expect((await hooks(page, 'getOverlay')).flash.text).toContain('Not enough Gard');
	});

	test("the Cafeteria: walk in, Auntie Yumi's free meal fills both bars, then leave", async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setHunger', 5);
		await hooks(page, 'setThirst', 5);
		await hooks(page, 'setSanity', 50);
		await walkTo(page, 'cafeteria-door');
		expect(await hooks(page, 'getCurrentFloor')).toBe(4);
		await expect(page.locator('#hospital-floor-button')).toHaveText('Leave the Cafeteria');
		await walkTo(page, 'cafe-counter');
		await waitForOverlay(page, 'cafe');
		const button = await hooks(page, 'getCafeButtonRect');
		await clickCanvasPoint(page, { x: button.x + 20, y: button.y + 20 });
		const s = await shiftState(page);
		// Full, give or take the frame that's drained since.
		expect(s.hunger).toBeGreaterThan(99.5);
		expect(s.thirst).toBeGreaterThan(99.5);
		expect(s.sanity).toBeGreaterThan(55);
		expect(s.bonusGard).toBe(0);
		await page.waitForFunction(() => !window.__hospitalShiftTestHooks.getOverlay(), null, { timeout: 5000 });
		await walkTo(page, 'cafe-door');
		expect(await hooks(page, 'getCurrentFloor')).toBe(1);
	});

	test('dropping under 25% warns you; 5 s at 0% Thirst is a collapse', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setThirst', 25.001);
		await expect(page.locator('#hospital-toast')).toContainText('uncomfortable', { timeout: 5000 });
		await hooks(page, 'setThirst', 0);
		const started = Date.now();
		await expect(page.locator('#hospital-paycheck-title')).toHaveText('Game Over', { timeout: 10000 });
		expect(Date.now() - started).toBeLessThan(9000);
		await expect(page.locator('#hospital-paycheck-outcome')).toContainText('thirst');
	});
});

test.describe('night shifts and the flashlight', () => {
	test('shift 5 is a night shift: 7 PM clock, F toggles the flashlight, a dead battery swaps in a spare', async ({ page }) => {
		await seedSave(page, 5);
		await page.goto('/hospital-shift');
		await startShift(page);
		expect((await shiftState(page)).night).toBe(true);
		await expect(page.locator('#hospital-hud-clock')).toHaveText(/PM/);
		const button = page.locator('#hospital-flashlight-button');
		await expect(button).toBeVisible();
		await expect(button).toContainText('Off');
		await page.keyboard.press('f');
		expect((await shiftState(page)).flashlight.on).toBe(true);
		await expect(button).toContainText('On');

		// A spare from the Supply Room shelf…
		await walkTo(page, 'stairs');
		await walkTo(page, 'battery-shelf');
		expect((await shiftState(page)).flashlight.spares).toBe(1);
		// …swaps in when the battery runs flat.
		await hooks(page, 'setFlashlightBattery', 0.01);
		await expect.poll(async () => (await shiftState(page)).flashlight.spares).toBe(0);
		const f = (await shiftState(page)).flashlight;
		expect(f.on).toBe(true);
		expect(f.battery).toBeGreaterThan(90);
		// With no spare left, it dies.
		await hooks(page, 'setFlashlightBattery', 0.01);
		await expect.poll(async () => (await shiftState(page)).flashlight.on).toBe(false);
		await expect(page.locator('#hospital-toast')).toContainText('battery died');
	});

	test('the vending machine sells batteries only if you can afford one; day shifts have no flashlight', async ({ page }) => {
		await seedSave(page, 10, 100);
		await page.goto('/hospital-shift');
		await startShift(page);
		await walkTo(page, 'vending-machine');
		await waitForOverlay(page, 'vending');
		const b = await hooks(page, 'getVendingBatteryRect');
		await clickCanvasPoint(page, { x: b.x + 30, y: b.y + 20 });
		const s = await shiftState(page);
		expect(s.flashlight.spares).toBe(1);
		expect(s.bonusGard).toBe(-15);

		// A fresh visit: shift 1 with no Gard yet — no battery.
		await page.goto('/hospital-shift');
		await startShift(page);
		expect((await shiftState(page)).night).toBe(false);
		await walkTo(page, 'vending-machine');
		await waitForOverlay(page, 'vending');
		await clickCanvasPoint(page, { x: b.x + 30, y: b.y + 20 });
		expect((await shiftState(page)).flashlight.spares).toBe(0);
		expect((await shiftState(page)).bonusGard).toBe(0);
		expect((await hooks(page, 'getOverlay')).flash.text).toContain('Not enough Gard');
		const close = await hooks(page, 'getCloseRect');
		await clickCanvasPoint(page, { x: close.x + 14, y: close.y + 14 });
		await expect(page.locator('#hospital-flashlight-button')).toBeHidden();
		await page.keyboard.press('f');
		expect((await shiftState(page)).flashlight.on).toBe(false);
	});
});

test.describe('game over', () => {
	test('20 s at 0% Sanity is a game over; Retry replays the same shift with the month kept', async ({ page }) => {
		await seedSave(page, 5, 1200);
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setSanity', 0);
		await hooks(page, 'setZeroSanitySeconds', 19.5);
		await expect(page.locator('#hospital-paycheck-screen')).toBeVisible();
		await expect(page.locator('#hospital-paycheck-title')).toHaveText('Game Over');
		await expect(page.locator('#hospital-paycheck-outcome')).toContainText('collapsed');
		await expect(page.locator('#hospital-paycheck-shift-total')).toHaveText('0 Gard');
		await expect(page.locator('#hospital-paycheck-month-total')).toHaveText('1200 Gard');
		const retry = page.locator('#hospital-paycheck-next-shift-button');
		await expect(retry).toHaveText('Retry Shift 5');
		await retry.click();
		await page.waitForFunction(() => window.__hospitalShiftTestHooks.getShiftState()?.phase === 'playing');
		expect((await shiftState(page)).shiftNumber).toBe(5);
		await expect(page.locator('#hospital-hud-shift')).toHaveText('5/30');
	});

	test('running out of stars is an instant game over', async ({ page }) => {
		await seedSave(page);
		await page.goto('/hospital-shift');
		await startShift(page);
		await hooks(page, 'setRating', 0);
		await expect(page.locator('#hospital-paycheck-title')).toHaveText('Game Over');
		await expect(page.locator('#hospital-paycheck-outcome')).toContainText('Out of stars');
	});
});

test.describe('handover and paycheck', () => {
	test('the office is locked during play, then pays out after handover', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-screen')).toBeHidden();
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-screen')).toBeVisible();
		await expect(page.locator('#hospital-paycheck-shift-total')).toHaveText('4000 Gard');
		await expect(page.locator('#hospital-final-paycheck-block')).toBeHidden();
		await page.locator('#hospital-paycheck-next-shift-button').click();
		await expect(page.locator('#hospital-hud-shift')).toHaveText('2/30');
	});

	test('shift 30 shows the Final Paycheck and submits to the real leaderboard', async ({ page }) => {
		const playerName = testPlayerName();
		try {
			await seedSave(page, 30, 140000);
			await page.goto('/hospital-shift');
			await startShift(page);
			await hooks(page, 'skipToClosing');
			await walkTo(page, 'office');
			await expect(page.locator('#hospital-paycheck-screen')).toHaveAttribute('data-final', 'true');
			await expect(page.locator('#hospital-final-paycheck-block')).toBeVisible();
			await page.locator('#hospital-paycheck-name-input').fill(playerName);
			const [response] = await Promise.all([
				page.waitForResponse((r) => r.url().includes('/hospital-shift/score') && r.request().method() === 'POST'),
				page.locator('#hospital-paycheck-submit-button').click(),
			]);
			expect(response.ok()).toBeTruthy();
			await expect(page.locator('#hospital-leaderboard')).toContainText(playerName);
			await expect(page.locator('#hospital-leaderboard')).toContainText('144000 Gard');
		} finally {
			await deleteTestScore(playerName);
		}
	});
});

test.describe('Daily Challenge', () => {
	/** Finishes the running shift: jump to handover and walk into the office. */
	async function finishShift(page) {
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'office');
		await expect(page.locator('#hospital-paycheck-screen')).toBeVisible();
	}

	test('the start card shows today; the daily plays the seeded shift with neutral perks, and Try Again replays the same patients', async ({ page }) => {
		await seedProgress(page, { currentShift: 9, careerXp: 6200 });
		await page.goto('/hospital-shift');
		const today = new Date().toISOString().slice(0, 10);
		await expect(page.locator('#hospital-daily-date')).toHaveText(today);
		await expect(page.locator('#hospital-daily-twist')).not.toHaveText('—');
		const twistName = await page.locator('#hospital-daily-twist').textContent();

		await page.locator('#hospital-daily-button').click();
		await page.waitForFunction(() => window.__hospitalShiftTestHooks?.getShiftState()?.phase === 'playing');
		const daily = await hooks(page, 'getDaily');
		expect(daily.date).toBe(today);
		await expect(page.locator('#hospital-hud-shift')).toHaveText('Daily');
		const s = await shiftState(page);
		expect(s.shiftNumber).toBe(12);
		// A Charge Nurse's perks don't carry into the daily (only the twist's own).
		expect(s.perks.pay).toBe(1);
		expect(s.perks.walk).toBe(1);
		const first = (await hooks(page, 'getScheduledPatients')).map((x) => `${x.conditionId}/${x.designKey}/${x.at.toFixed(2)}`);
		expect(first.length).toBeGreaterThan(10);

		await finishShift(page);
		await expect(page.locator('#hospital-paycheck-title')).toHaveText('Daily Challenge');
		await expect(page.locator('#hospital-paycheck-outcome')).toContainText(twistName);
		await expect(page.locator('#hospital-paycheck-daily-input')).toHaveValue(today);
		await expect(page.locator('#hospital-paycheck-shifts-input')).toHaveValue('1');
		await expect(page.locator('#hospital-final-paycheck-heading')).toContainText('Daily Challenge');
		await expect(page.locator('#hospital-paycheck-month-label')).toHaveText("Today's best");

		await page.locator('#hospital-paycheck-next-shift-button').click();
		await page.waitForFunction(() => window.__hospitalShiftTestHooks.getShiftState()?.phase === 'playing');
		const again = (await hooks(page, 'getScheduledPatients')).map((x) => `${x.conditionId}/${x.designKey}/${x.at.toFixed(2)}`);
		expect(again).toEqual(first);

		// The month run is untouched: back to the start screen, it's still shift 9.
		await finishShift(page);
		await page.locator('#hospital-paycheck-back-button').click();
		await expect(page.locator('#hospital-start-screen')).toBeVisible();
		await expect(page.locator('#hospital-daily-best')).toContainText('Your best today');
		await startShift(page);
		expect((await shiftState(page)).shiftNumber).toBe(9);
		await expect(page.locator('#hospital-hud-shift')).toHaveText('9/30');
	});

	test("a daily run submits to today's board, and the tabs switch boards", async ({ page }) => {
		const playerName = testPlayerName();
		try {
			await page.goto('/hospital-shift');
			await page.locator('#hospital-daily-button').click();
			await page.waitForFunction(() => window.__hospitalShiftTestHooks?.getShiftState()?.phase === 'playing');
			await finishShift(page);
			await expect(page.locator('#hospital-final-paycheck-block')).toBeVisible();
			await page.locator('#hospital-paycheck-name-input').fill(playerName);
			const [response] = await Promise.all([
				page.waitForResponse((r) => r.url().includes('/hospital-shift/score') && r.request().method() === 'POST'),
				page.locator('#hospital-paycheck-submit-button').click(),
			]);
			expect(response.ok()).toBeTruthy();
			const board = page.locator('#hospital-leaderboard');
			await expect(board).toHaveAttribute('data-board', 'daily');
			await expect(board).toContainText(playerName);

			// The daily runs fullscreen; leave it to reach the leaderboard beside the game.
			await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
			await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
			await board.getByRole('button', { name: 'All-time' }).click();
			await expect(page.locator('#hospital-leaderboard')).toHaveAttribute('data-board', 'all');
			await expect(page.locator('#hospital-leaderboard')).not.toContainText(playerName);
			await page.locator('#hospital-leaderboard').getByRole('button', { name: 'Daily Challenge' }).click();
			await expect(page.locator('#hospital-leaderboard')).toHaveAttribute('data-board', 'daily');
			await expect(page.locator('#hospital-leaderboard')).toContainText(playerName);
		} finally {
			await deleteTestScore(playerName);
		}
	});

	test('twists: Short Staffed has no Dr. Okafor; a broken coffee machine refuses to pour', async ({ page }) => {
		await page.goto('/hospital-shift');
		await startShift(page);
		// Dates whose twist is fixed by the date seed (rules.js dailyTwistForDate).
		await hooks(page, 'startDailyFor', '2026-10-04');
		expect((await hooks(page, 'getDaily')).twist).toBe('short-staffed');
		expect((await hooks(page, 'getStaff')).some((m) => m.key === 'doctor')).toBe(false);

		await hooks(page, 'startDailyFor', '2026-10-09');
		expect((await hooks(page, 'getDaily')).twist).toBe('broken-coffee');
		expect((await shiftState(page)).perks.sanityDrain).toBe(0.75);
		await walkTo(page, 'coffee-machine');
		await expect(page.locator('#hospital-toast')).toContainText('out of order');
		expect(await hooks(page, 'getOverlay')).toBeNull();
	});
});

test.describe('leaving resets the game', () => {
	test('a refresh starts over at shift 1 with everything reset, and the old save is cleared', async ({ page }) => {
		await page.addInitScript(() => {
			if (window.sessionStorage.getItem('legacy-seeded')) return;
			window.sessionStorage.setItem('legacy-seeded', '1');
			window.localStorage.setItem('hospital-game:v1', JSON.stringify({ version: 1, currentShift: 12 }));
		});
		await seedProgress(page, { currentShift: 12, monthToDateGard: 9000, bestRunTotal: 50000, careerXp: 2500, foundMel: true });
		await page.goto('/hospital-shift');
		await expect(page.locator('#hospital-hud-shift')).toHaveText('12/30');
		await expect(page.locator('#hospital-rank-title')).toHaveText('Lv 7 · Trauma Nurse');
		await expect(page.locator('#hospital-mel-badge')).toBeVisible();
		expect(await page.evaluate(() => window.localStorage.getItem('hospital-game:v1'))).toBeNull();

		await page.reload();
		await expect(page.locator('#hospital-hud-shift')).toHaveText('1/30');
		await expect(page.locator('#hospital-hud-rank')).toHaveText('Lv 1');
		await expect(page.locator('#hospital-rank-title')).toHaveText('Lv 1 · Student Nurse');
		await expect(page.locator('#hospital-mel-badge')).toBeHidden();
		await startShift(page);
		expect((await shiftState(page)).shiftNumber).toBe(1);
	});
});

test.describe('revisiting via HTMX after navigating away', () => {
	test('a second HTMX visit still starts a shift', async ({ page }) => {
		await page.goto('/projects');
		const playNow = () => page.locator('.project-card').filter({ hasText: 'Hospital Shift' }).getByRole('link', { name: 'Play now' });
		const projectsLink = () => page.locator('#primary-nav').getByRole('link', { name: 'Projects', exact: true });
		await playNow().click();
		await expect(page.locator('#hospital-canvas')).toBeVisible();
		// Finish shift 1 so there's progress for leaving to wipe.
		await startShift(page);
		await hooks(page, 'skipToClosing');
		await walkTo(page, 'office');
		await page.locator('#hospital-paycheck-next-shift-button').click();
		await expect(page.locator('#hospital-hud-shift')).toHaveText('2/30');
		await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
		await projectsLink().click();
		await expect(page).toHaveURL(/\/projects$/);
		await playNow().click();
		await expect(page.locator('#hospital-start-screen')).toBeVisible();
		await expect(page.locator('#hospital-hud-shift')).toHaveText('1/30');
		await startShift(page);
		await expect(page.locator('#hospital-hud-shift')).toHaveText('1/30');
	});
});

test('no console errors on load and during play', async ({ page }) => {
	const errors = [];
	page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
	page.on('pageerror', (err) => errors.push(String(err)));
	await seedSave(page);
	await page.goto('/hospital-shift');
	await startShift(page);
	for (const c of ['cut', 'appendicitis', 'asthma']) await hooks(page, 'spawnPatientNow', c);
	await page.waitForTimeout(400);
	await page.locator('#hospital-fullscreen-button').click();
	await page.waitForTimeout(200);
	expect(errors).toEqual([]);
});
