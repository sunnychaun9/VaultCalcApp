/**
 * VaultCalc - Calculator Hook
 *
 * Custom hook for managing calculator state and operations.
 * Provides a clean interface for the calculator screen.
 * Supports PIN detection callback for vault access.
 *
 * @see FEATURE_INDEX.md CALC-002, AUTH-001
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  evaluate,
  formatDisplay,
  formatWithSeparators,
  canAddDigit,
  calculatePercentage,
  mapOperator,
  getOperatorDisplay,
  type Operator,
} from '../utils/calculatorEngine';

/** PIN check callback type */
export type PinCheckCallback = (input: string) => Promise<{
  wasAuthAttempt: boolean;
  authenticated: boolean;
}>;

/** A single history entry (expression + result) */
export interface HistoryEntry {
  expression: string;
  result: string;
}

interface CalculatorState {
  /** Current input being typed */
  currentInput: string;
  /** Previous operand (left side of operation) */
  previousInput: string | null;
  /** Current operator waiting to be applied */
  operator: Operator | null;
  /** Full expression for display */
  expression: string;
  /** Whether the last action was equals */
  justEvaluated: boolean;
  /** Memory value */
  memory: number | null;
  /** Last operator and operand for repeat equals */
  lastOperation: { operator: Operator; operand: string } | null;
  /** Calculation history (last 3 operations, in-memory only) */
  history: HistoryEntry[];
  /** Raw digit buffer for PIN detection (not affected by leading-zero replacement) */
  pinBuffer: string;
}

const initialState: CalculatorState = {
  currentInput: '0',
  previousInput: null,
  operator: null,
  expression: '',
  justEvaluated: false,
  memory: null,
  lastOperation: null,
  history: [],
  pinBuffer: '',
};

export interface UseCalculatorOptions {
  /** Optional callback to check if input is a PIN */
  onPinCheck?: PinCheckCallback;
}

export interface UseCalculatorReturn {
  /** Formatted display value */
  display: string;
  /** Expression string (e.g., "5 + 3 =") */
  expression: string;
  /** Whether memory has a value */
  memoryHasValue: boolean;
  /** Handle any button press */
  handleButtonPress: (value: string) => void;
  /** Current raw input value (for PIN detection) */
  rawInput: string;
  /** Calculation history (last 3, in-memory only) */
  history: HistoryEntry[];
}

/**
 * Custom hook for calculator functionality
 *
 * @param options Optional configuration including PIN check callback
 */
