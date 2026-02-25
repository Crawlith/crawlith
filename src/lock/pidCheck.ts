export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    if (error.code === 'EPERM') {
      // Process exists but no permission to signal -> Alive
      return true;
    }
    // Process does not exist (ESRCH) or other error
    return false;
  }
}
