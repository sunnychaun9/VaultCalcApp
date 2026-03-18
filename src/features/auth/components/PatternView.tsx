/**
 * VaultCalc - Premium Pattern Lock View Component
 *
 * A 3x3 grid pattern lock with smooth gesture tracking and premium visuals.
 * Uses pure React Native views for line rendering with glow effects.
 *
 * Features:
 * - Touch gesture tracking with PanResponder
 * - Glowing lines between selected dots
 * - Node scale-up animation on selection
 * - State-based coloring (accent/success/error)
 * - Outer ring pulse effect on selected dots
 * - Haptic feedback on dot selection
 *
 * @see AUTH-009, AUTH-010 Premium Lock UI
 */

import React, { useCallback, useRef, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Vibration,
  type LayoutChangeEvent,
} from 'react-native';
import { useSettingsStore } from '@store/settingsStore';

/** Grid dimensions */
const GRID_SIZE = 3;

/** Dot sizing — premium larger dots */
const DOT_SIZE = 18;
const SELECTED_DOT_SIZE = 22;
const OUTER_RING_SIZE = 52;
const DOT_HIT_RADIUS = 44;

/** Line thickness */
const LINE_THICKNESS = 3;
const LINE_GLOW_THICKNESS = 10;

/** Colors for dark lock screen */
const ACCENT = '#3B82F6';
const SUCCESS = '#22C55E';
const ERROR = '#EF4444';
const DOT_IDLE = 'rgba(148, 163, 184, 0.5)';

/** Pattern state for visual feedback */
export type PatternState = 'idle' | 'drawing' | 'success' | 'error';

interface PatternViewProps {
  pattern: number[];
  onPatternChange: (pattern: number[]) => void;
  onPatternComplete: (pattern: number[]) => void;
  state?: PatternState;
  showPath?: boolean;
  disabled?: boolean;
}

interface DotPosition {
  x: number;
  y: number;
  index: number;
}

function getStateColor(state: PatternState): string {
  switch (state) {
    case 'success': return SUCCESS;
    case 'error': return ERROR;
    default: return ACCENT;
  }
}

/**
 * Compute style for a line between two points with glow effect.
 */
function getLineStyle(
  x1: number, y1: number, x2: number, y2: number,
  color: string, opacity: number, thickness: number = LINE_THICKNESS,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    position: 'absolute' as const,
    left: x1,
    top: y1 - thickness / 2,
    width: length,
    height: thickness,
    backgroundColor: color,
    borderRadius: thickness / 2,
    opacity,
    transform: [{ rotate: `${angle}deg` }],
    transformOrigin: `0px ${thickness / 2}px`,
  };
}