export function useCalculator(options?: UseCalculatorOptions): UseCalculatorReturn {
  const [state, setState] = useState<CalculatorState>(initialState);
  const isCheckingPin = useRef(false);

  /**
   * Input a digit (0-9)
   */
  const inputDigit = useCallback((digit: string) => {
    setState((prev) => {
      // If we just evaluated, start fresh
      if (prev.justEvaluated) {
        return {
          ...prev,
          currentInput: digit,
          expression: '',
          justEvaluated: false,
          pinBuffer: digit,
        };
      }

      // Check digit limit
      if (!canAddDigit(prev.currentInput)) {
        return prev;
      }

      // Replace leading zero or append
      const newInput =
        prev.currentInput === '0' ? digit : prev.currentInput + digit;

      return {
        ...prev,
        currentInput: newInput,
        pinBuffer: prev.pinBuffer + digit,
      };
    });
  }, []);

  /**
   * Input decimal point
   */
  const inputDecimal = useCallback(() => {
    setState((prev) => {
      // If we just evaluated, start with "0."
      if (prev.justEvaluated) {
        return {
          ...prev,
          currentInput: '0.',
          expression: '',
          justEvaluated: false,
          pinBuffer: '',
        };
      }

      // Only add decimal if not already present
      if (prev.currentInput.includes('.')) {
        return prev;
      }

      return {
        ...prev,
        currentInput: prev.currentInput + '.',
        pinBuffer: '',
      };
    });
  }, []);

  /**
   * Input an operator (+, -, ×, ÷)
   */
  const inputOperator = useCallback((op: Operator) => {
    setState((prev) => {
      // If we have a pending operation, evaluate it first
      if (prev.operator && prev.previousInput !== null) {
        const expressionToEval = `${prev.previousInput}${prev.operator}${prev.currentInput}`;
        const { result, error } = evaluate(expressionToEval);

        if (error) {
          return {
            ...initialState,
            currentInput: error,
          };
        }

        const formattedResult = formatDisplay(result);
        return {
          ...prev,
          currentInput: '0',
          previousInput: formattedResult,
          operator: op,
          expression: `${formattedResult} ${getOperatorDisplay(op)}`,
          justEvaluated: false,
          pinBuffer: '',
        };
      }

      // Start a new operation
      return {
        ...prev,
        previousInput: prev.currentInput,
        currentInput: '0',
        operator: op,
        expression: `${prev.currentInput} ${getOperatorDisplay(op)}`,
        justEvaluated: false,
        pinBuffer: '',
      };
    });
  }, []);

  /**
   * Evaluate the current expression.
   * If no operator is pending and PIN check callback is provided,
   * first checks if the input is a PIN.
   */
  const evaluateExpression = useCallback(async () => {
    const currentState = state;

    // Check for PIN if:
    // 1. We have a PIN check callback
    // 2. No operator is pending (just a number entered)
    // 3. Not already checking PIN
    // 4. Not repeating a previous operation
    if (
      options?.onPinCheck &&
      !currentState.operator &&
      currentState.previousInput === null &&
      !currentState.justEvaluated &&
      !isCheckingPin.current
    ) {
      isCheckingPin.current = true;
      try {
        const result = await options.onPinCheck(currentState.pinBuffer);
        if (result.wasAuthAttempt) {
          if (result.authenticated) {
            // PIN matched - reset display to 0 (vault will open)
            setState((prev) => ({
              ...prev,
              currentInput: '0',
              expression: '',
              justEvaluated: false,
              pinBuffer: '',
            }));
          } else {
            // PIN attempt failed - show the number (normal behavior)
            // This maintains plausible deniability
            setState((prev) => ({
              ...prev,
              expression: `${prev.currentInput} =`,
              justEvaluated: true,
              lastOperation: null,
              pinBuffer: '',
            }));
          }
          return;
        }
      } finally {
        isCheckingPin.current = false;
      }
    }

    // Normal calculator evaluation
    setState((prev) => {
      // If we just evaluated and press equals again, repeat last operation
      if (prev.justEvaluated && prev.lastOperation) {
        const expressionToEval = `${prev.currentInput}${prev.lastOperation.operator}${prev.lastOperation.operand}`;
        const { result, error } = evaluate(expressionToEval);

        if (error) {
          return {
            ...initialState,
            currentInput: error,
          };
        }

        const formattedResult = formatDisplay(result);
        const displayExpression = `${prev.currentInput} ${getOperatorDisplay(prev.lastOperation.operator)} ${prev.lastOperation.operand} =`;
        return {
          ...prev,
          currentInput: formattedResult,
          expression: displayExpression,
          justEvaluated: true,
          history: [...prev.history, { expression: displayExpression, result: formattedResult }].slice(-3),
        };
      }

      // If no operator, just show equals (no-op — do NOT add to history)
      if (!prev.operator || prev.previousInput === null) {
        return {
          ...prev,
          expression: `${prev.currentInput} =`,
          justEvaluated: true,
          lastOperation: null,
        };
      }

      // Evaluate the pending operation
      const expressionToEval = `${prev.previousInput}${prev.operator}${prev.currentInput}`;
      const { result, error } = evaluate(expressionToEval);

      if (error) {
        return {
          ...initialState,
          currentInput: error,
        };
      }

      const formattedResult = formatDisplay(result);
      const displayExpression = `${prev.previousInput} ${getOperatorDisplay(prev.operator)} ${prev.currentInput} =`;
      return {
        ...prev,
        currentInput: formattedResult,
        previousInput: null,
        operator: null,
        expression: displayExpression,
        justEvaluated: true,
        lastOperation: { operator: prev.operator, operand: prev.currentInput },
        history: [...prev.history, { expression: displayExpression, result: formattedResult }].slice(-3),
      };
    });
  }, [state, options]);

  /**
   * Clear - clears current entry, or all if already 0
   */
  const clearAll = useCallback(() => {
    setState((prev) => {
      // If current is already 0, clear everything including history
      if (prev.currentInput === '0') {
        return {
          ...initialState,
          memory: prev.memory, // Preserve memory
        };
      }
      // Otherwise just clear current
      return {
        ...prev,
        currentInput: '0',
        justEvaluated: false,
        pinBuffer: '',
      };
    });
  }, []);

  /**
   * Backspace - remove last character
   */
  const backspace = useCallback(() => {
    setState((prev) => {
      // Can't backspace after evaluation or on error
      if (prev.justEvaluated || prev.currentInput === 'Error') {
        return {
          ...prev,
          currentInput: '0',
          expression: '',
          justEvaluated: false,
          pinBuffer: '',
        };
      }

      const newInput =
        prev.currentInput.length > 1
          ? prev.currentInput.slice(0, -1)
          : '0';

      return {
        ...prev,
        currentInput: newInput,
        pinBuffer: prev.pinBuffer.length > 1
          ? prev.pinBuffer.slice(0, -1)
          : '',
      };
    });
  }, []);

  /**
   * Calculate percentage
   */
  const percentage = useCallback(() => {
    setState((prev) => {
      const currentValue = parseFloat(prev.currentInput);
      if (isNaN(currentValue)) return prev;

      const baseValue = prev.previousInput ? parseFloat(prev.previousInput) : null;
      const result = calculatePercentage(currentValue, baseValue);
      const formattedResult = formatDisplay(result);

      return {
        ...prev,
        currentInput: formattedResult,
        justEvaluated: false,
      };
    });
  }, []);

  /**
   * Memory Clear
   */
  const memoryClear = useCallback(() => {
    setState((prev) => ({
      ...prev,
      memory: null,
    }));
  }, []);

  /**
   * Memory Recall
   */
  const memoryRecall = useCallback(() => {
    setState((prev) => {
      if (prev.memory === null) return prev;

      return {
        ...prev,
        currentInput: formatDisplay(prev.memory),
        justEvaluated: false,
      };
    });
  }, []);

  /**
   * Memory Add
   */
  const memoryAdd = useCallback(() => {
    setState((prev) => {
      const currentValue = parseFloat(prev.currentInput);
      if (isNaN(currentValue)) return prev;

      return {
        ...prev,
        memory: (prev.memory ?? 0) + currentValue,
        justEvaluated: true,
      };
    });
  }, []);

  /**
   * Memory Subtract
   */
  const memorySubtract = useCallback(() => {
    setState((prev) => {
      const currentValue = parseFloat(prev.currentInput);
      if (isNaN(currentValue)) return prev;

      return {
        ...prev,
        memory: (prev.memory ?? 0) - currentValue,
        justEvaluated: true,
      };
    });
  }, []);

  /**
   * Handle button press - main dispatch function
   */
  const handleButtonPress = useCallback(
    (value: string) => {
      // Digits
      if (/^[0-9]$/.test(value)) {
        inputDigit(value);
        return;
      }

      switch (value) {
        // Decimal
        case '.':
          inputDecimal();
          break;

        // Operators
        case '+':
        case '\u2212': // Unicode minus
        case '−':
        case '-':
        case '\u00D7': // Unicode multiplication
        case '×':
        case '*':
        case '\u00F7': // Unicode division
        case '÷':
        case '/': {
          const op = mapOperator(value);
          if (op) inputOperator(op);
          break;
        }

        // Equals - async because it may check PIN
        case '=':
          evaluateExpression().catch(() => {
            // Error handling is done inside evaluateExpression
          });
          break;

        // Clear
        case 'C':
          clearAll();
          break;

        // Backspace
        case '\u232B': // Unicode backspace symbol
        case '⌫':
          backspace();
          break;

        // Percentage
        case '%':
          percentage();
          break;

        // Memory operations
        case 'MC':
          memoryClear();
          break;
        case 'MR':
          memoryRecall();
          break;
        case 'M+':
          memoryAdd();
          break;
        case 'M-':
          memorySubtract();
          break;

        default:
          // Unknown button, ignore
          break;
      }
    },
    [
      inputDigit,
      inputDecimal,
      inputOperator,
      evaluateExpression,
      clearAll,
      backspace,
      percentage,
      memoryClear,
      memoryRecall,
      memoryAdd,
      memorySubtract,
    ]
  );

  // Format display with thousands separators
  const formattedDisplay = useMemo(() => {
    return formatWithSeparators(state.currentInput);
  }, [state.currentInput]);

  return {
    display: formattedDisplay,
    expression: state.expression,
    memoryHasValue: state.memory !== null,
    handleButtonPress,
    rawInput: state.currentInput,
    history: state.history,
  };
}
