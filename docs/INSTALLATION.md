# Installation

OHO is installed through OpenCode's native plugin configuration. No separate methodology plugin is required.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-hhc-orchestrator@git+https://github.com/huseyincig/OpenCode-HHC-Orchestrator.git#<REF>"
  ]
}
```

Restart OpenCode after changing plugin registration. For release validation, pin OHO to an exact immutable candidate ref rather than `main`.

## Optional helper

```bash
python scripts/native_plugin_setup.py install /path/to/project --ref <REF>
python scripts/native_plugin_setup.py doctor /path/to/project
python scripts/native_plugin_setup.py uninstall /path/to/project
python scripts/native_plugin_setup.py reconfigure /path/to/project --primary-mode manager --parallel-max 2
python scripts/native_plugin_setup.py role-models /path/to/project --print
```

The helper edits only OHO-owned fields and preserves unrelated user plugin/MCP/config data.

## Runtime verification

After restart verify actual runtime discovery: OHO loaded, HHC tools present, Team tools hidden by default, 8 HHC agents available, 29 packaged HHC-native skills discoverable, role-selected model actually used by child, child recursive HHC control-plane invocation denied, and evidence/STOP gates active.
