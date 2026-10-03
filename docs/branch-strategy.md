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

`aws-production` is protected. Do not push to it directly.

When `main` has a version we want to deploy:

1. Create a release branch from `aws-production`.
2. Cherry-pick or carefully merge the wanted commits from `main`.
3. Preserve AWS-only files such as `amplify.yml`, `Dockerfile.api`, and
   `docs/aws-deployment.md`.
4. Open a pull request into `aws-production`.
5. Merge the pull request after reviewing the diff.

For production-only fixes, commit them to `aws-production` first. If the fix is
also useful for the open-source project, merge or cherry-pick it back to `main`.
