import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface Files {
  /** The file's text, or null when the file does not exist. Any other failure throws. */
  readText(path: string): Promise<string | null>;
  /**
   * Create the file with `text`, and its directory when that is missing. It never changes an existing file: it
   * returns `exists` and leaves the file as it was. Any other failure throws.
   */
  writeNew(path: string, text: string): Promise<"written" | "exists">;
}

const MISSING = new Set(["ENOENT", "ENOTDIR"]);

export const nodeFiles: Files = {
  async readText(path) {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (typeof code === "string" && MISSING.has(code)) return null;
      throw error;
    }
  },

  async writeNew(path, text) {
    await mkdir(dirname(path), { recursive: true });
    try {
      // The `wx` flag fails when the file exists, so two writers cannot both create it and nothing is overwritten.
      await writeFile(path, text, { encoding: "utf8", flag: "wx" });
      return "written";
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === "EEXIST") return "exists";
      throw error;
    }
  },
};
