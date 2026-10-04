# Wrappers & Capability Cartridges

Every foreign capability enters through an anti-corruption wrapper/capability cartridge.

Lifecycle:

`DISCOVERED -> SOURCE_BOUND -> QUALIFIED -> ADMITTED -> SELECTED -> FATE_AUTHORIZED -> EXECUTED -> OBSERVED -> RECEIPTED`

No stage implies the next.

A cartridge should bind upstream repository/provider, exact bytes/revision, license, SBOM or dependency identity, required privileges, network/data-egress behavior, filesystem effects, sandbox, qualification tests, and revocation status.
