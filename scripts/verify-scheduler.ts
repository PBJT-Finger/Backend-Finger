/**
 * scripts/verify-scheduler.ts
 *
 * Verification script to test calendar scheduler calculations and shift schedules.
 * Ensures leap years from 2026 to 2088, month transitions (especially on the first of the month),
 * and shift windows are correct and robust.
 *
 * Run using: npx tsx scripts/verify-scheduler.ts
 */

import {
  isLeapYear,
  getDaysInYear,
  getDaysInMonth,
  getPreviousMonth,
  getLocalMonthBoundaries,
  generateMonthlySchedule,
  verifyScanAgainstShift,
  SHIFT_SCHEDULES,
} from '../src/utils/calendarScheduler';

// ─── TEST RUNNER UTILS ────────────────────────────────────────────────────────

let testsRun = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  testsRun++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function runTestSuite(suiteName: string, suiteFn: () => void): void {
  console.log(`\n==================================================`);
  console.log(`🏃 Running Suite: ${suiteName}`);
  console.log(`==================================================`);
  suiteFn();
}

// ─── 1. LEAP YEARS AND DAYS IN YEAR SUITE ────────────────────────────────────

runTestSuite('Leap Years (2026 - 2088)', () => {
  // Check specific standard years
  assert(!isLeapYear(2026), '2026 should NOT be a leap year');
  assert(getDaysInYear(2026) === 365, '2026 should have 365 days');

  assert(!isLeapYear(2027), '2027 should NOT be a leap year');
  assert(getDaysInYear(2027) === 365, '2027 should have 365 days');

  assert(isLeapYear(2028), '2028 should be a leap year');
  assert(getDaysInYear(2028) === 366, '2028 should have 366 days');

  // Verify leap year pattern all the way to 2088
  const leapYears: number[] = [];
  const nonLeapYears: number[] = [];

  for (let year = 2026; year <= 2088; year++) {
    if (isLeapYear(year)) {
      leapYears.push(year);
    } else {
      nonLeapYears.push(year);
    }
  }

  // Ensure 2088 is in leap years
  assert(leapYears.includes(2088), '2088 should be identified as a leap year');
  assert(getDaysInYear(2088) === 366, '2088 should have 366 days');

  // Check divisible by 4 rule inside our range
  const expectedLeapCount = Math.floor((2088 - 2028) / 4) + 1; // 2028, 2032, ..., 2088
  assert(
    leapYears.length === expectedLeapCount,
    `Should find exactly ${expectedLeapCount} leap years between 2026 and 2088 (found ${leapYears.length})`
  );

  // Validate days in February for leap vs non-leap
  assert(getDaysInMonth(2026, 2) === 28, 'Feb 2026 should have 28 days');
  assert(getDaysInMonth(2028, 2) === 29, 'Feb 2028 (leap) should have 29 days');
  assert(getDaysInMonth(2088, 2) === 29, 'Feb 2088 (leap) should have 29 days');
});

// ─── 2. MONTH BOUNDARY & FIRST DAY SUITE ──────────────────────────────────────

