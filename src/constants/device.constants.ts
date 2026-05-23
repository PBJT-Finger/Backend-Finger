/**
 * src/constants/device.constants.ts
 *
 * Named constants for ZKTeco device communication parameters.
 *
 * Why constants instead of inline values:
 *   - Avoids magic numbers scattered across the codebase
 *   - Makes it easy to tune timing per environment without a code search
 *   - These serve as fallback defaults if env vars are not provided
 */

/** Default interval between ZK device polling cycles (5 seconds). */
export const DEFAULT_POLLING_INTERVAL_MS = 5_000;

/**
 * Default delay before reconnect attempt after a failed poll cycle.
 * 8 seconds avoids tight-loop flooding if the device is temporarily unreachable.
 */
export const DEFAULT_RECONNECT_DELAY_MS = 8_000;

/**
 * Default socket connection timeout.
 * ZKTeco devices on LAN typically respond in <1s; 10s allows for network hiccups.
 */
export const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

/**
 * Internal ZKLib in-port timeout.
 * Lower than connection timeout to prevent blocking the poll cycle on partial reads.
 */
export const DEFAULT_IN_PORT_TIMEOUT_MS = 4_000;
