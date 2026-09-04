import 'package:flutter/material.dart';

/// Standard padding for the root of a modal bottom sheet's content.
///
/// `viewInsets.bottom` covers the keyboard; `padding.bottom` covers the
/// safe area (home indicator / gesture bar) when the keyboard is closed —
/// without the latter, a sheet's bottom button sits flush against, or
/// behind, that system inset on gesture-nav phones.
EdgeInsets sheetPadding(BuildContext context) {
  return EdgeInsets.only(
    left: 16,
    right: 16,
    top: 16,
    bottom: MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 16,
  );
}
