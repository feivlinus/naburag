# Repository Agent Guidelines

## Terminal & File Discovery Rules
- **NEVER** use `Get-ChildItem` (or PowerShell aliases `dir`, `ls`, `gci`) to inspect, list, or search files or directories.
- **ALWAYS** use `rg` (ripgrep) for searching and listing files (`rg --files`, `rg --files --hidden`, `rg "<pattern>"`).
