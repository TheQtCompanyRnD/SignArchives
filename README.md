# Sign archives

[![GitHub Super-Linter](https://github.com/TheQtCompanyRnD/SignArchives/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/TheQtCompanyRnD/SignArchives/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/TheQtCompanyRnD/SignArchives/actions/workflows/check-dist.yml/badge.svg)](https://github.com/TheQtCompanyRnD/SignArchives/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This is a Qt specific GitHub Action to sign archives using the internal signing
server REST API.

## Getting started

Request access to the signing server by contacting @Jukka Jokiniva. Provide:

- Which environment you need (test/production)
- Which platforms (macOS/Windows)
- Your use case and integration details (CI/CD pipeline)

Once you have credentials, add them as secrets to your GitHub repository. Note:
macOS and Windows servers use separate credentials.

```yaml
- name: Sign archives
  uses: TheQtCompanyRnD/SignArchives@v2
  with:
    macos: 'path/to/macos/archive.7z'
    win-x64: 'path/to/windows/x64/archive.7z'
    win-arm64: 'path/to/windows/arm64/archive.7z'
    mac-signing-server: 'https://signingservermac.ci.qt.io/'
    mac-signing-user: ${{ secrets.MAC_SIGNING_USER }}
    mac-signing-token: ${{ secrets.MAC_SIGNING_TOKEN }}
    win-signing-server: 'https://signingserverwin.ci.qt.io/'
    win-signing-user: ${{ secrets.WIN_SIGNING_USER }}
    win-signing-token: ${{ secrets.WIN_SIGNING_TOKEN }}
```

You only need to supply server credentials for the platforms you are signing.

## Outputs

The signed archives are written alongside the originals with a `signed_` prefix.
Access the paths via outputs:

```yaml
- name: Sign archives
  id: sign
  uses: TheQtCompanyRnD/SignArchives@v2
  with:
    macos: 'path/to/macos/archive.7z'
    mac-signing-server: 'https://signingservermac.ci.qt.io/'
    mac-signing-user: ${{ secrets.MAC_SIGNING_USER }}
    mac-signing-token: ${{ secrets.MAC_SIGNING_TOKEN }}

- name: Print outputs
  run: |
    echo "macos: ${{ steps.sign.outputs.macos }}"
    echo "win-x64: ${{ steps.sign.outputs.win-x64 }}"
    echo "win-arm64: ${{ steps.sign.outputs.win-arm64 }}"
```
