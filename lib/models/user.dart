import 'role.dart';

class AppUser {
  final String id;
  final String name;
  final String email;
  final Role role;
  final bool mustChangePassword;

  AppUser({required this.id, required this.name, required this.email, required this.role, required this.mustChangePassword});

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json["id"] as String,
        name: json["name"] as String,
        email: json["email"] as String,
        role: Role.parse(json["role"] as String),
        mustChangePassword: json["mustChangePassword"] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        "id": id,
        "name": name,
        "email": email,
        "role": role.name,
        "mustChangePassword": mustChangePassword,
      };
}

class TeamMember {
  final String id;
  final String name;
  final String email;
  final Role role;

  TeamMember({required this.id, required this.name, required this.email, required this.role});

  factory TeamMember.fromJson(Map<String, dynamic> json) => TeamMember(
        id: json["_id"] as String,
        name: json["name"] as String,
        email: json["email"] as String,
        role: Role.parse(json["role"] as String),
      );
}
