function isWithinAccessHours(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.TIMEZONE || 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' });
  const hour = Number(formatter.format(date));
  return hour >= Number(process.env.ACCESS_START_HOUR || 7) && hour < Number(process.env.ACCESS_END_HOUR || 21);
}
module.exports = { isWithinAccessHours };
