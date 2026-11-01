resource "github_repository" "project" {
  name        = var.repository_name
  description = var.repository_description
  visibility  = var.repository_visibility

  auto_init = true
}