runTestSuite('Month Boundary Calculations (First Day Verification)', () => {
  // Test case: Current date is June 1st, 2026. Verification wants the previous month (May 2026).
  const prevJune = getPreviousMonth(2026, 6);
  assert(
    prevJune.year === 2026 && prevJune.month === 5,
    'getPreviousMonth of June 2026 should be May 2026'
  );
  assert(getDaysInMonth(prevJune.year, prevJune.month) === 31, 'May should have 31 days');

  // Test case: Current date is Jan 1st, 2026. Verification rolls back to Dec 2025.
  const prevJan = getPreviousMonth(2026, 1);
  assert(
    prevJan.year === 2025 && prevJan.month === 12,
    'getPreviousMonth of Jan 2026 should be Dec 2025'
  );
  assert(getDaysInMonth(prevJan.year, prevJan.month) === 31, 'Dec should have 31 days');

  // Test case: Current date is March 1st, 2028 (Leap Year). Verification rolls back to Feb 2028.
  const prevMarchLeap = getPreviousMonth(2028, 3);
  assert(
    prevMarchLeap.year === 2028 && prevMarchLeap.month === 2,
    'getPreviousMonth of March 2028 should be Feb 2028'
  );
  assert(
    getDaysInMonth(prevMarchLeap.year, prevMarchLeap.month) === 29,
    'Feb 2028 should have 29 days'
  );

  // Test getLocalMonthBoundaries timezone-safety
  const boundaries = getLocalMonthBoundaries(2026, 2); // February 2026 (non-leap)
  assert(
    boundaries.start.getFullYear() === 2026 &&
      boundaries.start.getMonth() === 1 && // 0-indexed
      boundaries.start.getDate() === 1,
    'Feb 2026 start boundary should begin on February 1st'
  );
  assert(
    boundaries.end.getFullYear() === 2026 &&
      boundaries.end.getMonth() === 1 &&
      boundaries.end.getDate() === 28,
    'Feb 2026 end boundary should end on February 28th'
  );

  // Leap Year boundaries
  const boundariesLeap = getLocalMonthBoundaries(2028, 2); // February 2028 (leap)
  assert(
    boundariesLeap.end.getDate() === 29,
    'Feb 2028 end boundary should end on February 29th'
  );
});

// ─── 3. SHIFT VERIFICATION SUITE ──────────────────────────────────────────────

runTestSuite('Shift Verification (Morning vs Afternoon)', () => {
  // Morning Shift:
  // arrivalStart: '07:00:00', arrivalEnd: '08:00:00'
  // departureStart: '16:00:00', departureEnd: '17:00:00'

  // Afternoon Shift:
  // arrivalStart: '13:00:00', arrivalEnd: '14:00:00'
  // departureStart: '21:00:00', departureEnd: '22:00:00'

  // Test Morning Shift Scan
  const morningOnTimeArrival = new Date(2026, 4, 20, 7, 30, 0); // 07:30:00
  const resultMorningArrival = verifyScanAgainstShift(morningOnTimeArrival, 'MORNING', true);
  assert(
    resultMorningArrival.isWithinArrivalWindow,
    '07:30 should be within Morning arrival window'
  );
  assert(!resultMorningArrival.isLate, '07:30 should NOT be late for Morning shift');

  const morningLateArrival = new Date(2026, 4, 20, 8, 15, 0); // 08:15:00
  const resultMorningLate = verifyScanAgainstShift(morningLateArrival, 'MORNING', true);
  assert(!resultMorningLate.isWithinArrivalWindow, '08:15 should be outside Morning arrival window');
  assert(resultMorningLate.isLate, '08:15 should be marked as LATE');
  assert(resultMorningLate.minutesLate === 15, '08:15 should be 15 minutes late');

  const morningOnTimeDeparture = new Date(2026, 4, 20, 16, 45, 0); // 16:45:00
  const resultMorningDeparture = verifyScanAgainstShift(morningOnTimeDeparture, 'MORNING', false);
  assert(
    resultMorningDeparture.isWithinDepartureWindow,
    '16:45 should be within Morning departure window'
  );
  assert(!resultMorningDeparture.isEarlyDeparture, '16:45 should NOT be early departure');

  const morningEarlyDeparture = new Date(2026, 4, 20, 15, 45, 0); // 15:45:00
  const resultMorningEarlyDep = verifyScanAgainstShift(morningEarlyDeparture, 'MORNING', false);
  assert(
    !resultMorningEarlyDep.isWithinDepartureWindow,
    '15:45 should be outside Morning departure window'
  );
  assert(resultMorningEarlyDep.isEarlyDeparture, '15:45 should be marked as early departure');
  assert(resultMorningEarlyDep.minutesEarlyDeparture === 15, '15:45 should be 15 minutes early');

  // Test Afternoon Shift Scan
  const afternoonOnTimeArrival = new Date(2026, 4, 20, 13, 30, 0); // 13:30:00
  const resultAfternoonArrival = verifyScanAgainstShift(afternoonOnTimeArrival, 'AFTERNOON', true);
  assert(
    resultAfternoonArrival.isWithinArrivalWindow,
    '13:30 should be within Afternoon arrival window'
  );
  assert(!resultAfternoonArrival.isLate, '13:30 should NOT be late for Afternoon shift');

  const afternoonLateArrival = new Date(2026, 4, 20, 14, 20, 0); // 14:20:00
  const resultAfternoonLate = verifyScanAgainstShift(afternoonLateArrival, 'AFTERNOON', true);
  assert(
    !resultAfternoonLate.isWithinArrivalWindow,
    '14:20 should be outside Afternoon arrival window'
  );
  assert(resultAfternoonLate.isLate, '14:20 should be marked as LATE');
  assert(resultAfternoonLate.minutesLate === 20, '14:20 should be 20 minutes late');

  const afternoonOnTimeDeparture = new Date(2026, 4, 20, 21, 30, 0); // 21:30:00
  const resultAfternoonDeparture = verifyScanAgainstShift(afternoonOnTimeDeparture, 'AFTERNOON', false);
  assert(
    resultAfternoonDeparture.isWithinDepartureWindow,
    '21:30 should be within Afternoon departure window'
  );

  const afternoonEarlyDeparture = new Date(2026, 4, 20, 20, 50, 0); // 20:50:00
  const resultAfternoonEarlyDep = verifyScanAgainstShift(afternoonEarlyDeparture, 'AFTERNOON', false);
  assert(resultAfternoonEarlyDep.isEarlyDeparture, '20:50 should be marked as early departure');
  assert(resultAfternoonEarlyDep.minutesEarlyDeparture === 10, '20:50 should be 10 minutes early');
});

