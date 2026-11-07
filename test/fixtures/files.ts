import type { Files } from "../../src/files";

/** An in-memory `Files`. A path in `errors` throws, and a path in `files` returns its text. */
export class FakeFiles implements Files {
  files = new Map<string, string>();
  errors = new Map<string, Error>();
  reads: string[] = [];

  async readText(path: string): Promise<string | null> {
    this.reads.push(path);
    const error = this.errors.get(path);
    if (error) throw error;
    return this.files.get(path) ?? null;
  }
}
