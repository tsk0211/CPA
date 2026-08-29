class Paged<T> {
  final List<T> items;
  final int page;
  final int limit;
  final int total;
  final bool hasMore;

  Paged({required this.items, required this.page, required this.limit, required this.total, required this.hasMore});

  factory Paged.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) itemParser) {
    return Paged(
      items: (json["items"] as List).map((e) => itemParser(e as Map<String, dynamic>)).toList(),
      page: json["page"] as int,
      limit: json["limit"] as int,
      total: json["total"] as int,
      hasMore: json["hasMore"] as bool,
    );
  }
}
