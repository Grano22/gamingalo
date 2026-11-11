resource "github_repository" "project" {
  name        = var.repository_name
  description = var.repository_description
  visibility  = var.repository_visibility

  auto_init = true
}

# The docs site is built and deployed by .github/workflows/docs.yml.
resource "github_repository_pages" "docs" {
  repository = github_repository.project.name
  build_type = "workflow"
}

import {
  to = github_repository_pages.docs
  id = var.repository_name
}

# The release workflow publishes to npm from this environment. Its NPM_TOKEN secret is set by hand
# in the repository settings, so it never reaches the state file.
resource "github_repository_environment" "release" {
  repository  = github_repository.project.name
  environment = "release"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

import {
  to = github_repository_environment.release
  id = "${var.repository_name}:release"
}

# Only release tags, such as sdk-v0.14.0, may deploy to the release environment and read its
# secrets. A branch or a pull request can't.
resource "github_repository_environment_deployment_policy" "release_tags" {
  repository  = github_repository.project.name
  environment = github_repository_environment.release.environment
  tag_pattern = "*-v*"
}

# Immutable releases: once a release is published, its tag and assets can't change. The provider has
# no resource for this yet (integrations/terraform-provider-github#3701), so the GitHub CLI calls the
# REST API. Replace this with the native resource once it ships.
resource "terraform_data" "immutable_releases" {
  triggers_replace = [var.github_owner, github_repository.project.name]

  input = {
    path = "repos/${var.github_owner}/${github_repository.project.name}/immutable-releases"
  }

  provisioner "local-exec" {
    command = "gh api --method PUT \"$API_PATH\""
    environment = {
      API_PATH = self.input.path
    }
  }

  provisioner "local-exec" {
    when    = destroy
    command = "gh api --method DELETE \"$API_PATH\""
    environment = {
      API_PATH = self.input.path
    }
  }
}
