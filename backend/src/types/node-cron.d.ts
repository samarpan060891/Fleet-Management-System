declare module 'node-cron' {
  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }
  export interface ScheduledTask {
    start(): void;
    stop(): void;
  }
  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;
  export function validate(expression: string): boolean;
  const _default: { schedule: typeof schedule; validate: typeof validate };
  export default _default;
}
