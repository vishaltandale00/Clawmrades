export async function register() {
  const { generateWork } = await import("@/lib/generate-work");

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { created } = await generateWork();
      console.log(`[startup] Seeded work queue: ${created} items`);
      return;
    } catch (err) {
      if (attempt < maxRetries) {
        console.warn(`[startup] Work queue seed attempt ${attempt}/${maxRetries} failed, retrying in ${attempt * 2}s...`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
      } else {
        console.error("[startup] Failed to seed work queue after all retries:", err);
      }
    }
  }
}
