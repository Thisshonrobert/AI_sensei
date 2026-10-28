export type ProviderConfiguration={configured:boolean;model:string;models:string[];freeTierConfirmed:boolean;enabled:boolean;reason:string|null};
export function normalizeModelId(value:unknown):string|null;
export function providerConfiguration(env?:Record<string,string|undefined>):ProviderConfiguration;