export function PatternView({
  pattern,
  onPatternChange,
  onPatternComplete,
  state = 'idle',
  showPath = true,
  disabled = false,
}: PatternViewProps): React.JSX.Element {
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);

  const containerRef = useRef<View>(null);
  const containerLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dotPositions = useRef<DotPosition[]>([]);
  const currentPattern = useRef<number[]>([]);
  const currentTouchPos = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  const [renderTick, setRenderTick] = useState(0);
  const forceRender = useCallback(() => setRenderTick(t => t + 1), []);

  const calculateDotPositions = useCallback(() => {
    const { width, height } = containerLayout.current;
    if (width === 0 || height === 0) return;

    const size = Math.min(width, height);
    const padding = size * 0.12;
    const usableSize = size - 2 * padding;
    const dotSpacing = usableSize / (GRID_SIZE - 1);

    const offsetX = (width - size) / 2 + padding;
    const offsetY = (height - size) / 2 + padding;

    const positions: DotPosition[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        positions.push({
          x: offsetX + col * dotSpacing,
          y: offsetY + row * dotSpacing,
          index: row * GRID_SIZE + col,
        });
      }
    }
    dotPositions.current = positions;
    forceRender();
  }, [forceRender]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      containerRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        containerLayout.current = {
          x: pageX ?? 0,
          y: pageY ?? 0,
          width: w ?? width,
          height: h ?? height,
        };
        calculateDotPositions();
      });
    },
    [calculateDotPositions]
  );

  const findNearestDot = useCallback(
    (touchX: number, touchY: number): number | null => {
      const localX = touchX - containerLayout.current.x;
      const localY = touchY - containerLayout.current.y;

      for (const dot of dotPositions.current) {
        const dx = localX - dot.x;
        const dy = localY - dot.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= DOT_HIT_RADIUS) {
          return dot.index;
        }
      }
      return null;
    },
    []
  );

  const addDot = useCallback(
    (index: number) => {
      if (currentPattern.current.includes(index)) return;

      currentPattern.current = [...currentPattern.current, index];
      onPatternChange(currentPattern.current);

      if (hapticEnabled) {
        Vibration.vibrate(8);
      }

      forceRender();
    },
    [onPatternChange, hapticEnabled, forceRender]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt) => {
          containerRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
            containerLayout.current = {
              x: pageX ?? containerLayout.current.x,
              y: pageY ?? containerLayout.current.y,
              width: w ?? containerLayout.current.width,
              height: h ?? containerLayout.current.height,
            };
          });

          isDrawing.current = true;
          currentPattern.current = [];
          onPatternChange([]);

          const { pageX, pageY } = evt.nativeEvent;
          currentTouchPos.current = {
            x: pageX - containerLayout.current.x,
            y: pageY - containerLayout.current.y,
          };

          const dotIndex = findNearestDot(pageX, pageY);
          if (dotIndex !== null) {
            addDot(dotIndex);
          }

          forceRender();
        },
        onPanResponderMove: (evt) => {
          if (!isDrawing.current) return;

          const { pageX, pageY } = evt.nativeEvent;
          currentTouchPos.current = {
            x: pageX - containerLayout.current.x,
            y: pageY - containerLayout.current.y,
          };

          const dotIndex = findNearestDot(pageX, pageY);
          if (dotIndex !== null) {
            addDot(dotIndex);
          }

          forceRender();
        },
        onPanResponderRelease: () => {
          isDrawing.current = false;
          currentTouchPos.current = null;

          if (currentPattern.current.length > 0) {
            onPatternComplete(currentPattern.current);
          }

          forceRender();
        },
        onPanResponderTerminate: () => {
          isDrawing.current = false;
          currentTouchPos.current = null;
          forceRender();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, onPatternChange, onPatternComplete, findNearestDot, addDot, forceRender]
  );

  const stateColor = getStateColor(state);
  const dots = dotPositions.current;

  // Suppress unused variable warning
  void renderTick;

  return (
    <View
      ref={containerRef}
      style={styles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {/* Glow lines (behind main lines) */}
      {showPath &&
        pattern.map((dotIndex, i) => {
          if (i === 0) return null;
          const prevDot = dots[pattern[i - 1]];
          const curDot = dots[dotIndex];
          if (!prevDot || !curDot) return null;
          return (
            <View
              key={`glow-${i}`}
              style={getLineStyle(
                prevDot.x, prevDot.y, curDot.x, curDot.y,
                stateColor, 0.2, LINE_GLOW_THICKNESS
              )}
            />
          );
        })}

      {/* Main lines between selected dots */}
      {showPath &&
        pattern.map((dotIndex, i) => {
          if (i === 0) return null;
          const prevDot = dots[pattern[i - 1]];
          const curDot = dots[dotIndex];
          if (!prevDot || !curDot) return null;
          return (
            <View
              key={`line-${i}`}
              style={getLineStyle(prevDot.x, prevDot.y, curDot.x, curDot.y, stateColor, 0.85)}
            />
          );
        })}

      {/* Active line from last dot to current touch */}
      {showPath &&
        isDrawing.current &&
        currentTouchPos.current &&
        pattern.length > 0 &&
        (() => {
          const lastDot = dots[pattern[pattern.length - 1]];
          if (!lastDot) return null;
          return (
            <View
              style={getLineStyle(
                lastDot.x, lastDot.y,
                currentTouchPos.current!.x, currentTouchPos.current!.y,
                stateColor, 0.35, 2
              )}
            />
          );
        })()}

      {/* Dots */}
      {dots.map((dot) => {
        const isSelected = pattern.includes(dot.index);
        const dotSize = isSelected ? SELECTED_DOT_SIZE : DOT_SIZE;
        return (
          <View key={`dot-${dot.index}`}>
            {/* Outer glow ring for selected dots */}
            {isSelected && (
              <View
                style={[
                  styles.outerRing,
                  {
                    left: dot.x - OUTER_RING_SIZE / 2,
                    top: dot.y - OUTER_RING_SIZE / 2,
                    borderColor: stateColor,
                  },
                ]}
              />
            )}
            {/* Inner glow for selected dots */}
            {isSelected && (
              <View
                style={[
                  styles.innerGlow,
                  {
                    left: dot.x - 18,
                    top: dot.y - 18,
                    backgroundColor: stateColor,
                  },
                ]}
              />
            )}
            {/* Main dot */}
            <View
              style={[
                styles.dot,
                {
                  left: dot.x - dotSize / 2,
                  top: dot.y - dotSize / 2,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: isSelected ? stateColor : DOT_IDLE,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 300,
    maxHeight: 300,
    alignSelf: 'center',
  },
  dot: {
    position: 'absolute',
  },
  outerRing: {
    position: 'absolute',
    width: OUTER_RING_SIZE,
    height: OUTER_RING_SIZE,
    borderRadius: OUTER_RING_SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  innerGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.12,
  },
});
