import fs from 'fs';
import path from 'path';

function resolveRealPath(target: string): string {
  const resolved = path.resolve(target);
  let current = resolved;
  const pending: string[] = [];

  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return pending.length > 0 ? path.join(real, ...pending) : real;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      // A write target need not exist yet, so canonicalize the nearest existing
      // ancestor and re-append the missing segments: resolving only the full
      // path would let a not-yet-created leaf hide a symlinked parent.
      const parent = path.dirname(current);
      if (parent === current) {
        return resolved;
      }
      pending.unshift(path.basename(current));
      current = parent;
    }
  }
}

export class SecurityManager {
  private allowedRoots: string[] = [];

  constructor(initialRoots: string[] = []) {
    this.allowedRoots = initialRoots.map((root) => resolveRealPath(root));
  }

  /**
   * The "Active Robustness" Check.
   * Throws if the path is outside allowed roots.
   */
  public validatePath(accessPath: string): string {
    const resolved = resolveRealPath(accessPath);

    const isAllowed = this.allowedRoots.some((root) => {
      const relative = path.relative(root, resolved);
      // Allowed if resolved is the root itself, or a descendant.
      // Reject if it escapes (..), or if it's an absolute path (different drive on Windows).
      const escapes = relative === '..' || relative.startsWith(`..${path.sep}`);
      return relative === '' || (!escapes && !path.isAbsolute(relative));
    });

    if (!isAllowed) {
      throw new Error(
        'Security Violation: Access denied to the requested path. Path is not within allowed roots.',
      );
    }

    return resolved;
  }

  public addRoot(root: string) {
    this.allowedRoots.push(resolveRealPath(root));
  }
}
