# External Commands

Device-management features may require OS commands.

Never pass arbitrary user input directly to command execution.

Bad:

```go
exec.Command("shutdown", userInput)
```

Prefer controlled arguments derived from validated configuration:

```go
exec.CommandContext(
    ctx,
    "shutdown",
    "/s",
    "/t",
    "0",
)
```

Command execution must be:

* Explicit
* Auditable
* Validated
* Timeout-aware
* Error-checked

Never expose arbitrary command execution through an HTTP API.
