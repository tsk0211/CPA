/// Converts a locally-picked calendar date into a UTC instant safe to send
/// to the server — the very start of [localDate]'s local day.
///
/// `showDateRangePicker` returns local-timezone DateTimes at local midnight.
/// Sending those straight through with `.toIso8601String()` produces a
/// naive string with no 'Z'/offset, which a server in a different timezone
/// (e.g. Render's UTC) then misinterprets as its own local midnight —
/// silently shifting the whole range by the offset between the two (5.5
/// hours for India). Converting to a real UTC instant first closes that gap
/// regardless of where either side is running.
DateTime startOfLocalDayUtc(DateTime localDate) => DateTime(localDate.year, localDate.month, localDate.day).toUtc();

/// Same as [startOfLocalDayUtc], but the last instant of [localDate]'s local
/// day (23:59:59.999) rather than its first — a date range's "to" bound
/// needs this so the whole end day is actually included. Using the picker's
/// raw local-midnight value as an inclusive upper bound would exclude
/// nearly the entire end day.
DateTime endOfLocalDayUtc(DateTime localDate) =>
    DateTime(localDate.year, localDate.month, localDate.day, 23, 59, 59, 999).toUtc();
