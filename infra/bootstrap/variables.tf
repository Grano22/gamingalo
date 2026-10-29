variable "aws_region" {
  description = "AWS region for the OpenTofu backend resources."
  type        = string
  default     = "eu-central-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for OpenTofu remote state."
  type        = string
}

variable "lock_table_name" {
  description = "DynamoDB table name used to lock OpenTofu state."
  type        = string
}
