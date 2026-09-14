import 'package:flutter/widgets.dart';

/// One shared width threshold for "wide enough to be a desktop layout"
/// (side nav rail, data tables) vs. phone/narrow-tablet (bottom nav,
/// scrolling list tiles) — every screen that branches on layout checks the
/// same number, so the app doesn't end up with several slightly different
/// breakpoints drifting apart over time.
const double desktopBreakpoint = 900;

bool isDesktop(BuildContext context) => MediaQuery.sizeOf(context).width >= desktopBreakpoint;
