import { ParsedDoyString, ParsedYmdString } from '../types/time';

function parseNumber(number: number | string): number {
  return parseInt(`${number}`, 10);
}

/**
 * padBefore - function to pad leading 0s to a number
 *
 * @param {number} number - number to pad
 * @param {number} numOfZeroes - number of zeroes to pad
 * @return {string}
 */
function padBefore(number: number | string, numOfZeroes: number, shouldTruncate: boolean = true) {
  return `${[...Array(numOfZeroes).keys()].map(() => '0').join('')}${number}`.slice(
    -(shouldTruncate ? numOfZeroes : Math.max(numOfZeroes, `${number}`.length)),
  );
}

/**
 * padDoy - function to pad leading 0s for DOY format
 * Note: This should only be used for Earth based time types, e.g. SCET and ERT
 *
 * @param {number | string} dayNumber - the day of year
 * @return {string}
 */
function padDoy(dayNumber: number | string) {
  return padBefore(parseNumber(dayNumber), 3);
}

function getDOY(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.valueOf() - start.valueOf();
  const oneDay = 1000 * 60 * 60 * 24;
  return padDoy(Math.floor(diff / oneDay));
}

/**
 * Parses a date string (YYYY-MM-DDTHH:mm:ss) or DOY string (YYYY-DDDDTHH:mm:ss) into its separate components
 */
export function parseDoyOrYmdTime(dateString: string, numDecimals = 6): null | ParsedDoyString | ParsedYmdString {
  const matches = (dateString ?? '').match(
    new RegExp(
      `^(?<year>\\d{4})-(?:(?<month>(?:[0]?[0-9])|(?:[1][1-2]))-(?<day>(?:[0-2]?[0-9])|(?:[3][0-1]))|(?<doy>\\d{1,3}))(?:T(?<time>(?<hour>[0-9]|[0-2][0-9])(?::(?<min>[0-9]|(?:[0-5][0-9])))?(?::(?<sec>[0-9]|(?:[0-5][0-9]))(?<dec>\\.\\d{1,${numDecimals}})?)?)?)?$`,
      'i',
    ),
  );
  if (matches) {
    const msPerSecond = 1000;

    const { groups: { year, month, day, doy, time = '00:00:00', hour = '0', min = '0', sec = '0', dec = '.0' } = {} } =
      matches;

    const partialReturn = {
      hour: parseInt(hour),
      min: parseInt(min),
      ms: parseFloat((parseFloat(dec) * msPerSecond).toFixed(numDecimals)),
      sec: parseInt(sec),
      time: time,
      year: parseInt(year),
    };

    if (doy !== undefined) {
      return {
        ...partialReturn,
        doy: parseInt(doy),
      };
    }

    return {
      ...partialReturn,
      day: parseInt(day),
      month: parseInt(month),
    };
  }

  return null;
}

export function convertDateToDoy(dateString: string, numDecimals = 6): string | null {
  const parsedTime = parseDoyOrYmdTime(dateString, numDecimals);

  if (parsedTime) {
    if ((parsedTime as ParsedDoyString).doy) {
      return dateString;
    }

    const { year, month, day, time } = parsedTime as ParsedYmdString;
    return `${year}-${getDOY(new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)))}T${time}`;
  }

  return null;
}

function convertDoyToYmd(doyString: string, numDecimals = 6, includeMsecs = true): string | null {
  const parsedDoy: ParsedDoyString = parseDoyOrYmdTime(doyString, numDecimals) as ParsedDoyString;

  if (parsedDoy !== null) {
    if (parsedDoy.doy !== undefined) {
      const date = new Date(parsedDoy.year, 0, parsedDoy.doy);
      const ymdString = `${[
        date.getFullYear(),
        padBefore(`${date.getUTCMonth() + 1}`, 2),
        padBefore(`${date.getUTCDate()}`, 2),
      ].join('-')}T${parsedDoy.time}`;
      if (includeMsecs) {
        return `${ymdString}Z`;
      }
      return `${ymdString.replace(/(\.\d+)/, '')}Z`;
    } else {
      // doyString is already in ymd format
      return `${doyString}Z`;
    }
  }

  return null;
}

export function getTimeDifference(dateString1: string, dateString2: string, numDecimals = 6): number | null {
  const dateString = convertDoyToYmd(dateString1, numDecimals, true);
  const nextDateString = convertDoyToYmd(dateString2, numDecimals, true);

  if (dateString && nextDateString) {
    const date = new Date(dateString);
    const nextDate = new Date(nextDateString);

    return Math.abs(date.getTime() * 1000 - nextDate.getTime() * 1000);
  }
  return null;
}
