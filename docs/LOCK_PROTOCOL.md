# Project index lock protocol v2

## Upgrade and rollback requirement

Stop and drain **all** VS Code extension, Desktop, and MCP processes using a project before switching versions. Update them together, then restart them. Apply the same stop/drain requirement before rolling back.

Reading a legacy lock is compatibility detection, **not a guarantee that old and new versions can safely run together**. An old binary can still rename an entire lock directory after a stale observation. A new binary cannot fence that old implementation. Do not mix versions, including processes left running in the background.

This change does not migrate `.cartridge/index.json` or any Memory/Context card. The canonical lock remains `.cartridge/index.lock`.

## Ownership and publication

A v2 lock contains one ordinary file named `owner-<UUID>.json`. It records `protocolVersion: 2`, the matching UUID token, PID, hostname and creation time.

Acquisition first creates a unique sibling `index.lock.candidate-<PID>-<UUID>` directory, writes and syncs the complete owner file, then renames the populated directory into the canonical location. Contenders cannot replace a populated directory. No empty canonical initialization window is published by v2.

Heartbeat uses `utimes` on the existing, generation-specific owner file. It never recreates a removed owner marker. Ownership is checked again before canonical index replacement.

## Recovery and release

Automatic recovery requires a valid v2 owner on the same host, expiration of the local grace period, and an OS `ESRCH` result proving the recorded PID does not exist. A reused PID, permission error, or uncertain OS result is treated as potentially live.

Recovery and release unlink only the exact observed UUID owner filename, then attempt a nonrecursive `rmdir`. A delayed contender cannot delete a later generation's differently named owner file. A nonempty replacement directory is preserved. No normal recovery or release recursively removes or renames the current lock directory.

An empty canonical directory left by a crash after marker removal can be safely removed with nonrecursive `rmdir`. Fully initialized, valid staging directories from demonstrably dead same-host processes can be reclaimed after the local grace period. Unknown, remote, partial, or still-live staging directories are retained as inert debris rather than guessed abandoned.

## Cases that deliberately block

- A valid live legacy `owner.json` waits for natural release, subject to timeout
- An abandoned legacy lock, malformed metadata, unknown files or multiple owners produces an actionable compatibility error and is not deleted
- A fresh remote-host lock waits, subject to timeout; an expired remote lease blocks recovery because age cannot prove that the remote writer died
- Stale remote leases are not automatically stolen, including when a long-running writer has stopped heartbeating

After an error, stop all relevant clients and verify that no write remains in progress. Inspect and back up the lock metadata before removing a confirmed abandoned lock. If owner liveness is uncertain, retain the lock and investigate. Never remove `.cartridge/index.json` or cards as a lock-recovery step.

Before rollback, let the new version release its lock normally. If it crashed, use the same all-clients-stopped inspection procedure. The old binary does not understand v2 ownership and must not be started alongside a running new writer.

## Verification scope

Regression coverage includes real independent OS processes for delayed stale recovery, concurrent commits and process death during publication/recovery, plus lock initialization, legacy/remote behavior, PID uncertainty, fencing, heartbeat and failure cleanup. Startup warning writes share the project transaction with commits, and shutdown drains accepted operations.

The protocol assumes coherent local filesystem rename/rmdir semantics, that a hostname identifies one OS/PID namespace, and no hostile external replacement of paths. Do not share active locks across containers configured with identical hostnames but separate PID namespaces. It is not a distributed filesystem fencing service. Remote-host liveness and mixed-version safety are deliberately not inferred from lease age.
