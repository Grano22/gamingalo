output "state_bucket_name" {
  description = "S3 bucket holding OpenTofu remote state."
  value       = aws_s3_bucket.tofu_state.id
}

output "lock_table_name" {
  description = "DynamoDB table used to lock OpenTofu state."
  value       = aws_dynamodb_table.tofu_lock.name
}
