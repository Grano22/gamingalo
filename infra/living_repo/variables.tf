variable "aws_region" {
  description = "AWS region for the OpenTofu state bucket and lock table."
  type        = string
  default     = "us-east-1"
}


variable "github_owner" {
  description = "GitHub user or organization that will own the created repository."
  type        = string
}

variable "repository_name" {
  description = "Name of the GitHub repository to create."
  type        = string
}

variable "repository_description" {
  description = "Description for the created GitHub repository."
  type        = string
  default     = ""
}

variable "repository_visibility" {
  description = "Visibility of the GitHub repository."
  type        = string
  default     = "private"

  validation {
    condition     = contains(["private", "public", "internal"], var.repository_visibility)
    error_message = "repository_visibility must be private, public, or internal."
  }
}
