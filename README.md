# Sign archives

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This is an Qt specific Github action to allow Github jobs to sign archives using
our internal CI Infrastructure.

## Getting started

You need to setup a Jenkins token for your Jenkins user via the Jenkins UI. This
token will be used to authenticate the github action with Jenkins.

Go to your User settings -> Security -> API Token -> Add new token.

Add the URL to the Jenkins server, your username and the token as secrets to
your github repository.

Then you can setup the github action like this:

```yaml
- name: Sign archives
  uses: TheQtCompanyRnD/SignArchives@v1.1
  with:
    macos: 'path/to/macos/archive.7z'
    win-x64: 'path/to/windows/x64/archive.7z'
    win-arm64: 'path/to/windows/arm64/archive.7z'
    jenkins-url: ${{ secrets.JENKINS_URL }}
    jenkins-user: ${{ secrets.JENKINS_USER }}
    jenkins-token: ${{ secrets.JENKINS_TOKEN }}
```

## Outputs

You can get the path to the signed archives via the outputs:

```yaml
- name: Print outputs
  run: |
    echo "macos: ${{ steps.sign.outputs.macos }}"
    echo "win-x64: ${{ steps.sign.outputs.win-x64 }}"
    echo "win-arm64: ${{ steps.sign.outputs.win-arm64 }}"
```
