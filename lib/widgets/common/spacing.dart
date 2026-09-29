/// Shared spacing scale — codifies the gaps already used ad hoc across
/// screens so new/touched code has one set of numbers to reach for instead
/// of inventing another `SizedBox(height: 14)`.
class Spacing {
  Spacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

/// Corner radii already in use in `theme.dart` (inputs/buttons = md, cards =
/// lg) — kept here too so new widgets outside theme.dart match without
/// re-deriving the numbers.
class Corners {
  Corners._();

  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
}
