import cron from "node-cron";

// Prevent duplicate scheduling in dev with HMR
declare global {
  var __cronInitialized: boolean | undefined;
}

if (process.env.NODE_ENV !== "production" && !global.__cronInitialized) {
  global.__cronInitialized = true;

  // Check hourly at minute 0; trigger when hour matches settings.dailySendHour
  cron.schedule("0 * * * *", async () => {
    try {
      const res = await fetch("http://localhost:3000/api/settings");
      const s = await res.json().catch(() => ({}));
      const hour = typeof s?.dailySendHour === "number" ? s.dailySendHour : 8;
      const now = new Date();
      if (now.getHours() === hour) {
        await fetch("http://localhost:3000/api/schedule/run-daily");
      }
    } catch {
      // ignore in dev
    }
  });

  // Optional: run once shortly after startup to aid dev testing
  setTimeout(async () => {
    try {
      await fetch("http://localhost:3000/api/schedule/run-daily");
    } catch {}
  }, 5000);
}
