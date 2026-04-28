import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface SpawnOptions {
  profile: string;
  collection: string;
}

export interface ExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export class OBSProcessManager extends EventEmitter {
  private child: ChildProcess | null = null;

  spawn(obsPath: string, opts: SpawnOptions): void {
    if (this.child) {
      throw new Error('OBS-Process läuft bereits');
    }
    // OBS-Flags: nur offizielle. --disable-shutdown-check existiert NICHT,
    // war ein Reviewer-Catch. --disable-updater unterdrückt OBS' eigenen
    // Update-Prompt, was zu unserer Auto-Install-Logik passt.
    const args = [
      '--minimize-to-tray',
      '--disable-updater',
      '--profile', opts.profile,
      '--collection', opts.collection
    ];
    this.child = spawn(obsPath, args, { detached: false });

    this.child.on('exit', (code, signal) => {
      this.child = null;
      this.emit('exit', { code, signal });
    });
    this.child.on('error', (err) => {
      this.child = null;
      this.emit('error', err);
    });
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  async kill(): Promise<void> {
    if (!this.child) return;
    return new Promise<void>((resolve) => {
      const child = this.child!;
      child.once('exit', () => resolve());
      child.kill();
    });
  }
}
