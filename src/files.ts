import { readFile } from "node:fs/promises";

export interface Files {
  /** The file's text, or null when the file does not exist. Any other failure throws. */
  readText(path: string): Promise<string | null>;
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
};
