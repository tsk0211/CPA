/// Single copy of the "can't reach the server" message, so every catch site
/// for `NetworkUnavailableException` (which carries no message of its own)
/// shows the same wording instead of a slightly different hand-typed string.
const String networkUnavailableMessage = "Can't reach the server. Check your connection and try again.";
