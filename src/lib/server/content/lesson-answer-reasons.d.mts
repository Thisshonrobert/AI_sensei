import type {Content,Prisma,PrismaClient} from '@prisma/client';
export type AnswerQuestion = Pick<Content,'id'|'revision'|'kind'|'origin'|'payloadJson'>;
export type AnswerReason = {answer_reason:string;origin:'generated';status:'draft'|'approved'};
export function verifiedOption(question:AnswerQuestion):string|null;
export function answerBinding(question:AnswerQuestion):string;
export function reasonFor(question:AnswerQuestion,children:(Pick<Content,'kind'|'origin'|'status'|'parentContentId'|'payloadJson'>&{successor?:unknown})[]):AnswerReason|null;
export function answerReasonData(question:AnswerQuestion,draft:{answer_reason:string;generationProvenance?:Prisma.InputJsonValue}):Prisma.ContentUncheckedCreateInput;
export function storeAnswerReason(db:PrismaClient,question:AnswerQuestion,draft:{answer_reason:string;generationProvenance?:Prisma.InputJsonValue}):Promise<{inserted:boolean;id:string}>;
