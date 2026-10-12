export type ProviderConfiguration={configured:boolean;model:string;freeTierConfirmed:boolean;enabled:boolean;reason:string|null};
export function providerConfiguration(env?:Record<string,string|undefined>):ProviderConfiguration;
