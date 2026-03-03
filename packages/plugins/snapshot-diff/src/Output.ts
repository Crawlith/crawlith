import chalk from 'chalk';

/**
 * Renders human-readable output for snapshot comparison.
 * @param oldSnapshotId Baseline snapshot ID.
 * @param newSnapshotId Target snapshot ID.
 * @param diffResult Graph diff payload from core.
 */
export function renderPrettyDiffOutput(oldSnapshotId: number, newSnapshotId: number, diffResult: any): void {
  console.log(chalk.cyan('\n🔍 Comparing Snapshots'));
  console.log(`${chalk.gray('Old snapshot:')} #${oldSnapshotId}`);
  console.log(`${chalk.gray('New snapshot:')} #${newSnapshotId}\n`);

  console.log(chalk.bold('📈 Comparison Results:'));
  console.log(`- Added URLs:      ${chalk.green(diffResult.addedUrls.length)}`);
  console.log(`- Removed URLs:    ${chalk.red(diffResult.removedUrls.length)}`);
  console.log(`- Status Changes:  ${chalk.yellow(diffResult.changedStatus.length)}`);

  console.log(chalk.bold('\n📉 Metric Deltas:'));
  Object.entries(diffResult.metricDeltas).forEach(([metric, delta]) => {
    const numericDelta = Number(delta);
    const deltaLabel = numericDelta > 0
      ? chalk.green(`+${numericDelta.toFixed(3)}`)
      : numericDelta < 0
        ? chalk.red(numericDelta.toFixed(3))
        : chalk.gray('0');

    console.log(`  ${metric.padEnd(20)}: ${deltaLabel}`);
  });

  console.log(`\n${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}\n`);
}

/**
 * Emits machine-readable JSON output.
 * @param diffResult Graph diff payload from core.
 */
export function renderJsonDiffOutput(diffResult: unknown): void {
  console.log(JSON.stringify(diffResult, null, 2));
}
