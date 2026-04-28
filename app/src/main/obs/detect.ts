import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface OBSDetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
}

export interface DetectOptions {
  skipRegistry?: boolean;
  overridePath?: string;
}

const STANDARD_PATHS_WIN = [
  'C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe',
  'C:\\Program Files (x86)\\obs-studio\\bin\\32bit\\obs32.exe'
];

export async function detectOBSInstallation(
  opts: DetectOptions = {}
): Promise<OBSDetectionResult> {
  if (opts.overridePath) {
    return fs.existsSync(opts.overridePath)
      ? { installed: true, path: opts.overridePath }
      : { installed: false };
  }

  for (const p of STANDARD_PATHS_WIN) {
    if (fs.existsSync(p)) {
      return { installed: true, path: p };
    }
  }

  if (!opts.skipRegistry && process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(
        'reg query "HKLM\\SOFTWARE\\OBS Studio" /ve',
        { timeout: 3000 }
      );
      const match = stdout.match(/REG_SZ\s+(.+)$/m);
      if (match) {
        const installDir = match[1].trim();
        const exe = `${installDir}\\bin\\64bit\\obs64.exe`;
        if (fs.existsSync(exe)) {
          return { installed: true, path: exe };
        }
      }
    } catch {
      // reg query failed
    }
  }

  return { installed: false };
}
