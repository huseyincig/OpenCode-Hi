export type MemoryScope='USER'|'PROJECT'
export interface MemoryRecord{id:string;scope:MemoryScope;text:string;source?:string;createdAt:number}
export interface MemoryProvider{search(query:string,scope:MemoryScope,limit?:number):Promise<MemoryRecord[]>;add(record:Omit<MemoryRecord,'id'|'createdAt'>):Promise<MemoryRecord>;forget(id:string):Promise<boolean>;profile():Promise<{available:boolean;name:string}>}
export class DisabledMemoryProvider implements MemoryProvider{async search():Promise<MemoryRecord[]>{return[]}async add():Promise<MemoryRecord>{throw new Error('Memory provider disabled')}async forget():Promise<boolean>{return false}async profile():Promise<{available:boolean;name:string}>{return{available:false,name:'disabled'}}}
