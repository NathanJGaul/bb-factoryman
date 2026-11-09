import type { Files } from "../../src/files";

/** An in-memory `Files`. A path in `errors` throws on read, a path in `files` returns its text, and `writeNew` never changes a path that is in `files`. */
export class FakeFiles implements Files {
  files = new Map<string, string>();
  errors = new Map<string, Error>();
  reads: string[] = [];
  /** Every path that `writeNew` created, in order. */
  writes: string[] = [];
  /** A path in `writeErrors` makes `writeNew` throw. */
  writeErrors = new Map<string, Error>();

  async readText(path: string): Promise<string | null> {
    this.reads.push(path);
    const error = this.errors.get(path);
    if (error) throw error;
    return this.files.get(path) ?? null;
  }

  async writeNew(path: string, text: string): Promise<"written" | "exists"> {
    const error = this.writeErrors.get(path);
    if (error) throw error;
    if (this.files.has(path)) return "exists";
    this.files.set(path, text);
    this.writes.push(path);
    return "written";
  }
}
