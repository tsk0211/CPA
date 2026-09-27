import '../models/paged.dart';
import '../models/project.dart';
import 'api_client.dart';

class ProjectsApi {
  final ApiClient client;
  ProjectsApi(this.client);

  Future<Paged<Project>> list({int page = 1, int limit = 20, String? search}) async {
    final json = await client.get("/projects", query: {
      "page": "$page",
      "limit": "$limit",
      if (search != null && search.isNotEmpty) "search": search,
    });
    return Paged.fromJson(json, Project.fromJson);
  }

  Future<Project> get(String id) async {
    final json = await client.get("/projects/$id");
    return Project.fromJson(json);
  }

  Future<Project> create(String name, String icon) async {
    final json = await client.post("/projects", {"name": name, "icon": icon});
    return Project.fromJson(json);
  }

  Future<Project> update(String id, String name, String icon, {double? autoApproveThreshold}) async {
    final json = await client.patch("/projects/$id", {
      "name": name,
      "icon": icon,
      if (autoApproveThreshold != null) "autoApproveThreshold": autoApproveThreshold,
    });
    return Project.fromJson(json);
  }

  Future<void> delete(String id) => client.delete("/projects/$id");
}
