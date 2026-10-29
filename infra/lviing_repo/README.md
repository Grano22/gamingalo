# OpenTofu workload root

This configuration manages the GitHub repository. It uses a remote S3 backend and DynamoDB lock table provisioned separately by `infra/bootstrap`.

## Credentials

Use normal provider credential chains; do not commit credentials or state files.

- AWS: configure an AWS profile/role or `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and (when needed) `AWS_SESSION_TOKEN`.
- GitHub: provide `GITHUB_TOKEN` with repository creation permission for the owner. For an organization, the token needs appropriate organization repository permissions.

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
cd ../opentofu
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

The S3 backend is encrypted and versioned; DynamoDB coordinates locks for concurrent runs. `state-access-policy.json.tftpl` describes a limited runtime policy scoped to the workload state object and lock table. Keep bootstrap permissions separate from the workload role, restrict who can assume the runtime role, and treat state as sensitive.
