# Branch Strategy

This repository uses two long-lived branches:

```text
main
aws-production
```

## main

`main` is the open-source development branch.

Use it for:

- normal feature work;
- documentation improvements;
- public issue and pull request collaboration;
- V2 development;
- changes that should be visible to the open-source project.

## aws-production

`aws-production` is the AWS deployment branch.

Use it for:

- the exact code currently intended for the public beta deployment;
- AWS-specific configuration that should not move until we choose to promote it;
- production hotfixes.

AWS Amplify and App Runner should be configured to deploy from
`aws-production`, not `main`.

## Promotion Flow

When `main` has a version we want to deploy:

```bash
git checkout aws-production
git merge main
git push origin aws-production
```

For production-only fixes, commit them to `aws-production` first. If the fix is
also useful for the open-source project, merge or cherry-pick it back to `main`.
