// bipnip: the agent answers with one JSON object per line (`application/x-ndjson`): status lines,
// then a final line with `ok`. The host adds a blank line now and then to a long wait (a watch), so a
// page that went away is noticed; blank lines carry nothing.

/** Splits text that arrives in pieces into whole lines, keeping a line cut in two until it ends. */
export class LineSplitter {
  private rest = '';

  /** The whole, non-blank lines `chunk` completes. */
  push(chunk: string): string[] {
    const text = this.rest + chunk;
    const parts = text.split('\n');
    this.rest = parts.pop() ?? '';
    return parts.filter((line) => line.trim() !== '');
  }

  /** What is left when the text ends: a last line without its newline, if any. */
  end(): string[] {
    const last = this.rest;
    this.rest = '';
    return last.trim() === '' ? [] : [last];
  }
}

/** A line read as JSON, or undefined for one that is not an object. */
export function parseLine(line: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
