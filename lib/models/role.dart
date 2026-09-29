enum Role {
  owner,
  admin,
  analyst,
  member;

  static Role parse(String raw) => Role.values.firstWhere((r) => r.name == raw, orElse: () => Role.member);

  String get label => switch (this) {
        Role.owner => "Owner",
        Role.admin => "Admin",
        Role.analyst => "Analyst",
        Role.member => "Member",
      };

  bool get canManageProjects => this == Role.owner || this == Role.admin;
  bool get canEditPurchases => this == Role.owner || this == Role.admin;
  bool get canAddPurchases => this == Role.owner || this == Role.admin || this == Role.member;
  bool get canExport => this == Role.owner || this == Role.admin || this == Role.analyst;
  bool get canSeeActivityLog => this == Role.owner || this == Role.admin || this == Role.analyst;
  bool get canManageUsers => this == Role.owner || this == Role.admin;
  // Same people who can already edit/delete a purchase outright — reviewing
  // is just the first decision they make on a Member's pending entry.
  bool get canReviewPurchases => this == Role.owner || this == Role.admin;
}
