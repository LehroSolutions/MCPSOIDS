import path from 'path';

export class SecurityManager {
    private allowedRoots: string[] = [];

    constructor(initialRoots: string[] = []) {
        // Normalize all paths to ensure consistent comparison
        this.allowedRoots = initialRoots.map(r => path.resolve(r));
    }

    /**
     * The "Active Robustness" Check.
     * Throws if the path is outside allowed roots.
     */
    public validatePath(accessPath: string): string {
        const resolved = path.resolve(accessPath);

        const isAllowed = this.allowedRoots.some(root => {
            const relative = path.relative(root, resolved);
            // Allowed if resolved is the root itself, or a descendant.
            // Reject if it escapes (..), or if it's an absolute path (different drive on Windows).
            const escapes = relative === '..' || relative.startsWith(`..${path.sep}`);
            return relative === '' || (!escapes && !path.isAbsolute(relative));
        });

        if (!isAllowed) {
            throw new Error(`Security Violation: Access denied to ${accessPath}. Path is not within allowed roots: ${this.allowedRoots.join(', ')}`);
        }

        return resolved;
    }

    public addRoot(root: string) {
        this.allowedRoots.push(path.resolve(root));
    }
}
