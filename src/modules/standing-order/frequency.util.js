/**
 * Advance a date by one occurrence of the given frequency.
 * Shared between standing-order.service.js (computing the
 * first nextRunAt) and scheduler.service.js (advancing after
 * each executed occurrence).
 */
const advance = (date, frequency) => {

    const next = new Date(date);

    if (frequency === "DAILY") {

        next.setDate(next.getDate() + 1);

    } else if (frequency === "WEEKLY") {

        next.setDate(next.getDate() + 7);

    } else if (frequency === "MONTHLY") {

        next.setMonth(next.getMonth() + 1);

    }

    return next;

};

module.exports = { advance };
