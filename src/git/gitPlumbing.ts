import { execFile } from "child_process";

let gitAvailable: boolean | undefined;

/**
 * Runs `git` with the given arguments via `execFile` (never a shell string, so no path/message value passed in
 * `args` can be interpreted as shell syntax) and resolves with trimmed stdout. Rejects with the process's
 * stderr (or its error message) on a non-zero exit. `options.input`, if given, is written to the process's
 * stdin (e.g. for batch commands like `hash-object --stdin-paths`).
 */
export function execGit(args: string[], options?: { cwd?: string; input?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", args, { cwd: options?.cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stdout + stderr).trim() || error.message));
        return;
      }
      resolve(stdout.trim());
    });
    if (options?.input !== undefined) {
      child.stdin?.end(options.input);
    }
  });
}

/** Whether the `git` executable is available on PATH. Cached for the extension's lifetime, so a missing binary
 * is only probed once instead of on every sync attempt. */
export async function isGitAvailable(): Promise<boolean> {
  if (gitAvailable !== undefined) {
    return gitAvailable;
  }
  try {
    await execGit(["--version"]);
    gitAvailable = true;
  } catch {
    gitAvailable = false;
  }
  return gitAvailable;
}

/** Test-only: resets the cached `isGitAvailable()` result. */
export function resetGitAvailableCache(): void {
  gitAvailable = undefined;
}
