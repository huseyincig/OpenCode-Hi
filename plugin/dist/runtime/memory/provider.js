export class DisabledMemoryProvider {
    async search() { return []; }
    async add() { throw new Error('Memory provider disabled'); }
    async forget() { return false; }
    async profile() { return { available: false, name: 'disabled' }; }
}
