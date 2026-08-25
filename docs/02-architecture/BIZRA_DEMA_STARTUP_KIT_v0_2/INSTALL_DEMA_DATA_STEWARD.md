# Install / Use DEMA Data Steward

The packaged skill is delivered separately as `skill.zip`.

## ChatGPT skill library
Upload `skill.zip` through the Skills interface. The skill should appear as **DEMA Data Steward**.

## Local agent / repository
Install the unzipped `dema-data-steward/` directory in the local agent's supported skill path. For Claude-style repository skills this is commonly `.claude/skills/dema-data-steward/`; other harnesses may use a different configured skill root.

Do not add the skill to an already-qualified canonicalization candidate. Add it only in the post-canonicalization Startup Kit v0.2 slice so the verified G6 candidate identity remains unchanged.

## First safe use
1. Select one bounded pilot root.
2. Run metadata inventory only.
3. Review errors/symlinks/exclusions.
4. Build File Cards.
5. Produce duplicate candidates.
6. Request separate content-read authority before hashing or parsing bytes if the mission boundary requires it.
7. Keep physical organization in PREVIEW_ONLY until exact mutation GO is granted.
8. Use existing DEMA reversible steward for any authorized rename/move operation.
