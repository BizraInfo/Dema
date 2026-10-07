# BIZRA Wrapper Blueprint v0.1

A **BIZRA Wrapper** is an anti-corruption boundary around an external capability.

Families: ModelWrapper, HarnessWrapper, ToolWrapper, MCPWrapper, A2AWrapper, MemoryWrapper, SandboxWrapper, ProviderWrapper, GUI/AHK EffectWrapper.

Every wrapper exposes:
- exact wrapper/upstream identity and version;
- declared operations and schemas;
- side-effect classes and resource requirements;
- all material effective defaults/fallbacks;
- normalized request/result evidence;
- stable error/reason codes.

A wrapper MUST NOT infer consent, issue FATE grants, widen scope, silently add tools, silently substitute upstreams, or treat upstream success as a BIZRA verdict.

Lifecycle:
DISCOVERED -> WRAPPED -> ADMITTED -> QUALIFIED -> SELECTED -> AUTHORIZED -> EXECUTED -> VERIFIED

**External capability enters BIZRA through a wrapper; external authority does not.**
