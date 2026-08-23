import { constraintAtomID, isConstraintAtomDraft } from '../../contracts/constraint-atom.js';
function norm(v) { return v.trim().replace(/\\/g, '/').replace(/^\.\//, ''); }
function pathPattern(pattern) {
    const p = norm(pattern);
    let out = '^';
    for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if (ch === '*') {
            if (p[i + 1] === '*') {
                out += '.*';
                i++;
            }
            else
                out += '[^/]*';
            continue;
        }
        out += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    }
    return new RegExp(out + '(?:/.*)?$');
}
export function constraintAtomMatchesPath(atom, path) { return atom.status === 'ACTIVE' && atom.subject_kind === 'path' && atom.predicate === 'mutate' && atom.polarity === 'DENY' && pathPattern(atom.subject).test(norm(path)); }
export function activeConstraintAtoms(atoms) { return (atoms ?? []).filter(x => x.status === 'ACTIVE'); }
export function deniedMutationAtoms(atoms, path) { return activeConstraintAtoms(atoms).filter(a => constraintAtomMatchesPath(a, path)); }
export function constraintAtomProjection(atom) { return `constraint-atom:${atom.id}:${atom.polarity} ${atom.predicate} ${atom.subject_kind} ${atom.subject}`; }
export function applyConstraintAtomDrafts(current, drafts, revision, sourceText, now = Date.now()) {
    const atoms = (current ?? []).map(x => ({ ...x, supersedes: [...x.supersedes] })), added = [], superseded = [], conflicts = [], missing_supersedes = [];
    for (const draft of drafts ?? []) {
        if (!isConstraintAtomDraft(draft))
            continue;
        const id = constraintAtomID(draft, revision);
        if (atoms.some(x => x.id === id))
            continue;
        const explicitlySuperseded = new Set(draft.supersedes), missing = [...explicitlySuperseded].filter(ref => !atoms.some(x => x.id === ref && x.status === 'ACTIVE'));
        const atom = { ...draft, supersedes: [...draft.supersedes], id, authority: 'USER', introduced_revision: revision, status: missing.length ? 'CONFLICTING' : 'ACTIVE', source_text: sourceText.slice(0, 12000), created_at: now };
        if (missing.length)
            missing_supersedes.push({ incoming: atom, missing });
        else
            for (const old of atoms.filter(x => x.status === 'ACTIVE' && explicitlySuperseded.has(x.id))) {
                old.status = 'SUPERSEDED';
                old.superseded_by = id;
                superseded.push(old);
            }
        const opposite = atoms.find(old => atom.status === 'ACTIVE' && old.status === 'ACTIVE' && old.subject_kind === atom.subject_kind && norm(old.subject) === norm(atom.subject) && old.predicate === atom.predicate && old.scope === atom.scope && old.polarity !== atom.polarity);
        if (opposite && !explicitlySuperseded.has(opposite.id)) {
            atom.status = 'CONFLICTING';
            conflicts.push({ previous: opposite, incoming: atom });
        }
        atoms.push(atom);
        added.push(atom);
    }
    return { atoms, added, superseded, conflicts, missing_supersedes };
}
