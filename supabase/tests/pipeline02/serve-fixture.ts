export let handler: ((req: Request) => Response | Promise<Response>) | undefined;

export function serve(fn: NonNullable<typeof handler>): void {
  handler = fn;
}
