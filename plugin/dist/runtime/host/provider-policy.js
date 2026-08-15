function configView(hostConfig) { return hostConfig && typeof hostConfig === 'object' ? hostConfig : {}; }
function addStrings(target, value) { if (typeof value === 'string' && value.trim())
    target.add(value.trim());
else if (Array.isArray(value))
    for (const x of value)
        addStrings(target, x); }
export function providerPolicyView(hostConfig) {
    const cfg = configView(hostConfig), allowed = new Set(), denied = new Set(), source = [];
    addStrings(allowed, cfg.enabled_providers);
    if (allowed.size)
        source.push('enabled_providers');
    addStrings(denied, cfg.disabled_providers);
    if (denied.size)
        source.push('disabled_providers');
    const use = cfg?.policy?.provider?.use ?? cfg?.policies?.provider?.use;
    if (use && typeof use === 'object' && !Array.isArray(use)) {
        for (const [provider, decision] of Object.entries(use)) {
            const d = typeof decision === 'string' ? decision : decision?.action ?? decision?.permission;
            if (d === 'deny')
                denied.add(provider);
            else if (d === 'allow')
                allowed.add(provider);
        }
        source.push('policy.provider.use');
    }
    return { allowed, denied, source };
}
