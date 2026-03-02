import { Command, Option } from 'commander';
import { CommandRegistry } from '../registry/commandRegistry.js';

/**
 * Build shell completion script for Crawlith.
 *
 * @param shell Target shell implementation.
 * @returns Shell script source.
 */
function buildCompletionScript(shell: 'bash' | 'zsh'): string {
  if (shell === 'zsh') {
    return `#compdef crawlith
_crawlith_completion() {
  local -a completions
  local completion
  completions=("\${(@f)\$(COMP_WORDS="\${(j: :)words}" COMP_CWORD=$((CURRENT-1)) crawlith __complete 2>/dev/null)}")
  for completion in $completions; do
    compadd -- "$completion"
  done
}
compdef _crawlith_completion crawlith
`;
  }

  return `_crawlith_completion() {
  local IFS=$'\n'
  local completions
  completions=\$(COMP_WORDS="\${COMP_WORDS[*]}" COMP_CWORD=$COMP_CWORD crawlith __complete 2>/dev/null)
  COMPREPLY=(\$(compgen -W "$completions" -- "\${COMP_WORDS[COMP_CWORD]}"))
}
complete -F _crawlith_completion crawlith
`;
}

/**
 * Parse completion context from shell variables.
 *
 * @returns Parsed words and cursor index.
 */
export function getCompletionContextFromEnv(): { words: string[]; cword: number } {
  const wordsRaw = process.env.COMP_WORDS ?? '';
  const cwordRaw = process.env.COMP_CWORD ?? '0';
  const words = wordsRaw.length > 0 ? wordsRaw.split(/\s+/).filter(Boolean) : process.argv.slice(2);
  const cword = Number.parseInt(cwordRaw, 10);

  return {
    words,
    cword: Number.isFinite(cword) ? cword : Math.max(words.length - 1, 0)
  };
}

/**
 * Hidden internal completion command.
 */
export function getInternalCompleteCommand(registry: CommandRegistry): Command {
  return new Command('__complete')
    .description('Internal completion entrypoint')
    .hideHelp()
    .action(() => {
      if (!process.env.COMP_WORDS || !process.env.COMP_CWORD) {
        return;
      }

      const context = getCompletionContextFromEnv();
      const suggestions = registry.getCompletions(context);
      if (suggestions.length > 0) {
        process.stdout.write(`${suggestions.join('\n')}\n`);
      }
    });
}

/**
 * Public command that emits shell completion scripts.
 */
export function getCompletionCommand(): Command {
  return new Command('completion')
    .description('Generate shell completion script')
    .addOption(new Option('--shell <name>', 'Shell to generate for').choices(['bash', 'zsh']).default('bash'))
    .action((options: { shell: 'bash' | 'zsh' }) => {
      process.stdout.write(buildCompletionScript(options.shell));
    });
}