// ─── 4. MONTHLY SCHEDULE GRID GENERATION ─────────────────────────────────────

runTestSuite('Monthly Schedule Grid Generation', () => {
  const feb2028Morning = generateMonthlySchedule(2028, 2, 'MORNING');
  assert(
    feb2028Morning.length === 29,
    'February 2028 schedule should generate exactly 29 day entries'
  );

  const workingDays = feb2028Morning.filter((day) => day.isWorkingDay);
  // February 2028 starts on Tuesday (1st), ends on Wednesday (29th). Sundays: Feb 6, 13, 20, 27 (4 Sundays).
  // Total working days = 29 - 4 = 25.
  assert(
    workingDays.length === 25,
    `February 2028 should have 25 working days excluding Sundays (found ${workingDays.length})`
  );

  // Check Saturday (Feb 5, 2028 is a Saturday)
  const feb5 = feb2028Morning.find((day) => day.dateString === '2028-02-05');
  assert(feb5 !== undefined, 'Should find schedule for Feb 5th');
  assert(feb5?.dayOfWeek === 6, 'Feb 5th, 2028 should be Saturday (dayOfWeek = 6)');
  assert(feb5?.isWorkingDay === true, 'Saturday should be a working day by default');

  // Check Sunday (Feb 6, 2028 is a Sunday)
  const feb6 = feb2028Morning.find((day) => day.dateString === '2028-02-06');
  assert(feb6?.dayOfWeek === 0, 'Feb 6th, 2028 should be Sunday (dayOfWeek = 0)');
  assert(feb6?.isWorkingDay === false, 'Sunday should NOT be a working day by default');
});

// ─── FINAL STATS ──────────────────────────────────────────────────────────────

console.log(`\n==================================================`);
console.log(`🏁 Verification Finished`);
console.log(`   Total tests run: ${testsRun}`);
console.log(`   Passed: ${testsRun - testsFailed}`);
console.log(`   Failed: ${testsFailed}`);
console.log(`==================================================`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All scheduler and calendar calculations are 100% correct!');
  process.exit(0);
}
