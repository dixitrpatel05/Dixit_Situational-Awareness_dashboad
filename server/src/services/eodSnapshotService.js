import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { isAfterEodCutoff, istDate, nowIST } from "../utils/time.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE = path.resolve(__dirname, "../../data/eod-snapshot.json");

async function ensureDir() {
  await fs.mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
}

export async function readEodSnapshot() {
  try {
    const text = await fs.readFile(SNAPSHOT_FILE, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function writeEodSnapshot(payloadByMode) {
  const now = nowIST();
  const snapshot = {
    sessionDate: istDate(now),
    savedAtIST: now.format("YYYY-MM-DD HH:mm:ss"),
    modes: payloadByMode
  };
  await ensureDir();
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

export async function getSnapshotForMode(mode) {
  const snapshot = await readEodSnapshot();
  if (!snapshot || !snapshot.modes || !snapshot.modes[mode]) {
    return null;
  }
  return {
    snapshot,
    payload: snapshot.modes[mode]
  };
}

export async function shouldCreateTodaySnapshot() {
  const now = nowIST();
  if (!isAfterEodCutoff(now, 16, 30)) {
    return false;
  }

  const existing = await readEodSnapshot();
  const today = istDate(now);
  return !existing || existing.sessionDate !== today;
}

export function startEodScheduler(createSnapshot, intervalMs = 5 * 60 * 1000) {
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const shouldCreate = await shouldCreateTodaySnapshot();
      if (shouldCreate) {
        await createSnapshot();
      }
    } catch (error) {
      console.error("EOD snapshot scheduler error:", error?.message || error);
    } finally {
      running = false;
    }
  };

  tick();
  return setInterval(tick, intervalMs);
}
