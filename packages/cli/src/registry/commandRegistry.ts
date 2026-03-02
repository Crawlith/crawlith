import { Command, Option } from 'commander';
import { getDb, PluginRegistry, SiteRepository } from '@crawlith/core';

/**
 * Normalized representation of a command option used by completion.
 */
export interface CommandFlagMetadata {
  name: string;
  short?: string;
  type: 'boolean' | 'string' | 'enum';
  enumValues?: string[];
  requiresValue: boolean;
  multiple: boolean;
  description: string;
}

/**
 * Normalized representation of a command and its nested subcommands.
 */
export interface CommandMetadata {
  name: string;
  aliases: string[];
  description: string;
  flags: CommandFlagMetadata[];
  subcommands: CommandMetadata[];
  command: Command;
}

/**
 * Completion context extracted from shell tokens.
 */
export interface CompletionContext {
  words: string[];
  cword: number;
}

/**
 * Dynamic command registry backed by commander's runtime command tree.
 */
export class CommandRegistry {
  constructor(private readonly program: Command, private readonly plugins: PluginRegistry) { }

  /**
   * Returns normalized metadata for top-level commands.
   */
  getCommands(): CommandMetadata[] {
    return this.program.commands
      .filter(command => !command.name().startsWith('__'))
      .map(command => this.commandToMetadata(command));
  }

  /**
   * Generate completion suggestions for the provided shell context.
   *
   * @param context Parsed shell completion context.
   * @returns Suggestions as raw strings.
   */
  getCompletions(context: CompletionContext): string[] {
    const cword = Math.max(0, Math.min(context.cword, context.words.length - 1));
    const current = context.words[cword] ?? '';
    const consumed = context.words.slice(1, cword);

    const resolution = this.resolveCommand(consumed);
    const activeCommand = resolution.command;
    const commandDepth = resolution.consumed;
    const leftovers = consumed.slice(commandDepth);
    const previous = consumed[consumed.length - 1];
    const activeMetadata = this.commandToMetadata(activeCommand);

    const valueOption = previous ? this.findOptionByToken(activeCommand, previous) : undefined;
    if (valueOption && this.requiresValue(valueOption)) {
      return this.filterByPrefix(this.suggestOptionValues(activeCommand, valueOption, leftovers), current);
    }

    if (current.startsWith('-')) {
      return this.filterByPrefix(this.suggestFlags(activeCommand, leftovers), current);
    }

    const subcommandSuggestions = this.suggestSubcommands(activeMetadata, leftovers.length === 0);
    if (subcommandSuggestions.length > 0) {
      return this.filterByPrefix(subcommandSuggestions, current);
    }

    const positionalSuggestions = this.suggestPositionalValues(activeCommand);
    return this.filterByPrefix(positionalSuggestions, current);
  }

  private commandToMetadata(command: Command): CommandMetadata {
    return {
      name: command.name(),
      aliases: command.aliases(),
      description: command.description() ?? '',
      flags: command.options.map(option => this.optionToMetadata(option)),
      subcommands: command.commands.filter(c => !c.name().startsWith('__')).map(c => this.commandToMetadata(c)),
      command
    };
  }

  private optionToMetadata(option: Option): CommandFlagMetadata {
    const enumValues = option.argChoices;
    return {
      name: option.long,
      short: option.short || undefined,
      type: enumValues?.length ? 'enum' : (this.requiresValue(option) ? 'string' : 'boolean'),
      enumValues,
      requiresValue: this.requiresValue(option),
      multiple: option.variadic,
      description: option.description ?? ''
    };
  }

  private requiresValue(option: Option): boolean {
    return option.required || option.optional || option.variadic;
  }

  private resolveCommand(tokens: string[]): { command: Command; consumed: number } {
    let command = this.program;
    let consumed = 0;
    for (const token of tokens) {
      if (token.startsWith('-')) break;
      const next = command.commands.find(candidate => {
        const names = [candidate.name(), ...candidate.aliases()];
        return names.includes(token) && !candidate.name().startsWith('__');
      });
      if (!next) break;
      command = next;
      consumed += 1;
    }
    return { command, consumed };
  }

  private findOptionByToken(command: Command, token: string): Option | undefined {
    return command.options.find(option => option.long === token || option.short === token);
  }

  private suggestFlags(command: Command, consumedTokens: string[]): string[] {
    const usedFlags = new Set<string>();
    for (let index = 0; index < consumedTokens.length; index += 1) {
      const token = consumedTokens[index];
      if (!token.startsWith('-')) continue;
      const option = this.findOptionByToken(command, token);
      if (!option) continue;
      if (!option.variadic) {
        if (option.long) usedFlags.add(option.long);
        if (option.short) usedFlags.add(option.short);
      }
      if (this.requiresValue(option)) {
        index += 1;
      }
    }

    return command.options
      .flatMap(option => [option.long, option.short].filter(Boolean) as string[])
      .filter(flag => !usedFlags.has(flag));
  }

  private suggestSubcommands(command: CommandMetadata, atBeginning: boolean): string[] {
    if (!atBeginning) return [];
    return command.subcommands.flatMap(sub => [sub.name, ...sub.aliases]);
  }

  private suggestOptionValues(command: Command, option: Option, consumedTokens: string[]): string[] {
    if (option.argChoices && option.argChoices.length > 0) {
      return option.argChoices;
    }

    if (command.name() === 'clean') {
      return this.getKnownSites();
    }

    return [];
  }

  private suggestPositionalValues(command: Command): string[] {
    if (command.name() === 'clean' || command.name() === 'export' || command.name() === 'ui') {
      return this.getKnownSites();
    }
    return [];
  }

  private getKnownSites(): string[] {
    try {
      const db = getDb();
      const sites = new SiteRepository(db).getAllSites();
      return sites.map(site => site.domain);
    } catch {
      return [];
    }
  }

  private filterByPrefix(values: string[], prefix: string): string[] {
    return [...new Set(values)]
      .filter(value => value.startsWith(prefix))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Exposes plugin registry for execution-time use.
   */
  getPluginRegistry(): PluginRegistry {
    return this.plugins;
  }
}
