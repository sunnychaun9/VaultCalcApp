/**
 * VaultCalc - Calculator Engine
 *
 * Core calculation logic for the calculator.
 * Handles expression parsing, evaluation, and error handling.
 *
 * @see FEATURE_INDEX.md CALC-002
 */

/** Supported operators */
export type Operator = '+' | '-' | '×' | '÷';

/** Operator precedence (higher = evaluated first) */
const PRECEDENCE: Record<Operator, number> = {
  '+': 1,
  '-': 1,
  '×': 2,
  '÷': 2,
};

/** Calculator state */
export interface CalculatorState {
  /** Current display value */
  display: string;
  /** Expression being built */
  expression: string;
  /** Previous operand for chained operations */
  previousOperand: string | null;
  /** Current operator */
  operator: Operator | null;
  /** Whether we just evaluated (for operator chaining) */
  justEvaluated: boolean;
  /** Memory value */
  memory: number | null;
  /** Error state */
  error: string | null;
}

/** Initial calculator state */
export const initialState: CalculatorState = {
  display: '0',
  expression: '',
  previousOperand: null,
  operator: null,
  justEvaluated: false,
  memory: null,
  error: null,
};

/** Maximum digits allowed in display */
const MAX_DIGITS = 15;

/** Maximum digits before switching to scientific notation */
const MAX_DISPLAY_DIGITS = 12;

/**
 * Token types for expression parsing
 */
type Token = { type: 'number'; value: number } | { type: 'operator'; value: Operator };

/**
 * Tokenize an expression string into numbers and operators
 */
function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let currentNumber = '';

  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];

    if (char === ' ') {
      continue;
    }

    if (char === '-' && (i === 0 || isOperator(expression[i - 1]))) {
      // Negative number
      currentNumber += char;
    } else if (isOperator(char)) {
      if (currentNumber) {
        tokens.push({ type: 'number', value: parseFloat(currentNumber) });
        currentNumber = '';
      }
      tokens.push({ type: 'operator', value: char as Operator });
    } else {
      currentNumber += char;
    }
  }

  if (currentNumber) {
    tokens.push({ type: 'number', value: parseFloat(currentNumber) });
  }

  return tokens;
}

/**
 * Check if a character is an operator
 */
function isOperator(char: string): char is Operator {
  return char === '+' || char === '-' || char === '×' || char === '÷';
}

/**
 * Evaluate a tokenized expression using operator precedence
 */
function evaluateTokens(tokens: Token[]): number {
  if (tokens.length === 0) {
    return 0;
  }

  // Convert to postfix notation (Shunting Yard algorithm)
  const outputQueue: Token[] = [];
  const operatorStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      outputQueue.push(token);
    } else {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type === 'operator' &&
        PRECEDENCE[(operatorStack[operatorStack.length - 1] as { type: 'operator'; value: Operator }).value] >=
          PRECEDENCE[token.value]
      ) {
        outputQueue.push(operatorStack.pop()!);
      }
      operatorStack.push(token);
    }
  }

  while (operatorStack.length > 0) {
    outputQueue.push(operatorStack.pop()!);
  }

  // Evaluate postfix expression
  const evalStack: number[] = [];

  for (const token of outputQueue) {
    if (token.type === 'number') {
      evalStack.push(token.value);
    } else {
      const b = evalStack.pop()!;
      const a = evalStack.pop()!;
      const result = applyOperator(a, b, token.value);
      evalStack.push(result);
    }
  }

  return evalStack[0] ?? 0;
}

/**
 * Apply an operator to two operands
 */
function applyOperator(a: number, b: number, operator: Operator): number {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      if (b === 0) {
        throw new Error('Division by zero');
      }
      return a / b;
  }
}

/**
 * Evaluate a complete expression string
 */
export function evaluate(expression: string): { result: number; error: string | null } {
  try {
    // Clean the expression
    const cleaned = expression
      .replace(/\s+/g, '')
      .replace(/−/g, '-') // Replace minus sign
      .replace(/\u2212/g, '-') // Unicode minus
      .replace(/\u00D7/g, '×') // Ensure multiplication sign
      .replace(/\u00F7/g, '÷'); // Ensure division sign

    if (!cleaned || cleaned === '-') {
      return { result: 0, error: null };
    }

    const tokens = tokenize(cleaned);
    const result = evaluateTokens(tokens);

    // Check for infinity
    if (!isFinite(result)) {
      if (result === Infinity) {
        return { result: Infinity, error: null };
      }
      if (result === -Infinity) {
        return { result: -Infinity, error: null };
      }
      return { result: 0, error: 'Error' };
    }

    return { result, error: null };
  } catch (error) {
    if (error instanceof Error && error.message === 'Division by zero') {
      return { result: Infinity, error: null };
    }
    return { result: 0, error: 'Error' };
  }
}

/**
 * Format a number for display
 * Handles thousands separators, decimal precision, and scientific notation
 */
export function formatDisplay(value: number): string {
  // Handle special cases
  if (!isFinite(value)) {
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '-∞';
    return 'Error';
  }

  if (isNaN(value)) {
    return 'Error';
  }

  // Convert to string with reasonable precision
  let str: string;

  // Check if we need scientific notation
  const absValue = Math.abs(value);
  if (absValue !== 0 && (absValue >= 1e12 || absValue < 1e-9)) {
    str = value.toExponential(6);
  } else {
    // Use fixed notation with appropriate decimal places
    str = value.toPrecision(MAX_DISPLAY_DIGITS);

    // Remove trailing zeros after decimal point
    if (str.includes('.')) {
      str = str.replace(/\.?0+$/, '');
    }

    // If the number is too long, use exponential
    if (str.replace(/[^0-9]/g, '').length > MAX_DISPLAY_DIGITS) {
      str = value.toExponential(6);
    }
  }

  return str;
}

/**
 * Format a number with thousands separators for display
 */
export function formatWithSeparators(value: string): string {
  // Don't format special values
  if (value === 'Error' || value === '∞' || value === '-∞' || value.includes('e')) {
    return value;
  }

  const isNegative = value.startsWith('-');
  const absValue = isNegative ? value.slice(1) : value;

  const [integerPart, decimalPart] = absValue.split('.');

  // Add thousands separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  let result = formattedInteger;
  if (decimalPart !== undefined) {
    result += '.' + decimalPart;
  }

  if (isNegative) {
    result = '-' + result;
  }

  return result;
}

/**
 * Check if adding a digit would exceed max length
 */
export function canAddDigit(currentDisplay: string): boolean {
  const digitCount = currentDisplay.replace(/[^0-9]/g, '').length;
  return digitCount < MAX_DIGITS;
}

/**
 * Calculate percentage of a value
 */
export function calculatePercentage(value: number, base: number | null): number {
  if (base === null) {
    // Just divide by 100
    return value / 100;
  }
  // Calculate percentage of base
  return (base * value) / 100;
}

/**
 * Map display operators to internal operators
 */
export function mapOperator(displayOperator: string): Operator | null {
  switch (displayOperator) {
    case '+':
      return '+';
    case '\u2212': // Unicode minus
    case '−':
    case '-':
      return '-';
    case '\u00D7': // Unicode multiplication
    case '×':
    case '*':
      return '×';
    case '\u00F7': // Unicode division
    case '÷':
    case '/':
      return '÷';
    default:
      return null;
  }
}

/**
 * Get display representation of an operator
 */
export function getOperatorDisplay(operator: Operator): string {
  switch (operator) {
    case '+':
      return '+';
    case '-':
      return '−';
    case '×':
      return '×';
    case '÷':
      return '÷';
  }
}
