output "repository_url" {
  description = "HTTPS URL of the created GitHub repository."
  value       = github_repository.project.html_url
}

output "state_bucket_name" {
  description = "S3 bucket holding OpenTofu state."
  value       = aws_s3_bucket.tofu_state.id
}

output "lock_table_name" {
  description = "DynamoDB table used by the S3 backend for state locking."
  value       = aws_dynamodb_table.tofu_lock.name
}

output "backend_configuration" {
  description = "Backend stanza to use in the root module after bootstrapping."
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.tofu_state.id}"
        key            = "${var.repository_name}/terraform.tfstate"
        region         = "${var.aws_region}"
        dynamodb_table = "${aws_dynamodb_table.tofu_lock.name}"
        encrypt        = true
      }
    }
  EOT
}
