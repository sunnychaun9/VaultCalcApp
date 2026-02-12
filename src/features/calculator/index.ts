/**
 * VaultCalc - Calculator Feature Module
 *
 * Public exports for the calculator feature.
 */

// Screens
export { CalculatorScreen } from './screens';

// Components (for composition if needed)
export { CalcButton, CalcDisplay, CalcKeypad } from './components';
export type { ButtonType } from './components';

// Hooks
export { useCalculator } from './hooks';
export type { UseCalculatorReturn } from './hooks';

// Utils (for testing and PIN detection)
export {
  evaluate,
  formatDisplay,
  formatWithSeparators,
  mapOperator,
} from './utils';
export type { Operator } from './utils';
