import 'package:flutter/material.dart';

import '../breakpoints.dart';

/// Shows [builder]'s content as a mobile-style bottom sheet on narrow
/// screens (unchanged behavior), or a properly centered, width-constrained
/// dialog on desktop.
///
/// `showModalBottomSheet` on its own is a phone pattern — full-width, edge
/// anchored, with a drag handle — and on a wide desktop window it ends up
/// stranded in the middle of the screen with no real backdrop behind it,
/// looking broken rather than like a deliberate dialog. Desktop gets an
/// actual `Dialog` instead, which brings back a proper dimmed barrier and a
/// sensible content width.
Future<T?> showAdaptiveSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  double desktopMaxWidth = 480,
}) {
  if (isDesktop(context)) {
    return showDialog<T>(
      context: context,
      builder: (context) => Dialog(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: desktopMaxWidth),
          child: builder(context),
        ),
      ),
    );
  }
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    builder: builder,
  );
}
