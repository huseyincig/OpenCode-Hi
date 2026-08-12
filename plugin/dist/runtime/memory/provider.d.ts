export type MemoryScope = 'USER' | 'PROJECT';
export interface MemoryRecord {
    id: string;
    scope: MemoryScope;
    text: string;
    source?: string;
    createdAt: number;
}
export interface MemoryProvider {
    search(query: string, scope: MemoryScope, limit?: number): Promise<MemoryRecord[]>;
    add(record: Omit<MemoryRecord, 'id' | 'createdAt'>): Promise<MemoryRecord>;
    forget(id: string): Promise<boolean>;
    profile(): Promise<{
        available: boolean;
        name: string;
    }>;
}
export declare class DisabledMemoryProvider implements MemoryProvider {
    search(): Promise<MemoryRecord[]>;
    add(): Promise<MemoryRecord>;
    forget(): Promise<boolean>;
    profile(): Promise<{
        available: boolean;
        name: string;
    }>;
}
