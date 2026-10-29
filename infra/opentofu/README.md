# OpenTofu bootstrap: AWS state and GitHub repository

This configuration creates:

- An S3 bucket for encrypted, versioned, private OpenTofu state.
- A DynamoDB table for distributed state locking.
- A GitHub repository owned by the configured user or organization.

## Credentials

Use normal provider credential chains; do not commit credentials or state files.

- AWS: configure an AWS profile/role or `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and (when needed) `AWS_SESSION_TOKEN`.
- GitHub: provide `GITHUB_TOKEN` with repository creation permission for the owner. For an organization, the token needs appropriate organization repository permissions.

## Bootstrap the backend resources

The first run must use local state because the remote bucket and lock table do not exist yet:

```sh
cd infra/opentofu
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with a unique bucket name, GitHub owner, and repository name.
tofu init
tofu plan
tofu apply
```

This bootstrap state is initially local (`terraform.tfstate`). Treat it as sensitive and back it up securely. After the resources have been created, use the emitted backend values to fill in `backend.tf.example`, save it as `backend.tf`, and migrate state:

```sh
tofu init -migrate-state
```

Do not add local state, `.terraform/`, `terraform.tfvars`, or secrets to version control.

## Distributed state access

The S3 backend settings use encryption and the bucket's versioning. The DynamoDB table coordinates state locking among concurrent users/CI runs. `state-access-policy.json.tftpl` is a least-privilege IAM policy template for a runtime role scoped to this repository's state object and lock table. Fill its placeholders with the actual AWS account, bucket, state key, and lock-table values before applying it through your IAM process.

Keep bootstrap/admin permissions separate from the runtime state permissions. The runtime role needs only S3 list/read/write/delete for this state object and the listed DynamoDB lock operations; it does not need permission to create or delete the bucket/table. Restrict who can assume that role, especially in CI. State may contain secrets, so avoid broad read access.

The bucket and lock table have `prevent_destroy` lifecycle guards. Remove those protections deliberately only when retiring the state backend and after securely migrating/archiving state.
