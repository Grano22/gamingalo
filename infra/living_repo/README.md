# OpenTofu workload root

This configuration manages the GitHub repository. It uses a remote S3 backend and DynamoDB lock table provisioned separately by `infra/bootstrap`.

## Credentials

Use normal provider credential chains; do not commit credentials or state files.

- AWS: configure an AWS profile/role or `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and (when needed) `AWS_SESSION_TOKEN`.
- GitHub: provide `GITHUB_TOKEN` with repository creation permission for the owner. For an organization, the token needs appropriate organization repository permissions.

## What it manages

- The repository itself.
- GitHub Pages, built by the `docs` workflow (`build_type = "workflow"`).
- The `release` environment, which only tags matching `*-v*` can deploy to. Its `NPM_TOKEN` secret is set by hand in the repository settings, so it never reaches the state.
- Immutable releases. The GitHub provider has no resource for this yet, so a `terraform_data` resource calls `gh api` on apply, and again on destroy to turn it off. The `gh` CLI must be installed and signed in as a repository admin. Use `export GITHUB_TOKEN=$(gh auth token)` so both use the same account.

## Environments and state bootstrap

The backend cannot create itself: bootstrap the S3 bucket and DynamoDB table in the separate `infra/bootstrap` root, which uses local state. The workload root in this directory uses environment-specific backend configuration files.

For dev, copy the example variable file if local values need changing, then initialize the bootstrap root:

```sh
cd infra/bootstrap
cp environments/dev.tfvars.example environments/dev.tfvars
tofu init
tofu plan -var-file=environments/dev.tfvars
tofu apply -var-file=environments/dev.tfvars
```

The dev defaults use bucket `gamingalo`, lock table `gamingalo-locks`, and region `eu-central-1`. The local bootstrap state is sensitive; back it up securely and do not commit it. Bootstrap resources have `prevent_destroy` protections.

After bootstrap succeeds, use the remote workload root. Initialize its shared backend once, then create/select the dev workspace:

```sh
cd ../living_repo
cp environments/dev.tfvars.example environments/dev.tfvars
tofu init -backend-config=environments/dev.backend.hcl
tofu workspace select dev || tofu workspace new dev
tofu plan -var-file=environments/dev.tfvars
tofu apply -var-file=environments/dev.tfvars
```

On later runs, use the same backend and variable-file arguments. `backend.tf` deliberately contains only an empty S3 backend block; bucket, region, and lock table live in the checked-in `.backend.hcl` files. With this shared base key, each named workspace has its own state under S3's `env:` workspace prefix.

## Workspaces and production

Use one workspace per deployment environment in this workload root. The bootstrap root is intentionally not workspace-based: its local state manages the shared backend resources themselves. Dev and prod workspaces can share the same bucket/table with the base key `gamingalo/terraform.tfstate`; OpenTofu stores each non-default workspace state under the S3 `env:` prefix. The checked-in dev/prod backend files currently configure the same bucket, region, lock table, and base key, so they are not intended to be switched back and forth in one initialized directory. Initialize once with dev config and use workspaces for environments in that backend.

For dev, select/create the workspace and always pass the matching variables file:

```sh
tofu workspace select dev || tofu workspace new dev
tofu plan -var-file=environments/dev.tfvars
tofu apply -var-file=environments/dev.tfvars
```

For prod using the same backend, select/create `prod` and use `prod.tfvars`:

```sh
tofu workspace select prod || tofu workspace new prod
tofu plan -var-file=environments/prod.tfvars
tofu apply -var-file=environments/prod.tfvars
```

A workspace isolates state only; it does not isolate AWS accounts, credentials, provider permissions, or resources. Prefer separate AWS roles/accounts and review every plan before applying. If you require a physically separate prod state bucket/table, use a separate checkout/working directory with its own backend config instead of switching backend configuration in the dev directory. Provision that separate backend with the bootstrap root first.

Do not add local state, `.terraform/`, `*.tfvars`, backend cache, or secrets to version control.

## Distributed state access

The S3 backend is encrypted and versioned; DynamoDB coordinates locks for concurrent runs. `state-access-policy.json.tftpl` describes a limited runtime policy scoped to the state object and workspace state paths and lock table. Keep bootstrap permissions separate from the workload role, restrict who can assume the runtime role, and treat state as sensitive.

## Security review

The infrastructure configuration currently provides:

- **S3 public exposure protection:** all four S3 Block Public Access settings are enabled, and bucket ownership is enforced. This blocks public ACLs and public bucket policies; it does not replace IAM access control.
- **State confidentiality and recovery:** S3 server-side encryption (SSE-S3/AES256) and versioning are enabled. State may still contain secrets in plaintext when authorized users retrieve it, so tightly restrict `s3:GetObject` and protect downloaded state/plan files.
- **DynamoDB protection:** the lock table uses AWS-managed encryption at rest and deletion protection. The table stores coordination locks, not Terraform state; encryption is defense in depth.
- **Deletion safeguards:** S3 bucket and DynamoDB table have OpenTofu `prevent_destroy`; the table also has AWS deletion protection. These are safeguards against accidental removal, not access controls.

The config does **not** define a bucket policy or an explicit deny for non-TLS requests. Keep S3 and DynamoDB access private by granting access only to trusted AWS IAM roles/users, ideally through AWS Organizations/account controls and a dedicated CI role with short-lived credentials. Consider adding an S3 bucket policy that denies requests where `aws:SecureTransport` is false. Do not grant public/anonymous access. The policy template is an IAM identity policy, not a bucket policy; it grants permissions but does not itself block other principals.

Before relying on this for production, verify the deployed account and region, bucket public-access settings, bucket policy/access points, table encryption and deletion protection, IAM role trust policy, and CloudTrail coverage. The existing S3 backend uses legacy DynamoDB locking; for newer OpenTofu versions, consider S3 native lockfiles (`use_lockfile = true`) and eventually retire DynamoDB locking after coordinating all clients. Do not switch locking mechanisms on an active state without a planned migration.
