## [1.0.1](https://github.com/bendechrai/devports/compare/v1.0.0...v1.0.1) (2025-11-18)


### Bug Fixes

* use existing ports when setup --force is used ([e92498e](https://github.com/bendechrai/devports/commit/e92498e9827c34d1127653b9942241033f9385d9)), closes [#1](https://github.com/bendechrai/devports/issues/1)

# 1.0.0 (2025-11-18)


### Features

* initial devports implementation ([77427d5](https://github.com/bendechrai/devports/commit/77427d5238199b18ede39287919c3791e6b9a938))

## [1.0.2](https://github.com/bendechrai/devports/compare/v1.0.1...v1.0.2) (2025-11-18)


### Bug Fixes

* update package name and version in package.json ([afb5409](https://github.com/bendechrai/devports/commit/afb5409d082a6461cf0b98155b8731d942567d58))

## [1.0.1](https://github.com/bendechrai/devports/compare/v1.0.0...v1.0.1) (2025-11-18)


### Bug Fixes

* skip zsh syntax check if zsh is not installed ([fdde8c2](https://github.com/bendechrai/devports/commit/fdde8c27f3f6f8f0e96e6d24b09037da461b22b5))

# 1.0.0 (2025-11-18)


### Bug Fixes

* allow warnings in CI lint check ([cba6df7](https://github.com/bendechrai/devports/commit/cba6df7098593af1fb854c999973b6941bc71949))
* **ci:** configure npmrc for semantic-release authentication ([3aa56cf](https://github.com/bendechrai/devports/commit/3aa56cf85389428d5a6b24280d0e6660573b159b))
* remove unused registry-url from Node.js setup in publish workflow when using trusted publishing ([352431c](https://github.com/bendechrai/devports/commit/352431c78b05f59c1fb7f9ef81cf8d6630d9636d))
* resolve all TypeScript and ESLint errors for production readiness ([58c1f52](https://github.com/bendechrai/devports/commit/58c1f52ea60df195237c088bba14be2f3406a737))
* resolve all TypeScript and ESLint warnings for production readiness ([82a1428](https://github.com/bendechrai/devports/commit/82a1428adfa4ef5020b8f6594ed45268d6e3bf00))
* update npm for trusted publishing and remove provenance option from release config ([d6bd73e](https://github.com/bendechrai/devports/commit/d6bd73e2aa66e7beb6a4671f439917302ecdcb3e))


### Features

* initial release with comprehensive port management ([a3d14de](https://github.com/bendechrai/devports/commit/a3d14def8d3ea8b759a2f24334200d5fc8601ce8))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release
- Port allocation and release commands
- Project/service scoped allocations
- Type-aware port ranges (postgres, mysql, redis, api, app, custom)
- File locking for atomic operations
- Quiet mode for scripting
- List and filter allocations
- Status command to show available ports
- Port reservation system
- Configuration file support
- Import script for existing allocations
- Git worktree integration examples

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2025-01-15

### Added
- Initial project structure
- Core port management functionality
- CLI with commander
- TypeScript support
- Basic test suite
- Documentation and examples
