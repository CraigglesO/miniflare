import { setImmediate } from "timers/promises";
import { BindingsPlugin, ScheduledEvent } from "@d1testflare/core";
import {
  CronScheduler,
  CronSchedulerImpl,
  SchedulerPlugin,
  startScheduler,
} from "@d1testflare/scheduler";
import { Awaitable } from "@d1testflare/shared";
import { TestLog, useMiniflare } from "@d1testflare/shared-test";
import test from "ava";
import { Cron, ITimerHandle } from "cron-schedule";

// Waiting for CRONs is slow, so mock out a scheduler with manual dispatch
function createCronScheduler(): [
  dispatch: (cron: string) => Promise<void>,
  scheduler: Promise<CronSchedulerImpl>
] {
  const crons = new Map<string, Set<() => Awaitable<void>>>();
  const scheduler: CronSchedulerImpl = {
    setInterval(cron: Cron, task: () => Awaitable<void>): ITimerHandle {
      const spec = cron.toString();
      const set = crons.get(spec) ?? new Set();
      crons.set(spec, set);
      set.add(task);
      // Not technically as ITimerHandle, but this is an opaque type anyways
      // so it doesn't really matter
      return [spec, task] as any;
    },
    clearTimeoutOrInterval([spec, task]: any): void {
      crons.get(spec)?.delete(task);
    },
  };
  const dispatch = async (cron: string) => {
    await Promise.all(Array.from(crons.get(cron) ?? []).map((func) => func()));
  };
  return [dispatch, Promise.resolve(scheduler)];
}

test("CronScheduler: schedules tasks for validated CRONs on reload", async (t) => {
  let events: ScheduledEvent[] = [];
  const log = new TestLog();
  const mf = useMiniflare(
    { SchedulerPlugin, BindingsPlugin },
    {
      globals: { eventCallback: (event: ScheduledEvent) => events.push(event) },
      script: 'addEventListener("scheduled", eventCallback)',
      crons: ["15 * * * *", "30 * * * *"],
    },
    log
  );
  await mf.getPlugins(); // Wait for initial reload
  const [dispatch, cronScheduler] = createCronScheduler();
  new CronScheduler(mf, cronScheduler);
  await setImmediate();

  // Check scheduler requires reload to schedule tasks
  await dispatch("15 * * * *");
  t.deepEqual(events, []);

  // Check tasks scheduled on reload and logged when dispatched
  await mf.reload();
  log.logs = [];
  await dispatch("15 * * * *");
  t.is(events.length, 1);
  t.is(events[0].cron, "15 * * * *");
  t.regex(log.logs[0][1], /^SCHD 15 \* \* \* \* \(\d+\.\d+ms\)$/);

  events = [];
  log.logs = [];
  await dispatch("30 * * * *");
  t.is(events.length, 1);
  t.is(events[0].cron, "30 * * * *");
  t.regex(log.logs[0][1], /^SCHD 30 \* \* \* \* \(\d+\.\d+ms\)$/);
});
test("CronScheduler: destroys tasks when CRONs change", async (t) => {
  const events: ScheduledEvent[] = [];
  // noinspection JSUnusedGlobalSymbols
  const options = {
    globals: { eventCallback: (event: ScheduledEvent) => events.push(event) },
    script: 'addEventListener("scheduled", eventCallback)',
    crons: ["15 * * * *"],
  };
  const mf = useMiniflare({ SchedulerPlugin, BindingsPlugin }, options);
  await mf.getPlugins(); // Wait for initial reload
  const [dispatch, cronScheduler] = createCronScheduler();
  new CronScheduler(mf, cronScheduler);
  await mf.reload(); // Schedule tasks

  t.is(events.length, 0);
  await dispatch("15 * * * *");
  t.is(events.length, 1);

  // Update options and check task destroyed
  await mf.setOptions({ ...options, crons: ["30 * * * *"] });
  await dispatch("15 * * * *");
  t.is(events.length, 1);
  await dispatch("30 * * * *");
  t.is(events.length, 2);
});

test("CronScheduler: dispose: destroys tasks and removes reload listener", async (t) => {
  const events: ScheduledEvent[] = [];
  const mf = useMiniflare(
    { SchedulerPlugin, BindingsPlugin },
    {
      globals: { eventCallback: (event: ScheduledEvent) => events.push(event) },
      script: 'addEventListener("scheduled", eventCallback)',
      crons: ["15 * * * *"],
    }
  );
  await mf.getPlugins(); // Wait for initial reload
  const [dispatch, cronScheduler] = createCronScheduler();
  const scheduler = new CronScheduler(mf, cronScheduler);
  await mf.reload(); // Schedule tasks

  t.is(events.length, 0);
  await dispatch("15 * * * *");
  t.is(events.length, 1);

  await scheduler.dispose();
  await dispatch("15 * * * *");
  t.is(events.length, 1);
});

test("createScheduler: automatically schedules tasks", async (t) => {
  const events: ScheduledEvent[] = [];
  const mf = useMiniflare(
    { SchedulerPlugin, BindingsPlugin },
    {
      globals: { eventCallback: (event: ScheduledEvent) => events.push(event) },
      script: 'addEventListener("scheduled", eventCallback)',
      crons: ["15 * * * *"],
    }
  );
  await mf.getPlugins(); // Wait for initial reload
  const [dispatch, cronScheduler] = createCronScheduler();
  await startScheduler(mf, cronScheduler);
  t.is(events.length, 0);
  await dispatch("15 * * * *");
  t.is(events.length, 1);
});
