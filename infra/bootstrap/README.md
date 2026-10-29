# OpenTofu backend bootstrap

This root creates only the shared S3 state bucket and DynamoDB lock table. It intentionally has no remote backend, so its state remains local and it can create the remote backend resources before the workload root initializes.

## Dev bootstrap

```sh
cd infra/bootstrap
cp environments/dev.tfvars.example environments/dev.tfvars
tofu init
tofu plan -var-file=environments/dev.tfvars
tofu apply -var-file=environments/dev.tfvars
```

For production, complete `environments/prod.tfvars.example`, copy it to ignored `environments/prod.tfvars`, and use that variable file instead. Always inspect the plan, especially if the bucket or table already exists. If resources already exist without this state, import them rather than trying to recreate them.

The state file created here is sensitive. Back it up securely; do not commit it or `.terraform/`. The backend bucket and table are protected by `prevent_destroy`. Keep this local bootstrap state because this root manages the remote backend itself.
