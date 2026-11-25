/*
 *    Copyright [2007-2025] [wisemapping]
 *
 *   Licensed under WiseMapping Public License, Version 1.0 (the "License").
 *   It is basically the Apache License, Version 2.0 (the "License") plus the
 *   "powered by wisemapping" text requirement on every single page;
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the license at
 *
 *       https://github.com/wisemapping/wisemapping-open-source/blob/main/LICENSE.md
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { useEffect, useRef, useState } from 'react';

interface SpringOptions {
  /** Time to settle in seconds (Apple's "response", default 0.32s). */
  response?: number;
  /** Damping ratio (1.0 = critically damped, no overshoot). */
  dampingRatio?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Interruptible critically-damped spring driver (Apple Design §§3-4).
 * Retargeting mid-flight continues from the live on-screen value and velocity
 * with zero velocity discontinuity, and snaps immediately under reduced motion.
 */
export const useSpringValue = (
  target: number,
  { response = 0.32, dampingRatio = 1.0 }: SpringOptions = {},
): number => {
  const [value, setValue] = useState<number>(target);
  const currentRef = useRef<number>(target);
  const velocityRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (
      reduced ||
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      currentRef.current = target;
      velocityRef.current = 0;
      return undefined;
    }

    const omega = (2 * Math.PI) / response;
    const stiffness = omega * omega;
    const damping = 2 * dampingRatio * omega;
    let lastTime = performance.now();

    const step = (now: number): void => {
      const dt = Math.min((now - lastTime) / 1000, 0.032);
      lastTime = now;

      const displacement = currentRef.current - target;
      const acceleration = -stiffness * displacement - damping * velocityRef.current;

      velocityRef.current += acceleration * dt;
      currentRef.current += velocityRef.current * dt;

      if (Math.abs(currentRef.current - target) < 0.35 && Math.abs(velocityRef.current) < 0.5) {
        currentRef.current = target;
        velocityRef.current = 0;
        setValue(target);
        rafRef.current = null;
        return;
      }

      setValue(currentRef.current);
      rafRef.current = window.requestAnimationFrame(step);
    };

    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, response, dampingRatio, reduced]);

  return reduced ? target : value;
};
