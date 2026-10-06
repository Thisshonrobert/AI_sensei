import { createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import { z } from 'zod';

export const json = value => JSON.parse(JSON.stringify(value));
export function configuration() {
 return { version: 1, libraryVersion: '5.4.2', parameters: json(generatorParameters({ request_retention: .90, enable_fuzz: false, enable_short_term: true, learning_steps: ['1m','10m'], relearning_steps: ['10m'] })) };
}
const stateSchema = z.object({ due: z.string().datetime(), stability:z.number().nonnegative(), difficulty:z.number().nonnegative(), elapsed_days:z.number().nonnegative(), scheduled_days:z.number().nonnegative(), learning_steps:z.number().int().nonnegative(), reps:z.number().int().nonnegative(), lapses:z.number().int().nonnegative(), state:z.number().int().min(0).max(3), last_review:z.string().datetime().optional() }).strict();
export const initialState = now => json(createEmptyCard(now));
export function schedule(state, now, rating, config) {
 stateSchema.parse(state);
 if(config.libraryVersion !== '5.4.2' || config.version !== 1) throw new Error('Unsupported scheduler configuration');
 z.number().int().min(1).max(4).parse(rating);
 const result = json(fsrs(config.parameters).next(state, now, rating));
 stateSchema.parse(result.card);
 return result;
}
export function effectiveRating(objective, rating, components) {
 z.number().int().min(1).max(4).parse(rating);
 const assessment = objective === 'vocab_reading_meaning'
  ? z.object({readingCorrect:z.boolean(),meaningCorrect:z.boolean()}).parse(components)
  : z.object({correct:z.boolean()}).parse(components);
 const correct = objective === 'vocab_reading_meaning' ? assessment.readingCorrect && assessment.meaningCorrect : assessment.correct;
 return correct ? rating : 1;
}
export function studyDay(now, timezone) {
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get = type => parts.find(p=>p.type===type).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function nextStudyDay(now, timezone) {
 const day = studyDay(now,timezone);
 let lo = now.getTime(), hi = lo + 27*60*60*1000;
 // Search for the actual timezone boundary, including DST and non-hour offsets.
 while(hi-lo>1) { const mid=Math.floor((lo+hi)/2); if(studyDay(new Date(mid),timezone)===day) lo=mid; else hi=mid; }
 return new Date(hi);
}
