class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? code;

  ApiException(this.statusCode, this.message, {this.code});

  @override
  String toString() => message;
}

/// Thrown by ApiClient when a request fails because there's no network
/// path to the server at all (not a server-side error response) — the
/// signal the offline queue uses to decide "queue this locally" instead of
/// "show the user an error."
class NetworkUnavailableException implements Exception {}
