import '../models/paged.dart';
import '../models/role.dart';
import '../models/user.dart';
import 'api_client.dart';

class UsersApi {
  final ApiClient client;
  UsersApi(this.client);

  Future<Paged<TeamMember>> list({int page = 1, int limit = 20, String? search}) async {
    final json = await client.get("/users", query: {
      "page": "$page",
      "limit": "$limit",
      if (search != null && search.isNotEmpty) "search": search,
    });
    return Paged.fromJson(json, TeamMember.fromJson);
  }

  Future<void> create({required String name, required String email, required String tempPassword, required Role role}) {
    return client.post("/users", {"name": name, "email": email, "tempPassword": tempPassword, "role": role.name});
  }

  Future<void> changeRole(String userId, Role role) => client.patch("/users/$userId/role", {"role": role.name});

  Future<void> deactivate(String userId) => client.delete("/users/$userId");
}
