export type ChoiceTier = 'correct'|'same_reading'|'same_meaning'|'unrelated';
export type Choice = {id:string; reading?:string; meaning?:string; tier:ChoiceTier};
export type ChoiceSet = {format:'vocab_pair'|'kanji_meaning'|'kanji_reading'; choices:Choice[]; correctChoiceId:string; fingerprint:string};
export type KanjiExample = {word:string; reading?:string};
export type KanjiChoiceItem = {itemId?:string; glyph?:string; meaning?:string; meanings?:string[]; onReadings?:string[]; kunReadings?:string[]; examples?:KanjiExample[]};
export type DictionaryCandidate = {readings?:string[]; senses?:{meanings?:string[]}[]};
export function buildVocabChoices(input:{target:{itemId?:string;writtenForm?:string;reading:string;meaning:string;acceptedGlosses?:string[];partOfSpeech?:string};candidates:{itemId?:string;writtenForm?:string;reading?:string;meaning?:string;partOfSpeech?:string}[];seed:string}):ChoiceSet|null;
export function buildKanjiMeaningChoices(input:{target:KanjiChoiceItem & {meaning:string};candidates:KanjiChoiceItem[];seed:string;lookup?:(form:string)=>Promise<DictionaryCandidate[]>;examplesFor?:(item:{itemId?:string;glyph?:string})=>Promise<KanjiExample[]>}):Promise<ChoiceSet|null>;
export function buildKanjiReadingChoices(input:{target:{itemId?:string;reading:string};candidates:{itemId?:string;reading?:string}[];seed:string}):ChoiceSet|null;
