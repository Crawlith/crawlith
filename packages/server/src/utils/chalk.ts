import { styleText } from 'node:util';

interface Chalk {
  (text: unknown): string;
  [key: string]: Chalk;
}

const alias: Record<string, string> = {
  grey: 'gray'
};

const chalk = createChalk([]);

function createChalk(styles: string[]): Chalk {
  const formatter = ((text: unknown) => applyStyles(styles, text)) as Chalk;

  return new Proxy(formatter, {
    apply(_target, _thisArg, args) {
      return applyStyles(styles, args[0]);
    },
    get(_target, prop) {
      if (typeof prop !== 'string') {
        return undefined;
      }
      const style = alias[prop] ?? prop;
      return createChalk([...styles, style]);
    }
  }) as Chalk;
}

function applyStyles(styles: string[], text: unknown): string {
  const value = String(text ?? '');
  if (styles.length === 0 || !isColorEnabled()) {
    return value;
  }
  return styleText(styles as never, value);
}

function isColorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined || process.env.NODE_DISABLE_COLORS !== undefined) {
    return false;
  }

  const forceColor = process.env.FORCE_COLOR;
  if (forceColor === '0') {
    return false;
  }
  if (forceColor !== undefined) {
    return true;
  }

  return Boolean(process.stdout?.isTTY);
}

export default chalk;
