"use strict";

const { splitByDividors } = require("./math");

exports.minutes = (count) => count * 60;

exports.hours = (count) => count * exports.minutes(60);

exports.days = (count) => count * exports.hours(24);

exports.weeks = (count) => count * exports.days(7);

exports.months = (count) => count * exports.days(30);

exports.years = (count) => count * exports.months(12);

const _minute = exports.minutes(1);
const _hour = exports.hours(1);
const _day = exports.days(1);
const _month = exports.months(1);
const _year = exports.years(1);

exports.intervals = {
  minute: _minute,
  hour: _hour,
  day: _day,
  month: _month,
  year: _year,
};

exports.formatDuration = (duration) => {
  const [years, months, days, hours, minutes, seconds] = splitByDividors(duration, [
    _year,
    _month,
    _day,
    _hour,
    _minute,
  ]);

  let str = "";
  if (years > 0) str += `${years} years `;
  if (months > 0) str += `${months} months `;
  if (days > 0) str += `${days} days `;
  if (hours > 0) str += `${hours} hours `;
  if (minutes > 0) str += `${minutes} minutes `;
  if (seconds > 0) str += `${seconds} seconds`;

  return str.trimEnd();
};
