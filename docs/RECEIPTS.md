# Dema Receipts v0.1

A receipt is Dema's way of saying:

```text
what happened,
what did not happen,
what evidence exists,
and what the next safe action is.
```

## Why receipts matter

Most AI tools ask users to trust invisible actions.

Dema uses receipts to make important steps inspectable. A receipt should help a user answer:

- What action was proposed?
- What action actually happened?
- What action did not happen?
- What evidence supports the result?
- What is the next safe action?

## Local-first storage

By default, receipts live under:

```text
~/.dema/receipts/
```

The folder is created by:

```bash
dema setup
```

## CLI commands

List receipts:

```bash
dema receipts
```

Read one receipt:

```bash
dema receipts ARTIFACT-011
```

The selector may be a receipt ID, artifact ID, exact path, or unique receipt filename.

### Verify a local talk-runtime receipt

```bash
dema receipt verify /path/to/talk-runtime-receipt.json
dema receipt verify --help
```

This read-only command supports `bizra.dema.talk_runtime_receipt.v0.1` only.
Its existing `receipt_id` is SHA-256 of the UTF-8 JSON metadata body with object
keys sorted recursively and `receipt_id` excluded. Formatting and object-key
order do not affect the digest. No receipt format or signing key is added.

Exit `0` means the fields conform to this local format and the digest matches;
exit `1` means invalid fields, digest, JSON, usage, or another read error; exit
`2` means the file is missing. Errors name the file and failing field without
printing receipt values. `--help` prints help before any receipt read.

Output includes the recorded `invocation_status`: a valid refused-call receipt
remains `refused`. Digest verification does not prove producer identity, consent
authenticity, model-weight identity, or that the invocation occurred. Someone
who changes the content and recomputes its digest can make a new valid receipt.
Talk classifies empty or whitespace-only completions as `failed` with
`empty_response`; the metadata receipt records `failed` but does not include the
raw reply or `error_reason`.

## ARTIFACT-011 boundary

ARTIFACT-011 is the first bounded diagnostic runtime receipt.

`dema mission propose` may preview readiness for ARTIFACT-011, but it must not create the receipt.

The actual runtime path remains gated by exact consent:

```text
GO: Node0 bounded diagnostic activation only
```

## Preview evidence artifacts

Some Dema surfaces produce deterministic evidence previews. These are useful for review, but they are not canonical receipts.

A preview evidence artifact must say so explicitly:

```text
mode: PREVIEW_ONLY
chain_id: preview-no-chain
prev_digest: null
producer_identity: null
certifies: false
receipt_minted: false
```

Behavioral modulation previews use this pattern to show what would be checked without changing behavior, signing, minting, or advancing the Node0 chain.

## Receipt quality bar

A useful receipt should be:

- human-readable
- timestamped
- linked to the action it describes
- explicit about what did not happen
- clear about the next safe action
